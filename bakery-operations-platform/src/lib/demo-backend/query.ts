import { randomUUID } from "crypto";
import {
  CREATED_AT_COLUMNS,
  DEFAULTS,
  NOW_DEFAULTS,
  HAS_UPDATED_AT,
  UPDATED_AT_COLUMNS,
  singularize,
  type TableName,
} from "./schema";
import { isView, table, type Row } from "./store";
import { buildPredicate, parseOrCondition, type Operator, type Predicate } from "./filters";

/**
 * `data` is deliberately `any`.
 *
 * The application was written against an untyped Supabase client — no
 * generated database types — so every call site already treats the result as
 * whatever the select string implies. Typing it as `Row[]` here would break
 * 500 call sites that are, in fact, correct. This mirrors the behaviour of the
 * library it replaces.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export type QueryResult<T = any[]> = {
  data: T;
  error: { message: string; code?: string; details?: string } | null;
  count?: number | null;
  status?: number;
};

type SelectOptions = { count?: "exact" | "planned" | "estimated"; head?: boolean };
type OrderOptions = { ascending?: boolean; nullsFirst?: boolean; referencedTable?: string };

/* ------------------------------------------------------------------ *
 * select() parsing
 * ------------------------------------------------------------------ */

type SelectField =
  | { kind: "column"; name: string; alias: string }
  | { kind: "embed"; name: string; alias: string; fields: SelectField[] };

/** Splits "a, b(c, d), e" on top-level commas only. */
function splitTopLevel(input: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of input) {
    if (char === "(") depth++;
    if (char === ")") depth--;
    if (char === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else current += char;
  }
  if (current.trim()) parts.push(current);
  return parts.map((part) => part.trim()).filter(Boolean);
}

function parseSelect(select: string): SelectField[] | null {
  const trimmed = select.trim();
  if (trimmed === "" || trimmed === "*") return null; // null means "every column"
  return splitTopLevel(trimmed).map((part) => {
    // [\s\S] rather than the `s` flag: the project targets ES2017.
    const embed = part.match(/^([A-Za-z0-9_]+)\s*(?:!\w+)?\s*\(([\s\S]*)\)$/);
    if (embed) {
      const [, name, inner] = embed;
      return {
        kind: "embed" as const,
        name: name!,
        alias: name!,
        fields: parseSelect(inner!) ?? [],
      };
    }
    const aliased = part.match(/^([A-Za-z0-9_]+)\s*:\s*([A-Za-z0-9_]+)$/);
    if (aliased) {
      return { kind: "column" as const, name: aliased[2]!, alias: aliased[1]! };
    }
    return { kind: "column" as const, name: part, alias: part };
  });
}

/**
 * Resolves an embedded relation the way PostgREST would from a foreign key.
 *
 * To-one:  the parent holds `<singular>_id` (an order holds `customer_id`).
 * To-many: the child holds `<parent singular>_id` (order_items hold `order_id`).
 */
function resolveEmbed(parentTable: string, parentRow: Row, embed: SelectField): unknown {
  if (embed.kind !== "embed") return null;
  const fkOnParent = `${singularize(embed.name)}_id`;

  if (fkOnParent in parentRow) {
    const id = parentRow[fkOnParent];
    if (id === null || id === undefined) return null;
    const child = table(embed.name).find((row) => row.id === id);
    return child ? project(embed.name, child, embed.fields) : null;
  }

  const fkOnChild = `${singularize(parentTable)}_id`;
  return table(embed.name)
    .filter((row) => row[fkOnChild] === parentRow.id)
    .map((row) => project(embed.name, row, embed.fields));
}

