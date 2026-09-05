import type { Row } from "./store";

/**
 * The PostgREST filter vocabulary, as far as this application uses it.
 *
 * Comparisons follow PostgreSQL's rules rather than JavaScript's where the two
 * differ and it matters: NULL never satisfies an ordering comparison, and
 * dates arrive as ISO strings that compare correctly lexicographically.
 */
export type Operator =
  | "eq" | "neq" | "gt" | "gte" | "lt" | "lte"
  | "like" | "ilike" | "is" | "in" | "contains" | "not";

export type Predicate = (row: Row) => boolean;

function value(row: Row, column: string): unknown {
  return row[column];
}

function likeToRegExp(pattern: string, insensitive: boolean): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/%/g, ".*")
    .replace(/_/g, ".");
  return new RegExp(`^${escaped}$`, insensitive ? "i" : "");
}

function compare(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  const left = a === null || a === undefined ? "" : String(a);
  const right = b === null || b === undefined ? "" : String(b);
  return left < right ? -1 : left > right ? 1 : 0;
}

/** Coerces a filter value that arrived as a URL-style string. */
function coerce(raw: unknown): unknown {
  if (raw === "null") return null;
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (typeof raw === "string" && raw !== "" && !Number.isNaN(Number(raw))) {
    // Only coerce when the round trip is lossless, so "007" stays a string.
    if (String(Number(raw)) === raw) return Number(raw);
  }
  return raw;
}

export function buildPredicate(
  column: string,
  operator: Operator,
  operand: unknown
): Predicate {
  switch (operator) {
    case "eq":
      return (row) => value(row, column) === coerce(operand);
    case "neq":
      return (row) => value(row, column) !== coerce(operand);
    case "gt":
      return (row) => {
        const v = value(row, column);
        return v !== null && v !== undefined && compare(v, operand) > 0;
      };
    case "gte":
      return (row) => {
        const v = value(row, column);
        return v !== null && v !== undefined && compare(v, operand) >= 0;
      };
    case "lt":
      return (row) => {
        const v = value(row, column);
        return v !== null && v !== undefined && compare(v, operand) < 0;
      };
    case "lte":
      return (row) => {
        const v = value(row, column);
        return v !== null && v !== undefined && compare(v, operand) <= 0;
      };
    case "like":
      return (row) => likeToRegExp(String(operand), false).test(String(value(row, column) ?? ""));
    case "ilike":
      return (row) => likeToRegExp(String(operand), true).test(String(value(row, column) ?? ""));
    case "is": {
      const target = coerce(operand);
      return (row) => {
        const v = value(row, column);
        if (target === null) return v === null || v === undefined;
        return v === target;
      };
    }
    case "in": {
      const list = (Array.isArray(operand) ? operand : String(operand).split(",")).map(coerce);
      return (row) => list.includes(value(row, column) as never);
    }
    case "contains": {
      // jsonb / array containment, as used for push subscription keys.
      return (row) => {
        const v = value(row, column);
        if (Array.isArray(v)) {
          const needles = Array.isArray(operand) ? operand : [operand];
          return needles.every((needle) => v.includes(needle));
        }
        if (v && typeof v === "object" && operand && typeof operand === "object") {
          return Object.entries(operand as Row).every(
            ([key, val]) => (v as Row)[key] === val
          );
        }
        return false;
      };
    }
    default:
      return () => true;
  }
}

/**
 * Parses one side of an `.or("a.eq.1,b.is.null")` expression.
 * PostgREST spells a filter as `column.operator.value`.
 */
export function parseOrCondition(expression: string): Predicate {
  const [column, operator, ...rest] = expression.split(".");
  if (!column || !operator) return () => true;
  const operand = rest.join(".");
  if (operator === "not") {
    const [innerOp, ...innerRest] = rest;
    const inner = buildPredicate(column, (innerOp ?? "eq") as Operator, innerRest.join("."));
    return (row) => !inner(row);
  }
  return buildPredicate(column, operator as Operator, operand);
}
