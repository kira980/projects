import { describe, expect, it, beforeEach } from "vitest";
import { QueryBuilder } from "./query";
import { getStore, resetDatabase, table } from "./store";

/**
 * The demo backend stands in for PostgreSQL and PostgREST, so the thing worth
 * testing is that it behaves the way the application already expects: the
 * filter vocabulary, embedded relations, `single()` semantics, and writes that
 * return rows only when asked.
 *
 * Every assertion below is a shape the real application relies on somewhere.
 */

const from = (name: string) => new QueryBuilder(name);

beforeEach(() => {
  resetDatabase();
});

describe("the store", () => {
  it("seeds one business and a full working dataset", () => {
    const { db } = getStore();
    expect(db.businesses).toHaveLength(1);
    expect(db.orders.length).toBeGreaterThan(100);
    expect(db.order_items.length).toBeGreaterThan(db.orders.length);
    expect(db.workers.length).toBeGreaterThan(5);
  });

  it("resets to the same dataset every time", () => {
    const first = resetDatabase().rows;
    const second = resetDatabase().rows;
    expect(second).toBe(first);
  });

  it("contains no real-world identifiers", () => {
    // A guard, not a formality: the Latin-only version of this check missed
    // the Hebrew and Arabic spellings of the same place name for a while.
    const dump = JSON.stringify(getStore().db);
    const forbidden = [
      "salman", "סלמאן", "سلمان",
      "kafr", "manda", "כפר מנדא", "كفر مندا",
      "supabase.co", "vercel.app", "eyJhbGciOi",
    ];
    for (const needle of forbidden) {
      expect(dump.toLowerCase()).not.toContain(needle.toLowerCase());
    }
  });
});

describe("select and filter", () => {
  it("returns rows and honours eq", async () => {
    const business = table("businesses")[0]!;
    const { data, error } = await from("orders").select("*").eq("business_id", business.id);
    expect(error).toBeNull();
    expect(data.length).toBeGreaterThan(0);
    expect(data.every((row: Record<string, unknown>) => row.business_id === business.id)).toBe(true);
  });

  it("projects only the requested columns", async () => {
    const { data } = await from("customers").select("id, name").limit(1);
    expect(Object.keys(data[0])).toEqual(["id", "name"]);
  });

  it("resolves a to-one embedded relation through the foreign key", async () => {
    // `payments(..., customers(name))` is used verbatim by the dashboard.
    const { data } = await from("payments").select("id, amount, customers(name)").limit(1);
    if (data.length === 0) return;
    expect(data[0].customers).toHaveProperty("name");
    expect(typeof data[0].customers.name).toBe("string");
  });

  it("resolves a to-many embedded relation from the child's foreign key", async () => {
    const { data } = await from("orders")
      .select("id, order_items(product_name, quantity)")
      .limit(1);
    expect(Array.isArray(data[0].order_items)).toBe(true);
    expect(data[0].order_items[0]).toHaveProperty("product_name");
  });

  it("supports in, is, not, gte/lt and or", async () => {
    const statuses = ["new", "preparing"];
    const { data: inRows } = await from("orders").select("status").in("status", statuses);
    expect(inRows.every((row: { status: string }) => statuses.includes(row.status))).toBe(true);

    const { data: nullRows } = await from("orders").select("id, delivery_time").is("delivery_time", null);
    expect(nullRows.every((row: { delivery_time: unknown }) => row.delivery_time === null)).toBe(true);

    const { data: notRows } = await from("orders").select("status").not("status", "eq", "delivered");
    expect(notRows.every((row: { status: string }) => row.status !== "delivered")).toBe(true);

    const { data: orRows } = await from("orders").select("status").or("status.eq.new,status.eq.ready");
    expect(orRows.every((row: { status: string }) => ["new", "ready"].includes(row.status))).toBe(true);
  });

  it("orders, limits and pages", async () => {
    const { data } = await from("orders")
      .select("order_number")
      .order("order_number", { ascending: false })
      .limit(5);
    const numbers = data.map((row: { order_number: number }) => row.order_number);
    expect([...numbers].sort((a, b) => b - a)).toEqual(numbers);

    const { data: page } = await from("orders").select("id").order("order_number").range(10, 14);
    expect(page).toHaveLength(5);
  });

  it("returns an exact count independent of the limit", async () => {
    const { data, count } = await from("orders").select("id", { count: "exact" }).limit(3);
    expect(data).toHaveLength(3);
    expect(count).toBeGreaterThan(3);
  });

  it("supports a head-only count with no rows", async () => {
    const { data, count } = await from("orders").select("id", { count: "exact", head: true });
    expect(data).toBeNull();
    expect(count).toBeGreaterThan(0);
  });
});

