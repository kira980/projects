import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { businessToday, shiftDayOf, shiftDayRange } from "@/lib/db/day-lock";
import { addDays } from "@/lib/reports";
import { formatHours, toTimeInput } from "@/lib/format";
import { HoursEditor, type EditorRow, type EditorShift } from "./hours-editor";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Longest range the by-worker grid will draw at once. */
const MAX_DAYS = 62;

function normalize(value: string | undefined, fallback: string): string {
  return DATE_RE.test(value ?? "") ? value! : fallback;
}

/** "ראשון 12.05" — the day column in by-worker mode. */
function dayLabel(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  const weekday = new Intl.DateTimeFormat("he-IL", { weekday: "long" }).format(d);
  const short = new Intl.DateTimeFormat("he-IL", {
    day: "2-digit",
    month: "2-digit",
  }).format(d);
  return `${weekday} ${short}`;
}

type ShiftRow = { id: string; worker_id: string; started_at: string; ended_at: string | null };

function toEditorShift(s: ShiftRow): EditorShift {
  return {
    id: s.id,
    startTime: toTimeInput(s.started_at),
    endTime: s.ended_at ? toTimeInput(s.ended_at) : null,
    hoursLabel: s.ended_at ? formatHours(s.started_at, s.ended_at) : "",
  };
}

/**
 * שעות — where the gaps the clock left get filled.
 *
 * By day (the default): every active worker on one day, so a whole day can
 * be entered or corrected in one pass. By worker: one person across a
 * range of days.
 */
export async function HoursView({
  searchParams,
}: {
  searchParams: Promise<{
    mode?: string;
    worker?: string;
    date?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const sp = await searchParams;
  const admin = await requireAdmin();
  const supabase = await createClient();

  const mode = sp.mode === "worker" ? "worker" : "day";
  const today = businessToday();
  const date = normalize(sp.date, today);
  const from = normalize(sp.from, addDays(today, -6));
  const toRaw = normalize(sp.to, today);
  // A range typed backwards would draw nothing at all; clamp it instead.
  const to = toRaw < from ? from : toRaw;

  const { data: workers } = await supabase
    .from("workers")
    .select("id, full_name, is_active")
    .eq("business_id", admin.business_id)
    .order("is_active", { ascending: false })
    .order("full_name");

  const workerId =
    sp.worker && (workers ?? []).some((w) => w.id === sp.worker)
      ? sp.worker
      : "";

  let rows: EditorRow[] = [];

  if (mode === "day") {
    // One line per active worker, whether or not they clocked anything —
    // a worker with no shift is exactly the case that needs adding one.
    const { start, end } = shiftDayRange(date);
    const { data: shifts } = await supabase
      .from("worker_shifts")
      .select("id, worker_id, started_at, ended_at")
      .eq("business_id", admin.business_id)
      .gte("started_at", start)
      .lt("started_at", end)
      .order("started_at");

    // Anyone still on shift from an earlier day belongs on TODAY's screen
    // too — that open shift is the one most likely to need stopping. On a
    // past day it would be an intruder: a shift running now has nothing to
    // do with a day that is already over.
    const { data: openShifts } =
      date === today
        ? await supabase
            .from("worker_shifts")
            .select("id, worker_id, started_at, ended_at")
            .eq("business_id", admin.business_id)
            .is("ended_at", null)
            .lt("started_at", start)
        : { data: [] as ShiftRow[] };

    const byWorker = new Map<string, EditorShift[]>();
    for (const s of [...(shifts ?? []), ...(openShifts ?? [])]) {
      byWorker.set(s.worker_id, [
        ...(byWorker.get(s.worker_id) ?? []),
        toEditorShift(s),
      ]);
    }

    rows = (workers ?? [])
      .filter((w) => w.is_active || byWorker.has(w.id))
      .map((w) => ({
        workerId: w.id,
        date,
        label: w.full_name,
        shifts: byWorker.get(w.id) ?? [],
      }))
      // Whoever actually worked that day comes first — those are the rows
      // being read and corrected. The rest of the roster stays below, in
      // its own order, for the day somebody's shift was never clocked.
      .sort((a, b) => Number(b.shifts.length > 0) - Number(a.shifts.length > 0));
  } else if (workerId) {
    const dates: string[] = [];
    for (let d = from; d <= to && dates.length < MAX_DAYS; d = addDays(d, 1)) {
      dates.push(d);
    }

    const { data: shifts } = dates.length
      ? await supabase
          .from("worker_shifts")
          .select("id, worker_id, started_at, ended_at")
          .eq("business_id", admin.business_id)
          .eq("worker_id", workerId)
          .gte("started_at", shiftDayRange(dates[0]).start)
          .lt("started_at", shiftDayRange(dates[dates.length - 1]).end)
          .order("started_at")
      : { data: [] as ShiftRow[] };

    const byDay = new Map<string, EditorShift[]>();
    for (const s of shifts ?? []) {
      const day = shiftDayOf(s.started_at);
      byDay.set(day, [...(byDay.get(day) ?? []), toEditorShift(s)]);
    }

    rows = dates.map((d) => ({
      workerId,
      date: d,
      label: dayLabel(d),
      shifts: byDay.get(d) ?? [],
    }));
  }

  return (
    <HoursEditor
      mode={mode}
      workers={workers ?? []}
      workerId={workerId}
      date={date}
      from={from}
      to={to}
      rows={rows}
    />
  );
}
