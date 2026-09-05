/**
 * Pure guard for vendor debt payments — the client-side mirror of
 * assert_vendor_payment_within_debt() in migration 0026. The database is
 * what actually enforces this (two workers can pay at once); this is here
 * so the kiosk can say no before the round trip.
 */

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export type VendorPaymentCheck = {
  /**
   * The vendor's current debt, or null for a vendor whose bills we don't
   * track (the kiosk's "ספק אחר") — those are uncapped, there is nothing
   * to compare against.
   */
  debt: number | null;
  /**
   * When editing an existing payment, the amount it currently books.
   * That amount already came off the debt, so it is available again.
   */
  currentAmount?: number;
};

/** The most that may be paid, or null when uncapped. */
export function vendorPaymentCap(check: VendorPaymentCheck): number | null {
  if (check.debt === null) return null;
  return round2(check.debt + (check.currentAmount ?? 0));
}

/** Hebrew error for an unacceptable amount, or null when it is fine. */
export function vendorPaymentError(
  amount: number,
  check: VendorPaymentCheck
): string | null {
  if (!Number.isFinite(amount) || amount <= 0) return "יש להזין סכום";

  const cap = vendorPaymentCap(check);
  if (cap === null) return null;
  if (cap <= 0) return "לספק אין חוב פתוח";
  if (round2(amount) > cap) return "הסכום גבוה מהחוב לספק";
  return null;
}
