/**
 * Month-grid arithmetic for the date pickers. Everything is done in UTC on
 * "YYYY-MM" / "YYYY-MM-DD" strings, so no local timezone or DST shift can
 * move a day into the wrong cell.
 */

export const DAY_NAMES = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

export const MONTH_NAMES = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
];

/** "YYYY-MM" `delta` months from `ym` — may cross years. */
export function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Hebrew month + year for a "YYYY-MM", e.g. "יולי 2026". */
export function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  return `${MONTH_NAMES[Number(m) - 1]} ${y}`;
}

/**
 * The days of `ym` as YYYY-MM-DD, preceded by nulls so the 1st sits under
 * its weekday (the grid starts on Sunday, like the Hebrew week).
 */
export function monthGrid(ym: string): (string | null)[] {
  const [y, m] = ym.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (string | null)[] = Array(first.getUTCDay()).fill(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(`${ym}-${String(day).padStart(2, "0")}`);
  }
  return cells;
}

/** YYYY-MM-DD `delta` days from `date`. */
export function shiftDate(date: string, delta: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
