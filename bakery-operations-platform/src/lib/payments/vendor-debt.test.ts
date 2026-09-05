import { describe, it, expect } from "vitest";
import { vendorPaymentCap, vendorPaymentError } from "./vendor-debt";

describe("vendorPaymentCap", () => {
  it("caps at the debt", () => {
    expect(vendorPaymentCap({ debt: 250 })).toBe(250);
  });

  it("adds back the amount an edited payment already books", () => {
    expect(vendorPaymentCap({ debt: 100, currentAmount: 60 })).toBe(160);
  });

  it("leaves untracked vendors uncapped", () => {
    expect(vendorPaymentCap({ debt: null })).toBeNull();
  });
});

describe("vendorPaymentError", () => {
  it("rejects missing or negative amounts", () => {
    expect(vendorPaymentError(0, { debt: 100 })).toBe("יש להזין סכום");
    expect(vendorPaymentError(-5, { debt: 100 })).toBe("יש להזין סכום");
    expect(vendorPaymentError(NaN, { debt: 100 })).toBe("יש להזין סכום");
  });

  it("accepts up to the debt, including exactly", () => {
    expect(vendorPaymentError(99.99, { debt: 100 })).toBeNull();
    expect(vendorPaymentError(100, { debt: 100 })).toBeNull();
  });

  it("rejects overpayment", () => {
    expect(vendorPaymentError(100.01, { debt: 100 })).toBe(
      "הסכום גבוה מהחוב לספק"
    );
    expect(vendorPaymentError(500, { debt: 100 })).toBe("הסכום גבוה מהחוב לספק");
  });

  it("rejects any payment to a vendor with nothing outstanding", () => {
    expect(vendorPaymentError(10, { debt: 0 })).toBe("לספק אין חוב פתוח");
  });

  it("lets an edited payment keep or grow within its own amount", () => {
    const check = { debt: 0, currentAmount: 80 };
    expect(vendorPaymentError(80, check)).toBeNull();
    expect(vendorPaymentError(50, check)).toBeNull();
    expect(vendorPaymentError(81, check)).toBe("הסכום גבוה מהחוב לספק");
  });

  it("never blocks a vendor whose bills are not tracked", () => {
    expect(vendorPaymentError(9999, { debt: null })).toBeNull();
  });
});