function project(tableName: string, row: Row, fields: SelectField[] | null): Row {
  if (!fields) return { ...row };
  const out: Row = {};
  for (const field of fields) {
    if (field.kind === "column") {
      if (field.name === "*") Object.assign(out, row);
      else out[field.alias] = row[field.name] ?? null;
    } else {
      out[field.alias] = resolveEmbed(tableName, row, field);
    }
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * defaults
 * ------------------------------------------------------------------ */

function applyInsertDefaults(tableName: string, row: Row): Row {
  const now = new Date().toISOString();
  const withDefaults: Row = {
    ...(DEFAULTS[tableName as TableName] ?? {}),
    ...row,
  };
  if (withDefaults.id === undefined || withDefaults.id === null) {
    withDefaults.id = randomUUID();
  }
  for (const column of CREATED_AT_COLUMNS) {
    if (withDefaults[column] === undefined) withDefaults[column] = now;
  }
  // Columns PostgreSQL defaulted to now() — see NOW_DEFAULTS for why this
  // matters more than it looks.
  for (const [column, kind] of Object.entries(NOW_DEFAULTS[tableName] ?? {})) {
    if (withDefaults[column] !== undefined) continue;
    withDefaults[column] =
      kind === "date"
        ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date())
        : now;
  }
  if (HAS_UPDATED_AT.has(tableName)) {
    for (const column of UPDATED_AT_COLUMNS) {
      if (withDefaults[column] === undefined) withDefaults[column] = now;
    }
  }
  return withDefaults;
}

/* ------------------------------------------------------------------ *
 * the builder
 * ------------------------------------------------------------------ */

type Mode =
  | { kind: "select" }
  | { kind: "insert"; rows: Row[] }
  | { kind: "upsert"; rows: Row[]; onConflict?: string }
  | { kind: "update"; patch: Row }
  | { kind: "delete" };

/**
 * A PostgREST-compatible query builder over the in-memory store.
 *
 * It is thenable, so every existing `await supabase.from(...)...` call site in
 * the application works unchanged — which is the entire point: the demo runs
 * the production code, not a rewrite of it.
 */
export class QueryBuilder<T = any[]> implements PromiseLike<QueryResult<T>> {
  private predicates: Predicate[] = [];
  private orderings: { column: string; ascending: boolean; nullsFirst: boolean }[] = [];
  private selectFields: SelectField[] | null = null;
  private selectRequested = false;
  private limitValue: number | null = null;
  private rangeValue: { from: number; to: number } | null = null;
  private countMode: SelectOptions["count"] | null = null;
  private headOnly = false;
  private singleMode: "none" | "single" | "maybe" = "none";
  private mode: Mode = { kind: "select" };

  constructor(private readonly tableName: string) {}

  /* ---------------------------- verbs ---------------------------- */

  select(select = "*", options: SelectOptions = {}): this {
    this.selectRequested = true;
    this.selectFields = parseSelect(select);
    this.countMode = options.count ?? null;
    this.headOnly = options.head ?? false;
    return this;
  }

  insert(rows: Row | Row[]): this {
    this.mode = { kind: "insert", rows: Array.isArray(rows) ? rows : [rows] };
    return this;
  }

  upsert(rows: Row | Row[], options: { onConflict?: string } = {}): this {
    this.mode = {
      kind: "upsert",
      rows: Array.isArray(rows) ? rows : [rows],
      onConflict: options.onConflict,
    };
    return this;
  }

  update(patch: Row): this {
    this.mode = { kind: "update", patch };
    return this;
  }

  delete(): this {
    this.mode = { kind: "delete" };
    return this;
  }

  /* --------------------------- filters --------------------------- */

  private push(column: string, operator: Operator, operand: unknown): this {
    this.predicates.push(buildPredicate(column, operator, operand));
    return this;
  }

  eq(column: string, value: unknown) { return this.push(column, "eq", value); }
  neq(column: string, value: unknown) { return this.push(column, "neq", value); }
  gt(column: string, value: unknown) { return this.push(column, "gt", value); }
  gte(column: string, value: unknown) { return this.push(column, "gte", value); }
  lt(column: string, value: unknown) { return this.push(column, "lt", value); }
  lte(column: string, value: unknown) { return this.push(column, "lte", value); }
  like(column: string, value: string) { return this.push(column, "like", value); }
  ilike(column: string, value: string) { return this.push(column, "ilike", value); }
  is(column: string, value: unknown) { return this.push(column, "is", value); }
  in(column: string, values: unknown[]) { return this.push(column, "in", values); }
  contains(column: string, value: unknown) { return this.push(column, "contains", value); }

  filter(column: string, operator: string, value: unknown): this {
    if (operator.startsWith("not.")) {
      const inner = buildPredicate(column, operator.slice(4) as Operator, value);
      this.predicates.push((row) => !inner(row));
      return this;
    }
    return this.push(column, operator as Operator, value);
  }

  not(column: string, operator: string, value: unknown): this {
    const inner = buildPredicate(column, operator as Operator, value);
    this.predicates.push((row) => !inner(row));
    return this;
  }

  or(expression: string): this {
    const branches = splitTopLevel(expression).map(parseOrCondition);
    this.predicates.push((row) => branches.some((branch) => branch(row)));
    return this;
  }

  match(criteria: Row): this {
    for (const [column, value] of Object.entries(criteria)) this.eq(column, value);
    return this;
  }

  /* ------------------------- shaping ----------------------------- */

  order(column: string, options: OrderOptions = {}): this {
    this.orderings.push({
      column,
      ascending: options.ascending ?? true,
      nullsFirst: options.nullsFirst ?? false,
    });
    return this;
  }

  limit(count: number): this {
    this.limitValue = count;
    return this;
  }

  range(from: number, to: number): this {
    this.rangeValue = { from, to };
    return this;
  }

  single(): QueryBuilder<any> {
    this.singleMode = "single";
    return this as unknown as QueryBuilder<any>;
  }

  maybeSingle(): QueryBuilder<any> {
    this.singleMode = "maybe";
    return this as unknown as QueryBuilder<any>;
  }

  /** Supabase allows `.returns<T>()` purely for typing. */
  returns<R>(): QueryBuilder<R> {
    return this as unknown as QueryBuilder<R>;
  }

  overrideTypes<R>(): QueryBuilder<R> {
    return this as unknown as QueryBuilder<R>;
  }

  throwOnError(): this {
    return this;
  }

  abortSignal(): this {
    return this;
  }

  /* --------------------------- execute --------------------------- */

  private matching(rows: Row[]): Row[] {
    return rows.filter((row) => this.predicates.every((predicate) => predicate(row)));
  }

  private sort(rows: Row[]): Row[] {
    if (this.orderings.length === 0) return rows;
    return [...rows].sort((a, b) => {
      for (const { column, ascending, nullsFirst } of this.orderings) {
        const left = a[column];
        const right = b[column];
        const leftNull = left === null || left === undefined;
        const rightNull = right === null || right === undefined;
        if (leftNull && rightNull) continue;
        if (leftNull) return nullsFirst ? -1 : 1;
        if (rightNull) return nullsFirst ? 1 : -1;
        let comparison: number;
        if (typeof left === "number" && typeof right === "number") comparison = left - right;
        else if (typeof left === "boolean" && typeof right === "boolean") {
          comparison = Number(left) - Number(right);
        } else comparison = String(left) < String(right) ? -1 : String(left) > String(right) ? 1 : 0;
        if (comparison !== 0) return ascending ? comparison : -comparison;
      }
      return 0;
    });
  }

  private run(): QueryResult<unknown> {
    if (this.mode.kind !== "select" && isView(this.tableName)) {
      return {
        data: null,
        error: { message: `cannot ${this.mode.kind} on view "${this.tableName}"`, code: "42809" },
        status: 400,
      };
    }
    const rows = table(this.tableName);
    let affected: Row[];

    switch (this.mode.kind) {
      case "insert": {
        affected = this.mode.rows.map((row) => applyInsertDefaults(this.tableName, row));
        rows.push(...affected);
        break;
      }
      case "upsert": {
        const keys = (this.mode.onConflict ?? "id").split(",").map((key) => key.trim());
        affected = this.mode.rows.map((incoming) => {
          const existing = rows.find((row) => keys.every((key) => row[key] === incoming[key]));
          if (existing) {
            Object.assign(existing, incoming);
            if (HAS_UPDATED_AT.has(this.tableName)) {
              existing.updated_at = new Date().toISOString();
            }
            return existing;
          }
          const created = applyInsertDefaults(this.tableName, incoming);
          rows.push(created);
          return created;
        });
        break;
      }
      case "update": {
        affected = this.matching(rows);
        for (const row of affected) {
          Object.assign(row, this.mode.patch);
          if (HAS_UPDATED_AT.has(this.tableName)) row.updated_at = new Date().toISOString();
        }
        break;
      }
      case "delete": {
        affected = this.matching(rows);
        for (const row of affected) {
          const index = rows.indexOf(row);
          if (index >= 0) rows.splice(index, 1);
        }
        break;
      }
      default:
        affected = this.matching(rows);
    }

    const total = affected.length;
    let result = this.mode.kind === "select" ? this.sort(affected) : affected;

    if (this.rangeValue) {
      result = result.slice(this.rangeValue.from, this.rangeValue.to + 1);
    }
    if (this.limitValue !== null) result = result.slice(0, this.limitValue);

    const count = this.countMode ? total : null;

    // A write with no .select() returns no rows, exactly as PostgREST does.
    if (!this.selectRequested && this.mode.kind !== "select") {
      return { data: null, error: null, count, status: 200 };
    }
    if (this.headOnly) return { data: null, error: null, count, status: 200 };

    const projected = result.map((row) => project(this.tableName, row, this.selectFields));

    if (this.singleMode !== "none") {
      if (projected.length === 1) return { data: projected[0]!, error: null, count, status: 200 };
      if (projected.length === 0) {
        if (this.singleMode === "maybe") return { data: null, error: null, count, status: 200 };
        return {
          data: null,
          error: { message: "JSON object requested, multiple (or no) rows returned", code: "PGRST116" },
          count,
          status: 406,
        };
      }
      return {
        data: null,
        error: { message: "JSON object requested, multiple (or no) rows returned", code: "PGRST116" },
        count,
        status: 406,
      };
    }

    return { data: projected, error: null, count, status: 200 };
  }

  then<TResult1 = QueryResult<T>, TResult2 = never>(
    onfulfilled?: ((value: QueryResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    try {
      return Promise.resolve(this.run() as QueryResult<T>).then(onfulfilled, onrejected);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Promise.resolve({ data: null as T, error: { message } }).then(
        onfulfilled,
        onrejected
      );
    }
  }
}
