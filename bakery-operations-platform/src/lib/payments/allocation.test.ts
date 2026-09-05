import { describe, it, expect } from "vitest";
import {
  withRemaining,
  outstandingOrders,
  selectedRemaining,
  allocatePayment,
  type PayableOrder,
} from "./allocation";

const orders: PayableOrder[] = [
  { id: "a", orderNumber: 1, total: 100, paid: 0 }, // remaining 100
  { id: "b", orderNumber: 2, total: 50, paid: 20 }, // remaining 30
  { id: "c", orderNumber: 3, total: 40, paid: 40 }, // paid -> excluded
];

describe("withRemaining / outstandingOrders", () => {
  it("computes remaining and excludes fully paid", () => {
    expect(withRemaining(orders[1]).remaining).toBe(30);
    expect(outstandingOrders(orders).map((o) => o.id)).toEqual(["a", "b"]);
  });
});

describe("selectedRemaining", () => {
  it("sums remaining of selected outstanding orders", () => {
    expect(selectedRemaining(orders, ["a", "b"])).toBe(130);
    expect(selectedRemaining(orders, ["b"])).toBe(30);
    expect(selectedRemaining(orders, ["c"])).toBe(0);
  });
});

describe("allocatePayment", () => {
  it("fills orders in order", () => {
    const r = allocatePayment(orders, ["a", "b"], 120);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.allocations).toEqual([
        { orderId: "a", amount: 100 },
        { orderId: "b", amount: 20 },
      ]);
    }
  });

  it("rejects overpayment", () => {
    const r = allocatePayment(orders, ["b"], 31);
    expect(r.ok).toBe(false);
  });

  it("rejects a paid/unknown order", () => {
    const r = allocatePayment(orders, ["c"], 10);
    expect(r.ok).toBe(false);
  });

  it("rejects empty selection and non-positive amount", () => {
    expect(allocatePayment(orders, [], 10).ok).toBe(false);
    expect(allocatePayment(orders, ["a"], 0).ok).toBe(false);
  });

  it("allows exact full payment of combined remaining", () => {
    const r = allocatePayment(orders, ["a", "b"], 130);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.total).toBe(130);
  });
});
