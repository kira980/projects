import type { SupabaseClient } from "@/lib/demo-backend/types";

/**
 * MONEY day. The bakery trades past midnight and closes ~01:00–02:00, so a
 * business day runs from 02:00 Israel time to 02:00 the next day — the
 * register counted at 01:10 still closes the night that just traded.
 *
 * 02:00 is the one quiet moment in the bakery's clock: the night crew's
 * last clock-out lands by 01:21 and the morning crew's first clock-in is
 * 02:55, so nothing is ever cut in half by it.
 */
export const BUSINESS_DAY_START_HOUR = 2;

/**
 * SHIFT day. A shift belongs to the day it started, except that anything
 * from 21:00 onward is the next day's work — the night crew comes in late
 * in the evening to bake tomorrow's bread.
 *
 * Kept separate from the money day on purpose: the two answer different
 * questions, and merging them either files the night crew a day early or
 * splits one trading night's cash across two days.
 */
export const SHIFT_DAY_END_HOUR = 21;

/** Israel-local date (YYYY-MM-DD) of an instant, offset by `hours` first. */
function localDate(value: string | number | Date, hours: number): string {
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(
    new Date(ms + hours * 3600_000)
  );
}

/** The money business day (YYYY-MM-DD) a given instant belongs to. */
export function businessDayOf(value: string | number | Date): string {
  // Shift the instant back by the start hour so the date rolls over at
  // 02:00 local rather than midnight.
  return localDate(value, -BUSINESS_DAY_START_HOUR);
}

/** Current business-day date (Israel), flipping at 02:00, as YYYY-MM-DD. */
export function businessToday(): string {
  return businessDayOf(Date.now());
}

/** The shift day a clock-in belongs to — 21:00 onward counts as tomorrow. */
export function shiftDayOf(value: string | number | Date): string {
  return localDate(value, 24 - SHIFT_DAY_END_HOUR);
}

/** The shift day happening right now, as YYYY-MM-DD. */
export function shiftToday(): string {
  return shiftDayOf(Date.now());
}

/** UTC instant of Israel-local midnight starting `date`. */
function jerusalemMidnight(date: string): Date {
  // Israel is UTC+2 or UTC+3; scan candidates to find the UTC instant of
  // local midnight for `date`.
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" });
  let midnight = new Date(Date.parse(`${date}T00:00:00Z`) - 3 * 3600_000);
  while (fmt.format(midnight) < date) {
    midnight = new Date(midnight.getTime() + 15 * 60_000);
  }
  return midnight;
}

/**
 * UTC ISO range [start, end) covering the given MONEY business day — from
 * 02:00 Israel time on `date` to 02:00 the next day. Used to filter
 * timestamptz columns (payments, advances, goods…) by business day.
 */
export function jerusalemDayRange(date: string): { start: string; end: string } {
  const start = new Date(
    jerusalemMidnight(date).getTime() + BUSINESS_DAY_START_HOUR * 3600_000
  );
  return {
    start: start.toISOString(),
    end: new Date(start.getTime() + 24 * 3600_000).toISOString(),
  };
}

/**
 * UTC ISO range [start, end) covering the given SHIFT day — from 21:00 the
 * evening before to 21:00 on `date`, so a night crew clocking in at 22:00
 * is filed under the day they are baking for.
 */
export function shiftDayRange(date: string): { start: string; end: string } {
  const start = new Date(
    jerusalemMidnight(date).getTime() - (24 - SHIFT_DAY_END_HOUR) * 3600_000
  );
  return {
    start: start.toISOString(),
    end: new Date(start.getTime() + 24 * 3600_000).toISOString(),
  };
}

/** Offset (ms) between Israel local time and UTC at the given instant. */
function jerusalemOffsetMs(utcMs: number): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(utcMs));
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "00";
  const asIfUtc = Date.parse(
    `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}Z`
  );
  return asIfUtc - utcMs;
}

/**
 * UTC ISO instant for an Israel-local date + HH:MM — the inverse of the
 * `toDateInput` / `toTimeInput` formatters, so admin-entered clock times
 * round-trip correctly across DST.
 */
export function jerusalemInstant(date: string, time: string): string {
  const naive = Date.parse(`${date}T${time}:00Z`);
  if (isNaN(naive)) throw new Error("שעה לא תקינה");
  // Guess with the naive instant's offset, then refine once — a second
  // pass settles the rare case of a DST change between the two.
  let utc = naive - jerusalemOffsetMs(naive);
  utc = naive - jerusalemOffsetMs(utc);
  return new Date(utc).toISOString();
}

/** Furthest back a clock reading may be taken to mean, for a clock-in. */
export const MAX_CLOCK_BACKDATE_HOURS = 12;

/**
 * UTC instant for TODAY's occurrence of the Israel-local clock reading
 * `time` (HH:MM), or null when that moment has not arrived yet.
 *
 * A clock reading is always recorded after the fact, so a time still ahead
 * of the clock is a mistake, and the only safe thing to do is say so.
 *
 * This used to answer "the most recent moment it read `time`", silently
 * falling back to yesterday. That turned a manager typing the shift's
 * scheduled start a few minutes early — 18:20 at 18:16, which they did
 * daily — into a shift filed a full 24 hours before it happened, and a
 * 12-hour shift that read as 36. It cost 25 of 461 clock actions before
 * anyone noticed, because nothing on screen ever showed the date it chose.
 * The caller now reports the problem instead of the code guessing.
 */
export function localInstantToday(
  time: string,
  now = Date.now()
): string | null {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" })
    .format(new Date(now));
  const candidate = jerusalemInstant(today, time);
  return Date.parse(candidate) <= now ? candidate : null;
}

/** True when the given date is not locked for the business. */
export async function checkDayIsOpen(
  supabase: SupabaseClient,
  businessId: string,
  date?: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("day_locks")
    .select("id")
    .eq("business_id", businessId)
    .eq("lock_date", date ?? businessToday())
    .eq("is_locked", true)
    .maybeSingle();

  if (error) {
    // Fail closed: if we can't verify, block financial writes.
    console.error("day lock check failed:", error.message);
    return false;
  }
  return data === null;
}

/**
 * Guard for financial writes. Throws a Hebrew user-facing error
 * when the day is locked.
 */
export async function assertDayIsOpen(
  supabase: SupabaseClient,
  businessId: string,
  date?: string
): Promise<void> {
  const open = await checkDayIsOpen(supabase, businessId, date);
  if (!open) {
    throw new Error("היום נעול — לא ניתן לבצע פעולות כספיות. פנה למנהל.");
  }
}

/**
 * A shift longer than this is overtime. Anything past it is marked in the
 * daily board and totalled per worker in the monthly report — the bakery's
 * normal shift is twelve hours, so the excess is what gets paid attention.
 */
export const LONG_SHIFT_HOURS = 12;

/** Hours worked past LONG_SHIFT_HOURS in one shift; 0 when within it. */
export function overtimeHours(
  startedAt: string,
  endedAt: string | null
): number {
  if (!endedAt) return 0;
  const hours =
    (Date.parse(endedAt) - Date.parse(startedAt)) / 3600_000 - LONG_SHIFT_HOURS;
  return hours > 0 ? hours : 0;
}
