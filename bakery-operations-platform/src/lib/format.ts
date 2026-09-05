const TZ = "Asia/Jerusalem";

export function formatMoney(amount: number | string | null | undefined) {
  const n = Number(amount ?? 0);
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 2,
    minimumFractionDigits: n % 1 === 0 ? 0 : 2,
  }).format(n);
}

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

export function formatTime(value: string | Date | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "—";
  return `${formatDate(value)} ${formatTime(value)}`;
}

/** Israel-local YYYY-MM-DD for an instant — for <input type="date">. */
export function toDateInput(value: string | Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(
    new Date(value)
  );
}

/** Israel-local HH:MM (24h) for an instant — for <input type="time">. */
export function toTimeInput(value: string | Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
}

/** "3:25" style duration between two timestamps (or now). */
export function formatHours(start: string | Date, end?: string | Date | null) {
  const ms =
    new Date(end ?? Date.now()).getTime() - new Date(start).getTime();
  if (ms < 0) return "—";
  const totalMinutes = Math.floor(ms / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}