describe("single and maybeSingle", () => {
  it("single returns the row itself", async () => {
    const first = table("customers")[0]!;
    const { data, error } = await from("customers").select("*").eq("id", first.id).single();
    expect(error).toBeNull();
    expect(data.id).toBe(first.id);
  });

  it("single errors when nothing matched, the way PostgREST does", async () => {
    const { data, error } = await from("customers").select("*").eq("id", "nope").single();
    expect(data).toBeNull();
    expect(error?.code).toBe("PGRST116");
  });

  it("maybeSingle returns null without an error", async () => {
    const { data, error } = await from("customers").select("*").eq("id", "nope").maybeSingle();
    expect(data).toBeNull();
    expect(error).toBeNull();
  });
});

describe("writes", () => {
  it("insert fills in an id and created_at, and returns nothing without select()", async () => {
    const before = table("vendors").length;
    const { data } = await from("vendors").insert({
      business_id: table("businesses")[0]!.id,
      name: "ספק בדיקה",
    });
    expect(data).toBeNull();
    expect(table("vendors")).toHaveLength(before + 1);
    const created = table("vendors").at(-1)!;
    expect(created.id).toBeTruthy();
    expect(created.created_at).toBeTruthy();
    expect(created.is_active).toBe(true); // schema default
  });

  it("fills the columns PostgreSQL defaulted to now()", async () => {
    // The driver's action inserts a payment without a `paid_at`, and every
    // "collected today" figure filters on exactly that column. Leaving it null
    // made a driver's takings read zero the moment after they took the money.
    const business = table("businesses")[0]!;
    const customer = table("customers")[0]!;
    await from("payments").insert({
      business_id: business.id,
      customer_id: customer.id,
      amount: 100,
      method: "cash",
      collected_by_type: "worker",
    });
    const created = table("payments").at(-1)!;
    expect(created.paid_at).toBeTruthy();
    expect(String(created.paid_at)).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    await from("expenses").insert({
      business_id: business.id,
      category: "בדיקה",
      amount: 12,
      method: "cash",
      spent_by_type: "worker",
    });
    // A `date` column, not an instant.
    expect(String(table("expenses").at(-1)!.expense_date)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("does not overwrite a value the caller supplied", async () => {
    const business = table("businesses")[0]!;
    const customer = table("customers")[0]!;
    await from("payments").insert({
      business_id: business.id,
      customer_id: customer.id,
      amount: 50,
      method: "cash",
      collected_by_type: "worker",
      paid_at: "2020-01-01T00:00:00.000Z",
    });
    expect(table("payments").at(-1)!.paid_at).toBe("2020-01-01T00:00:00.000Z");
  });

  it("insert returns the row when select() is chained", async () => {
    const { data } = await from("vendors")
      .insert({ business_id: table("businesses")[0]!.id, name: "ספק שני" })
      .select("id, name")
      .single();
    expect(data.name).toBe("ספק שני");
    expect(data.id).toBeTruthy();
  });

  it("update touches only matching rows and refreshes updated_at", async () => {
    const target = table("customers")[0]!;
    const others = table("customers").slice(1).map((row) => row.notes);
    await from("customers").update({ notes: "עודכן" }).eq("id", target.id);
    expect(table("customers")[0]!.notes).toBe("עודכן");
    expect(table("customers")[0]!.updated_at).toBeTruthy();
    expect(table("customers").slice(1).map((row) => row.notes)).toEqual(others);
  });

  it("delete removes only matching rows", async () => {
    const before = table("expenses").length;
    const victim = table("expenses")[0]!;
    await from("expenses").delete().eq("id", victim.id);
    expect(table("expenses")).toHaveLength(before - 1);
    expect(table("expenses").some((row) => row.id === victim.id)).toBe(false);
  });

  it("upsert updates on conflict instead of duplicating", async () => {
    const businessId = table("businesses")[0]!.id;
    const row = { business_id: businessId, lock_date: "2030-01-01", is_locked: true };
    await from("day_locks").upsert(row, { onConflict: "business_id,lock_date" });
    await from("day_locks").upsert({ ...row, is_locked: false }, { onConflict: "business_id,lock_date" });
    const matches = table("day_locks").filter((r) => r.lock_date === "2030-01-01");
    expect(matches).toHaveLength(1);
    expect(matches[0]!.is_locked).toBe(false);
  });
});
