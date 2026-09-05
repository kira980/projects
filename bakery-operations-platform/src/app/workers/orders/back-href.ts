/**
 * Back link from a printable document to the order list it was opened
 * from — same day, same tab (איסוף עצמי / משלוח).
 */
export function ordersBackHref(
  date: string | undefined,
  type: string | undefined
): string {
  const params = new URLSearchParams();
  if (/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) params.set("date", date!);
  params.set("type", type === "delivery" ? "delivery" : "takeaway");
  return `/workers/orders?${params}`;
}
