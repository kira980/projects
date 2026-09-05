import { TABLES, VIEWS, type TableName, type ViewName } from "./schema";
import { seedDatabase } from "./seed";

export type Row = Record<string, unknown>;

/**
 * The demo database.
 *
 * The production system runs on PostgreSQL. For a public demo that has to be
 * clonable and runnable with `npm install && npm run dev`, the whole store
 * lives in memory and is seeded from a fictional dataset on first use.
 *
 * It is a module-level singleton because the Node process is the database:
 * writes made by one request have to be visible to the next. Restarting the
 * server is therefore also how you reset the demo — see `/api/demo/reset` for
 * doing it without a restart.
 */
export type Database = Record<TableName, Row[]>;

type StoreState = {
  db: Database;
  seededAt: string;
};

// Survives hot-module replacement in development, which would otherwise wipe
// the demo data on every file save.
const globalRef = globalThis as unknown as { __demoStore?: StoreState };

function emptyDatabase(): Database {
  return Object.fromEntries(TABLES.map((table) => [table, []])) as unknown as Database;
}

export function getStore(): StoreState {
  if (!globalRef.__demoStore) {
    const state: StoreState = { db: emptyDatabase(), seededAt: "" };
    globalRef.__demoStore = state;
    // `seed.ts` imports only types from here, so there is no runtime cycle.
    seedDatabase(state.db);
    state.seededAt = new Date().toISOString();
  }
  return globalRef.__demoStore;
}

/**
 * The database views, recomputed on every read.
 *
 * `customer_debts` and `vendor_debts` are views in PostgreSQL: the signed sum
 * of an append-only ledger, grouped by owner. Deriving them here rather than
 * caching a number keeps the same guarantee — there is no stored balance that
 * can drift away from the rows behind it.
 */
function computeView(name: ViewName): Row[] {
  const store = getStore();
  const [source, key] =
    name === "customer_debts"
      ? (["customer_ledger_entries", "customer_id"] as const)
      : (["vendor_ledger_entries", "vendor_id"] as const);

  const totals = new Map<string, Row>();
  for (const entry of store.db[source]) {
    const owner = String(entry[key]);
    const signed =
      entry.entry_type === "payment" ? -Number(entry.amount) : Number(entry.amount);
    const existing = totals.get(owner);
    if (existing) existing.debt = Number(existing.debt) + signed;
    else totals.set(owner, { business_id: entry.business_id, [key]: entry[key], debt: signed });
  }
  // Round once at the end, the way numeric(12,2) would have.
  for (const row of totals.values()) {
    row.debt = Math.round((Number(row.debt) + Number.EPSILON) * 100) / 100;
  }
  return [...totals.values()];
}

export function isView(name: string): name is ViewName {
  return (VIEWS as readonly string[]).includes(name);
}

export function table(name: string): Row[] {
  if (isView(name)) return computeView(name);

  const store = getStore();
  const rows = store.db[name as TableName];
  if (!rows) {
    throw new Error(`Unknown relation "${name}" — add it to TABLES or VIEWS in schema.ts`);
  }
  return rows;
}

/** Wipes and regenerates the dataset. Used by the reset endpoint. */
export function resetDatabase(): { seededAt: string; rows: number } {
  const store = getStore();
  for (const name of TABLES) store.db[name] = [];
  seedDatabase(store.db);
  store.seededAt = new Date().toISOString();
  return {
    seededAt: store.seededAt,
    rows: TABLES.reduce((total, name) => total + store.db[name].length, 0),
  };
}

export function databaseSummary(): { table: string; rows: number }[] {
  const store = getStore();
  return TABLES.map((name) => ({ table: name, rows: store.db[name].length })).filter(
    (entry) => entry.rows > 0
  );
}
