import { describe, expect, it, beforeEach } from "vitest";
import { callRpc } from "./rpc";
import { resetDatabase, table, type Row } from "./store";

/**
 * The stored procedures.
 *
 * These are the operations that exist as database functions in production
 * precisely because they must be all-or-nothing: an order and its ledger
 * charge, a supplier bill and its ledger entry. The tests assert the
 * invariant — the ledger agrees with the record — rather than the steps.
 */

const businessId = () => String(table("businesses")[0]!.id);
const vendorDebt = (vendorId: string) =>
  table("vendor_ledger_entries")
    .filter((row) => row.vendor_id === vendorId)
    .reduce((sum, row) => sum + (row.entry_type === "payment" ? -Number(row.amount) : Number(row.amount)), 0);
const customerBalance = (customerId: string) =>
  table("customer_ledger_entries")
    .filter((row) => row.customer_id === customerId)
    .reduce((sum, row) => sum + (row.entry_type === "payment" ? -Number(row.amount) : Number(row.amount)), 0);

beforeEach(() => {
  resetDatabase();
});

describe("create_order_admin", () => {
  const newOrder = (overrides: Row = {}) => {
    const customer = table("customers")[0]!;
    const products = table("products").slice(0, 2);
    return callRpc("create_order_admin", {
      p_customer_id: customer.id,
      p_delivery_type: "delivery",
      p_delivery_date: "2030-01-15",
      p_delivery_time: null,
      p_address_text: null,
      p_notes: null,
      p_notes_for_baker: null,
      p_notes_for_driver: null,
      p_items: products.map((product) => ({ product_id: product.id, quantity: 4, notes: null })),
      p_actor_id: null,
      p_actor_name: "בדיקה",
      ...overrides,
    });
  };

  it("writes the order, its items, the ledger charge and the audit row together", () => {
    const customer = table("customers")[0]!;
    const balanceBefore = customerBalance(String(customer.id));
    const orders = table("orders").length;

    const { data, error } = newOrder();
    expect(error).toBeNull();

    const order = table("orders").find((row) => row.id === data.order_id)!;
    expect(table("orders")).toHaveLength(orders + 1);
    expect(order.status).toBe("new");
    expect(table("order_items").filter((row) => row.order_id === order.id)).toHaveLength(2);

    // The charge landed, and the balance moved by exactly the order total.
    expect(customerBalance(String(customer.id))).toBeCloseTo(balanceBefore + Number(order.total), 2);
    expect(
      table("audit_logs").some((row) => row.action === "order.create" && row.entity_id === order.id)
    ).toBe(true);
  });

  it("prices each line from the customer's agreed price, not the list price", () => {
    const override = table("customer_product_prices")[0];
    if (!override) return;
    const { data } = callRpc("create_order_admin", {
      p_customer_id: override.customer_id,
      p_delivery_type: "delivery",
      p_delivery_date: "2030-01-15",
      p_items: [{ product_id: override.product_id, quantity: 3, notes: null }],
      p_actor_name: "בדיקה",
    });
    const item = table("order_items").find((row) => row.order_id === data.order_id)!;
    expect(Number(item.unit_price)).toBe(Number(override.price));
    expect(Number(item.line_total)).toBeCloseTo(Number(override.price) * 3, 2);
  });

  it("issues sequential order numbers and a delivery code", () => {
    const first = newOrder().data;
    const second = newOrder().data;
    expect(second.order_number).toBe(first.order_number + 1);
    const order = table("orders").find((row) => row.id === first.order_id)!;
    expect(order.delivery_code).toMatch(/^[A-Z][1-9]$/);
    expect(order.public_delivery_id).toMatch(/^D-\d{6}$/);
  });

  it("rejects an empty order and writes nothing", () => {
    const orders = table("orders").length;
    const ledger = table("customer_ledger_entries").length;
    const { error } = newOrder({ p_items: [] });
    expect(error?.message).toBe("NO_ITEMS");
    expect(table("orders")).toHaveLength(orders);
    expect(table("customer_ledger_entries")).toHaveLength(ledger);
  });

  it("rejects an unknown product", () => {
    const { error } = newOrder({ p_items: [{ product_id: "nope", quantity: 1 }] });
    expect(error?.message).toBe("PRODUCT_NOT_FOUND");
  });

  it("refuses to write into a locked day", () => {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());
    table("day_locks").push({
      id: "lock", business_id: businessId(), lock_date: today, is_locked: true,
    });
    expect(newOrder().error?.message).toBe("DAY_LOCKED");
  });
});

