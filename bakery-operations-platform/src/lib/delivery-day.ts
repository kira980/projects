/**
 * The bakery's order-taking day rolls over at 06:00 (Asia/Jerusalem):
 * an order placed after 06:00 is for tomorrow's delivery, while an order
 * placed in the small hours (00:00–06:00) still belongs to the same
 * morning's delivery. Client-safe (no server-only imports).
 */

const CUTOFF_HOUR = 6;

function jerusalemNow(): Date {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" })
  );
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Delivery date currently being taken: before 06:00 → today, after → tomorrow. */
export function defaultDeliveryDate(): string {
  const now = jerusalemNow();
  if (now.getHours() >= CUTOFF_HOUR) now.setDate(now.getDate() + 1);
  return toIsoDate(now);
}

/** Today's date in Jerusalem (for "היום" quick chips). */
export function jerusalemToday(): string {
  return toIsoDate(jerusalemNow());
}

/** Tomorrow's date in Jerusalem (for "מחר" quick chips). */
export function jerusalemTomorrow(): string {
  const now = jerusalemNow();
  now.setDate(now.getDate() + 1);
  return toIsoDate(now);
}
