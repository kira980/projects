import { businessToday } from "@/lib/db/day-lock";

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function normalizeDate(value?: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value ?? "") ? value! : businessToday();
}

/** "YYYY-MM" of the current business month, or the given valid value. */
export function normalizeMonth(value?: string): string {
  return /^\d{4}-\d{2}$/.test(value ?? "")
    ? value!
    : businessToday().slice(0, 7);
}

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

/** [start, end) date strings covering a month. */
export function monthDateRange(month: string): { start: string; end: string } {
  return { start: `${month}-01`, end: `${addMonths(month, 1)}-01` };
}

export type ReportPeriod = "daily" | "monthly" | "all";

export function normalizePeriod(value?: string): ReportPeriod {
  // Daily is the default everywhere — owners live in "today" first.
  return value === "monthly" || value === "all" ? value : "daily";
}

/**
 * Date range for a report period. `dateOrMonth` is a YYYY-MM-DD for
 * "daily" or a YYYY-MM for "monthly" — ignored for "all".
 * "all" returns start: null (no lower bound).
 */
export function resolveReportRange(
  period: ReportPeriod,
  dateOrMonth?: string
): { start: string | null; end: string } {
  if (period === "daily") {
    const date = normalizeDate(dateOrMonth);
    return { start: date, end: addDays(date, 1) };
  }
  if (period === "all") {
    return { start: null, end: addDays(businessToday(), 1) };
  }
  const month = normalizeMonth(dateOrMonth);
  return monthDateRange(month);
}
