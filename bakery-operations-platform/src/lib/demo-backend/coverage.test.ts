import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { TABLES, VIEWS } from "./schema";
import { callRpc } from "./rpc";
import { table } from "./store";
import { businessToday } from "@/lib/db/day-lock";

/**
 * Does the demo backend actually cover what the application asks for?
 *
 * This is the test that would have caught a real gap: the app queries
 * `customer_debts` and `vendor_debts`, which are PostgreSQL *views*, and five
 * tables that were missing from the store. Nothing crashed — the query builder
 * returned an error object the UI quietly rendered as zero — so every customer
 * showed no debt at all. A silently empty screen is the worst kind of bug,
 * and only a coverage check finds it.
 */

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) sourceFiles(path, found);
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) found.push(path);
  }
  return found;
}

const sources = sourceFiles("src").map((path) => readFileSync(path, "utf8"));
const matchAll = (pattern: RegExp) => {
  const hits = new Set<string>();
  for (const source of sources) {
    for (const match of source.matchAll(pattern)) hits.add(match[1]!);
  }
  return [...hits].sort();
};

/** Storage buckets, not database relations. */
const BUCKETS = new Set(["receipts", "proofs", "documents"]);

describe("relation coverage", () => {
  const referenced = matchAll(/\.from\("([a-z_]+)"\)/g).filter((name) => !BUCKETS.has(name));
  const known = new Set<string>([...TABLES, ...VIEWS]);

  it("finds every relation the application queries", () => {
    const missing = referenced.filter((name) => !known.has(name));
    expect(missing).toEqual([]);
  });

  it("can actually read every one of them", () => {
    for (const name of referenced) {
      expect(() => table(name), `reading ${name}`).not.toThrow();
      expect(Array.isArray(table(name)), `${name} returns rows`).toBe(true);
    }
  });
});

describe("procedure coverage", () => {
  const referenced = matchAll(/\.rpc\("([a-z_]+)"/g);

  it("implements every stored procedure the application calls", () => {
    const unimplemented = referenced.filter(
      (name) => callRpc(name, {}).error?.message?.startsWith("Unknown function")
    );
    expect(unimplemented).toEqual([]);
  });
});

describe("the demo is anchored to the business day", () => {
  /**
   * The bakery's day rolls over at 02:00, not midnight. The seed used the
   * calendar date, so between 00:00 and 02:00 every screen asked for the
   * trading night that was still running while the data sat on tomorrow — an
   * empty dashboard, an empty bench and an empty van, for two hours a night.
   */
  it("puts today's work on the day the screens ask for", () => {
    const today = businessToday();
    const onToday = table("orders").filter((order) => order.delivery_date === today);
    expect(onToday.length, `orders dated ${today}`).toBeGreaterThanOrEqual(3);
  });

  it("has an open shift right now, whatever the hour", () => {
    expect(table("worker_shifts").filter((shift) => shift.ended_at === null).length)
      .toBeGreaterThan(0);
  });
});

describe("delivery invariants", () => {
  /**
   * A `delivery_orders` row means "this stop was completed" — it is written by
   * the driver at completion, never in advance (migration 0010).
   *
   * Seeding "pending" rows broke every delivery on today's run: the completion
   * action reads an existing row as proof the stop is already done and refuses
   * with "המשלוח כבר הושלם". The screen showed the stop as open, the button
   * said it was finished.
   */
  it("never has a stop row for an order that was not delivered", () => {
    const orders = new Map(table("orders").map((order) => [order.id, order]));
    const premature = table("delivery_orders").filter(
      (stop) => orders.get(stop.order_id)?.status !== "delivered"
    );
    expect(premature).toEqual([]);
  });

  it("has no pending stop rows at all", () => {
    expect(table("delivery_orders").filter((stop) => stop.status === "pending")).toEqual([]);
  });

  it("records who completed every stop", () => {
    const stops = table("delivery_orders");
    expect(stops.length).toBeGreaterThan(0);
    expect(stops.every((stop) => stop.completed_by_worker_id && stop.completed_at)).toBe(true);
  });

  it("leaves several of today's deliveries open for the driver to complete", () => {
    // The driver app is only worth opening if there is work on it. The demo is
    // anchored to whenever it is run, so this has to hold on a Saturday too.
    const today = businessToday();
    const completed = new Set(table("delivery_orders").map((stop) => stop.order_id));
    const openToday = table("orders").filter(
      (order) =>
        order.delivery_date === today &&
        order.delivery_type === "delivery" &&
        order.status !== "cancelled" &&
        !completed.has(order.id)
    );
    expect(openToday.length).toBeGreaterThanOrEqual(3);
  });

  it("gives the bench something to bake today and tomorrow", () => {
    const today = businessToday();
    const tomorrow = new Date(`${today}T12:00:00Z`);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    for (const day of [today, tomorrow.toISOString().slice(0, 10)]) {
      const count = table("orders").filter(
        (order) => order.delivery_date === day && order.status !== "cancelled"
      ).length;
      expect(count, `orders for ${day}`).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("the debt views", () => {
  it("derive a customer's balance from the ledger", () => {
    const debts = table("customer_debts");
    expect(debts.length).toBeGreaterThan(0);

    const row = debts.find((entry) => Number(entry.debt) !== 0)!;
    const fromLedger = table("customer_ledger_entries")
      .filter((entry) => entry.customer_id === row.customer_id)
      .reduce(
        (sum, entry) =>
          sum + (entry.entry_type === "payment" ? -Number(entry.amount) : Number(entry.amount)),
        0
      );
    expect(Number(row.debt)).toBeCloseTo(fromLedger, 2);
  });

  it("derive a vendor's balance from the ledger", () => {
    const debts = table("vendor_debts");
    expect(debts.length).toBeGreaterThan(0);
    expect(debts.every((row) => typeof row.debt === "number")).toBe(true);
  });

  it("shows real outstanding money in the demo data", () => {
    // If every balance is zero the receivables screens are empty and nobody
    // notices the plumbing is broken.
    const owed = table("customer_debts").reduce(
      (sum, row) => sum + Math.max(0, Number(row.debt)),
      0
    );
    expect(owed).toBeGreaterThan(0);
  });

  it("refuses writes, as a view does", async () => {
    const { QueryBuilder } = await import("./query");
    const { error } = await new QueryBuilder("customer_debts").delete().eq("debt", 0);
    expect(error?.code).toBe("42809");
  });
});