describe("the vendor ledger", () => {
  const vendorId = () => String(table("vendors")[0]!.id);

  it("records goods received as a bill plus a ledger charge", () => {
    const vendor = vendorId();
    const before = vendorDebt(vendor);
    const { data, error } = callRpc("record_vendor_order", {
      p_business_id: businessId(),
      p_vendor_id: vendor,
      p_amount: 500,
      p_paid: false,
      p_received_by_type: "worker",
      p_actor_type: "worker",
      p_actor_name: "בדיקה",
    });
    expect(error).toBeNull();
    expect(vendorDebt(vendor)).toBeCloseTo(before + 500, 2);
    expect(table("vendor_orders").find((row) => row.id === data)!.status).toBe("unpaid");
  });

  it("nets to zero when the bill is paid at arrival", () => {
    const vendor = vendorId();
    const before = vendorDebt(vendor);
    callRpc("record_vendor_order", {
      p_business_id: businessId(), p_vendor_id: vendor, p_amount: 800, p_paid: true,
      p_payment_method: "cash", p_received_by_type: "worker", p_actor_type: "worker", p_actor_name: "בדיקה",
    });
    expect(vendorDebt(vendor)).toBeCloseTo(before, 2);
  });

  it("refuses to pay a supplier more than it is owed", () => {
    const vendor = vendorId();
    const owed = vendorDebt(vendor);
    const { error } = callRpc("record_vendor_payment", {
      p_business_id: businessId(), p_vendor_id: vendor, p_amount: owed + 10_000,
      p_method: "cash", p_paid_by_type: "worker", p_actor_type: "worker", p_actor_name: "בדיקה",
    });
    expect(error?.message).toBe("OVERPAYMENT");
    expect(vendorDebt(vendor)).toBeCloseTo(owed, 2);
  });

  it("will not delete a bill that a later debt payment is attached to", () => {
    const vendor = vendorId();
    const { data: orderId } = callRpc("record_vendor_order", {
      p_business_id: businessId(), p_vendor_id: vendor, p_amount: 300, p_paid: false,
      p_received_by_type: "worker", p_actor_type: "worker", p_actor_name: "בדיקה",
    });
    callRpc("record_vendor_payment", {
      p_business_id: businessId(), p_vendor_id: vendor, p_vendor_order_id: orderId,
      p_amount: 300, p_method: "cash", p_paid_by_type: "worker", p_actor_type: "worker", p_actor_name: "בדיקה",
    });
    const { error } = callRpc("delete_vendor_order", {
      p_business_id: businessId(), p_order_id: orderId, p_actor_type: "worker", p_actor_name: "בדיקה",
    });
    expect(error?.message).toBe("DEBT_PAYMENT_EXISTS");
  });

  it("leaves the debt unchanged after a bill is created and deleted", () => {
    const vendor = vendorId();
    const before = vendorDebt(vendor);
    const { data: orderId } = callRpc("record_vendor_order", {
      p_business_id: businessId(), p_vendor_id: vendor, p_amount: 450, p_paid: false,
      p_received_by_type: "worker", p_actor_type: "worker", p_actor_name: "בדיקה",
    });
    expect(vendorDebt(vendor)).toBeCloseTo(before + 450, 2);
    callRpc("delete_vendor_order", {
      p_business_id: businessId(), p_order_id: orderId, p_actor_type: "worker", p_actor_name: "בדיקה",
    });
    expect(vendorDebt(vendor)).toBeCloseTo(before, 2);
  });
});

describe("sequences and pricing helpers", () => {
  it("hands out order numbers without repeating", () => {
    const seen = new Set<number>();
    for (let i = 0; i < 5; i++) {
      seen.add(Number(callRpc("take_order_number", { p_business_id: businessId() }).data));
    }
    expect(seen.size).toBe(5);
  });

  it("resolves the customer price, falling back to the list price", () => {
    const override = table("customer_product_prices")[0];
    if (override) {
      const { data } = callRpc("get_customer_product_price", {
        p_customer_id: override.customer_id, p_product_id: override.product_id,
      });
      expect(data).toBe(Number(override.price));
    }
    const product = table("products")[0]!;
    const { data: listPrice } = callRpc("get_customer_product_price", {
      p_customer_id: "nobody", p_product_id: product.id,
    });
    expect(listPrice).toBe(Number(product.default_price));
  });
});
