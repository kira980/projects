/**
 * Vendor categories. These are the exact values the DB check constraint
 * accepts (migration 0025) — adding one means changing that constraint.
 *
 * מקרר is the fridge shelf: dairy, נקניקים, and anything else that arrives
 * refrigerated.
 */
export const VENDOR_CATEGORIES = [
  "חומרי גלם",
  "מקרר",
  "שמרים ועוגות",
  "סיגריות",
  "שתייה",
  "אריזות",
  "אחר",
] as const;

export type VendorCategory = (typeof VENDOR_CATEGORIES)[number];

export function isVendorCategory(value: string): value is VendorCategory {
  return (VENDOR_CATEGORIES as readonly string[]).includes(value);
}
