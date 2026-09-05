import { describe, it, expect } from "vitest";
import {
  formatDeliveryPublicId,
  normalizeDeliveryIdQuery,
  quotationFilename,
} from "./public-id";

describe("formatDeliveryPublicId", () => {
  it("zero-pads to 6 digits", () => {
    expect(formatDeliveryPublicId(1)).toBe("D-000001");
    expect(formatDeliveryPublicId(123)).toBe("D-000123");
    expect(formatDeliveryPublicId(1234567)).toBe("D-1234567");
  });
});

describe("normalizeDeliveryIdQuery", () => {
  it("uppercases and strips noise", () => {
    expect(normalizeDeliveryIdQuery(" d-123 ")).toBe("D-123");
    expect(normalizeDeliveryIdQuery("D000123")).toBe("D000123");
    expect(normalizeDeliveryIdQuery("  ")).toBeNull();
    expect(normalizeDeliveryIdQuery("!!")).toBeNull();
  });
});

describe("quotationFilename", () => {
  it("uses the delivery id", () => {
    expect(quotationFilename("D-000123", 1005)).toBe("quotation-D-000123");
  });
  it("falls back to order number", () => {
    expect(quotationFilename(null, 1005)).toBe("quotation-order-1005");
    expect(quotationFilename("  ", 1005)).toBe("quotation-order-1005");
  });
});
