import { describe, it, expect } from "vitest";
import {
  clampPrepared,
  isValidPrepared,
  computeShortageItem,
  computeShortageOrder,
} from "./shortage";

describe("clampPrepared", () => {
  it("clamps below 0 to 0 and above ordered to ordered", () => {
    expect(clampPrepared(-5, 10)).toBe(0);
    expect(clampPrepared(15, 10)).toBe(10);
    expect(clampPrepared(4, 10)).toBe(4);
  });
});

describe("isValidPrepared", () => {
  it("accepts 0..ordered, rejects outside", () => {
    expect(isValidPrepared(0, 10)).toBe(true);
    expect(isValidPrepared(10, 10)).toBe(true);
    expect(isValidPrepared(-1, 10)).toBe(false);
    expect(isValidPrepared(11, 10)).toBe(false);
    expect(isValidPrepared(NaN, 10)).toBe(false);
  });
});

describe("computeShortageItem", () => {
  it("computes missing quantity and recomputes line total from prepared", () => {
    const r = computeShortageItem({ orderedQuantity: 10, preparedQuantity: 7, unitPrice: 1.5 });
    expect(r.missingQuantity).toBe(3);
    expect(r.lineTotal).toBe(10.5);
    expect(r.originalLineTotal).toBe(15);
  });

  it("no shortage when fully prepared", () => {
    const r = computeShortageItem({ orderedQuantity: 5, preparedQuantity: 5, unitPrice: 8 });
    expect(r.missingQuantity).toBe(0);
    expect(r.lineTotal).toBe(40);
  });
});

describe("computeShortageOrder", () => {
  it("sums totals and flags shortage", () => {
    const res = computeShortageOrder([
      { orderedQuantity: 10, preparedQuantity: 7, unitPrice: 1.5 }, // 10.5
      { orderedQuantity: 2, preparedQuantity: 2, unitPrice: 8 }, // 16
    ]);
    expect(res.originalTotal).toBe(31);
    expect(res.updatedTotal).toBe(26.5);
    expect(res.hasShortage).toBe(true);
  });

  it("no shortage keeps totals equal", () => {
    const res = computeShortageOrder([
      { orderedQuantity: 3, preparedQuantity: 3, unitPrice: 12 },
    ]);
    expect(res.originalTotal).toBe(36);
    expect(res.updatedTotal).toBe(36);
    expect(res.hasShortage).toBe(false);
  });
});
