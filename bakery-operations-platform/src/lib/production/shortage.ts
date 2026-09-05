/**
 * Pure shortage math for production (status ناقص / "shortage").
 *
 * A shortage means the baker prepared fewer units than ordered. We keep
 * the original ordered quantity, record what was actually prepared, and
 * recompute line totals + order totals from the prepared amounts. Prices
 * per unit never change.
 */

export type ShortageItemInput = {
  /** Ordered quantity (the original). */
  orderedQuantity: number;
  /** What the baker actually prepared. */
  preparedQuantity: number;
  unitPrice: number;
};

export type ShortageItemResult = {
  originalQuantity: number;
  preparedQuantity: number;
  missingQuantity: number;
  /** Line total based on prepared quantity. */
  lineTotal: number;
  /** Line total based on the original ordered quantity. */
  originalLineTotal: number;
};

/** Clamp a prepared quantity into the valid [0, ordered] range. */
export function clampPrepared(preparedQuantity: number, orderedQuantity: number): number {
  if (!Number.isFinite(preparedQuantity) || preparedQuantity < 0) return 0;
  if (preparedQuantity > orderedQuantity) return orderedQuantity;
  return preparedQuantity;
}

/** True when the prepared quantity is a valid entry for the ordered quantity. */
export function isValidPrepared(preparedQuantity: number, orderedQuantity: number): boolean {
  return (
    Number.isFinite(preparedQuantity) &&
    preparedQuantity >= 0 &&
    preparedQuantity <= orderedQuantity
  );
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function computeShortageItem(item: ShortageItemInput): ShortageItemResult {
  const prepared = clampPrepared(item.preparedQuantity, item.orderedQuantity);
  const missing = round2(item.orderedQuantity - prepared);
  return {
    originalQuantity: item.orderedQuantity,
    preparedQuantity: prepared,
    missingQuantity: missing,
    lineTotal: round2(prepared * item.unitPrice),
    originalLineTotal: round2(item.orderedQuantity * item.unitPrice),
  };
}

export type ShortageOrderResult = {
  items: ShortageItemResult[];
  originalTotal: number;
  updatedTotal: number;
  hasShortage: boolean;
};

/** Recompute a whole order from prepared quantities. */
export function computeShortageOrder(items: ShortageItemInput[]): ShortageOrderResult {
  const results = items.map(computeShortageItem);
  const originalTotal = round2(
    results.reduce((sum, r) => sum + r.originalLineTotal, 0)
  );
  const updatedTotal = round2(results.reduce((sum, r) => sum + r.lineTotal, 0));
  const hasShortage = results.some((r) => r.missingQuantity > 0);
  return { items: results, originalTotal, updatedTotal, hasShortage };
}
