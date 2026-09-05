import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  jerusalemDayRange,
  shiftDayOf,
  shiftDayRange,
  overtimeHours,
  LONG_SHIFT_HOURS,
} from "@/lib/db/day-lock";
import {
  normalizeMonth,
  normalizeDate,
  normalizePeriod,
  resolveReportRange,
  addMonths,
  addDays,
} from "@/lib/reports";
import { formatMoney, formatTime, formatDateTime, toTimeInput } from "@/lib/format";
import { ReportNav } from "@/components/report-nav";
import { PeriodFilter } from "@/components/period-filter";
import { ExportCsvButton } from "@/components/export-csv-button";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ShiftEditRow } from "./shift-edit-row";
import { AdvanceEditRow } from "./advance-edit-row";

function fmtHours(h: number): string {
  const mins = Math.round(h * 60);
  return `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, "0")}`;
}

export async function WorkersReport({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; month?: string; date?: string }>;
}) {
  const { period: periodParam, month: monthParam, date: dateParam } = await searchParams;
  const admin = await requireAdmin();
  const supabase = await createClient();

  const period = normalizePeriod(periodParam);
  const month = normalizeMonth(monthParam);
  const date = normalizeDate(dateParam);
  const { start, end } = resolveReportRange(period, period === "daily" ? date : month);
  // Shifts follow the shift day (21:00 onward is the next day); money —
  // advances, vendor payments — follows the money day.
  const shiftStart = start ? shiftDayRange(start).start : null;
  const shiftEnd = shiftDayRange(end).start;
  const tsStart = start ? jerusalemDayRange(start).start : null;
  const tsEnd = jerusalemDayRange(end).start;

  let shiftsQuery = supabase
    .from("worker_shifts")
    .select("id, worker_id, started_at, ended_at")
    .eq("business_id", admin.business_id)
    .lt("started_at", shiftEnd)
    .order("started_at");
  if (shiftStart) shiftsQuery = shiftsQuery.gte("started_at", shiftStart);

  let advancesQuery = supabase
    .from("worker_advances")
    .select("id, worker_id, amount, method, taken_at, given_by_type, given_by_id, notes")
    .eq("business_id", admin.business_id)
    .lt("taken_at", tsEnd)
    .order("taken_at", { ascending: false });
  if (tsStart) advancesQuery = advancesQuery.gte("taken_at", tsStart);

  const [{ data: workers }, { data: shifts }, { data: advances }, { data: profiles }] =
    await Promise.all([
      supabase
        .from("workers")
        .select("id, full_name, hourly_rate, pay_type, monthly_rate, daily_rate")
        .eq("business_id", admin.business_id)
        .order("full_name"),
      shiftsQuery,
      advancesQuery,
      supabase
        .from("profiles")
        .select("id, full_name")
        .eq("business_id", admin.business_id),
    ]);

  const workerNames = new Map((workers ?? []).map((w) => [w.id, w.full_name]));
  const adminNames = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  function givenByName(type: string, id: string | null): string {
    if (!id) return "—";
    if (type === "worker") return workerNames.get(id) ?? "—";
    if (type === "admin") return adminNames.get(id) ?? "מנהל";
    return "מערכת";
  }

  const hoursByWorker = new Map<string, number>();
  // Hours past LONG_SHIFT_HOURS in a single shift, and how many shifts ran
  // that long — the pair the owner reads together when settling overtime.
  const overtimeByWorker = new Map<string, number>();
  const longShiftsByWorker = new Map<string, number>();
  const shiftCount = new Map<string, number>();
  const openShiftByWorker = new Map<string, string>();
  // Distinct business days with a closed shift — for daily-paid workers.
  const daysByWorker = new Map<string, Set<string>>();
  for (const s of shifts ?? []) {
    if (!s.ended_at) {
      openShiftByWorker.set(s.worker_id, s.started_at);
      continue;
    }
    const hours =
      (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) /
      3600_000;
    hoursByWorker.set(
      s.worker_id,
      (hoursByWorker.get(s.worker_id) ?? 0) + Math.max(0, hours)
    );
    shiftCount.set(s.worker_id, (shiftCount.get(s.worker_id) ?? 0) + 1);
    const over = overtimeHours(s.started_at, s.ended_at);
    if (over > 0) {
      overtimeByWorker.set(
        s.worker_id,
        (overtimeByWorker.get(s.worker_id) ?? 0) + over
      );
      longShiftsByWorker.set(
        s.worker_id,
        (longShiftsByWorker.get(s.worker_id) ?? 0) + 1
      );
    }
    const day = shiftDayOf(s.started_at);
    if (!daysByWorker.has(s.worker_id)) daysByWorker.set(s.worker_id, new Set());
    daysByWorker.get(s.worker_id)!.add(day);
  }
  const advancesByWorker = new Map<string, number>();
  for (const a of advances ?? []) {
    advancesByWorker.set(
      a.worker_id,
      (advancesByWorker.get(a.worker_id) ?? 0) + Number(a.amount)
    );
  }
  const totalAdvances = (advances ?? []).reduce((s, a) => s + Number(a.amount), 0);

  const nav = (
    <div className="flex flex-wrap items-center gap-3">
      <PeriodFilter basePath="/dashboard/workers" period={period} />
      {period === "monthly" && (
        <ReportNav
          basePath="/dashboard/workers"
          extraParams={{ period: "monthly" }}
          param="month"
          current={month}
          prev={addMonths(month, -1)}
          next={addMonths(month, 1)}
          label={month}
        />
      )}
      {period === "daily" && (
        <ReportNav
          basePath="/dashboard/workers"
          param="date"
          current={date}
          prev={addDays(date, -1)}
          next={addDays(date, 1)}
          label={date}
        />
      )}
    </div>
  );

  // ── Daily view: attendance, per-worker summary, advances detail ──
  if (period === "daily") {
    const dayShifts = shifts ?? [];
    const totalDayHours = dayShifts.reduce((sum, s) => {
      if (!s.ended_at) return sum;
      return (
        sum +
        Math.max(
          0,
          (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) /
            3600_000
        )
      );
    }, 0);

    // Vendor bills paid by shift managers during the day.
    const [{ data: vendorPayments }, { data: vendors }] = await Promise.all([
      supabase
        .from("vendor_payments")
        .select("vendor_id, amount, method, paid_at, paid_by_id")
        .eq("business_id", admin.business_id)
        .eq("paid_by_type", "worker")
        .gte("paid_at", tsStart ?? "1970-01-01")
        .lt("paid_at", tsEnd)
        .order("paid_at", { ascending: false }),
      supabase
        .from("vendors")
        .select("id, name")
        .eq("business_id", admin.business_id),
    ]);
    const vendorNames = new Map((vendors ?? []).map((v) => [v.id, v.name]));
    const totalVendorPaid = (vendorPayments ?? []).reduce(
      (s, p) => s + Number(p.amount),
      0
    );

    return (
      <div className="grid gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">דוח עובדים — יומי</h1>
          {nav}
        </div>

        <section className="grid gap-3">
          <h2 className="text-lg font-semibold">שעון נוכחות</h2>
          <div className="rounded-lg border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>עובד</TableHead>
                  <TableHead>כניסה</TableHead>
                  <TableHead>יציאה</TableHead>
                  <TableHead>סה&quot;כ שעות</TableHead>
                  <TableHead className="w-24">עדכון</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dayShifts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-16 text-center text-muted-foreground">
                      אין משמרות ביום זה
                    </TableCell>
                  </TableRow>
                )}
                {dayShifts.map((s) => {
                  const hours = s.ended_at
                    ? Math.max(
                        0,
                        (new Date(s.ended_at).getTime() -
                          new Date(s.started_at).getTime()) /
                          3600_000
                      )
                    : null;
                  return (
                    <ShiftEditRow
                      key={s.id}
                      shift={{
                        id: s.id,
                        startTime: toTimeInput(s.started_at),
                        endTime: s.ended_at ? toTimeInput(s.ended_at) : null,
                        hoursLabel: hours !== null ? fmtHours(hours) : "—",
                      }}
                      leading={
                        <TableCell>
                          <Link
                            href={`/dashboard/workers/${s.worker_id}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {workerNames.get(s.worker_id) ?? "—"}
                          </Link>
                        </TableCell>
                      }
                    />
                  );
                })}
              </TableBody>
              {dayShifts.length > 0 && (
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={3}>סה&quot;כ</TableCell>
                    <TableCell className="font-bold">{fmtHours(totalDayHours)}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </div>
        </section>

        <section className="grid gap-3">
          <h2 className="text-lg font-semibold">תשלומים לספקים ע&quot;י אחראי משמרת</h2>
          <div className="rounded-lg border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>עובד</TableHead>
                  <TableHead>ספק</TableHead>
                  <TableHead>סכום</TableHead>
                  <TableHead>מתי</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(vendorPayments ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="h-16 text-center text-muted-foreground">
                      אין תשלומים לספקים ע&quot;י עובדים ביום זה
                    </TableCell>
                  </TableRow>
                )}
                {(vendorPayments ?? []).map((p, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      {p.paid_by_id ? (
                        <Link
                          href={`/dashboard/workers/${p.paid_by_id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {workerNames.get(p.paid_by_id) ?? "—"}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>{vendorNames.get(p.vendor_id) ?? "—"}</TableCell>
                    <TableCell className="font-medium">
                      {formatMoney(Number(p.amount))}
                    </TableCell>
                    <TableCell>{formatTime(p.paid_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              {(vendorPayments ?? []).length > 0 && (
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={2}>סה&quot;כ</TableCell>
                    <TableCell className="font-bold">
                      {formatMoney(totalVendorPaid)}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </div>
        </section>

        <section className="grid gap-3">
          <h2 className="text-lg font-semibold">מפרעות</h2>
          <div className="rounded-lg border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>עובד</TableHead>
                  <TableHead>מתי</TableHead>
                  <TableHead>סכום</TableHead>
                  <TableHead>ניתן ע&quot;י</TableHead>
                  <TableHead>הערה</TableHead>
                  <TableHead className="w-24">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(advances ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-16 text-center text-muted-foreground">
                      אין מפרעות ביום זה
                    </TableCell>
                  </TableRow>
                )}
                {(advances ?? []).map((a) => (
                  <AdvanceEditRow
                    key={a.id}
                    advance={{
                      id: a.id,
                      amount: Number(a.amount),
                      workerName: workerNames.get(a.worker_id) ?? null,
                    }}
                    leading={
                      <>
                        <TableCell>
                          <Link
                            href={`/dashboard/workers/${a.worker_id}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {workerNames.get(a.worker_id) ?? "—"}
                          </Link>
                        </TableCell>
                        <TableCell>{formatDateTime(a.taken_at)}</TableCell>
                      </>
                    }
                    trailing={
                      <>
                        <TableCell>
                          {givenByName(a.given_by_type, a.given_by_id)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {a.notes ?? ""}
                        </TableCell>
                      </>
                    }
                  />
                ))}
              </TableBody>
              {(advances ?? []).length > 0 && (
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={2}>סה&quot;כ</TableCell>
                    <TableCell className="font-bold text-destructive">
                      {formatMoney(totalAdvances)}
                    </TableCell>
                    <TableCell colSpan={3} />
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </div>
        </section>
      </div>
    );
  }

  // ── Monthly / all-time view: per-worker aggregates ──
  const rows = (workers ?? [])
    .map((w) => {
      const hours = hoursByWorker.get(w.id) ?? 0;
      const days = daysByWorker.get(w.id)?.size ?? 0;
      const payType = (w.pay_type as string) ?? "hourly";
      const hourlyRate = w.hourly_rate ? Number(w.hourly_rate) : null;
      const monthlyRate = w.monthly_rate ? Number(w.monthly_rate) : null;
      const dailyRate = w.daily_rate ? Number(w.daily_rate) : null;
      // Hourly workers: hours × rate. Daily workers: days × rate.
      // Fixed-salary workers: the monthly rate applies per calendar
      // month, so only the monthly view can state it honestly.
      const salary =
        payType === "monthly"
          ? period === "monthly"
            ? monthlyRate
            : null
          : payType === "daily"
            ? dailyRate !== null
              ? days * dailyRate
              : null
            : hourlyRate !== null
              ? hours * hourlyRate
              : null;
      const advancesSum = advancesByWorker.get(w.id) ?? 0;
      return {
        id: w.id,
        name: w.full_name,
        shifts: shiftCount.get(w.id) ?? 0,
        hours,
        overtime: overtimeByWorker.get(w.id) ?? 0,
        longShifts: longShiftsByWorker.get(w.id) ?? 0,
        payType,
        rate:
          payType === "monthly"
            ? monthlyRate
            : payType === "daily"
              ? dailyRate
              : hourlyRate,
        salary,
        advances: advancesSum,
        net: salary !== null ? salary - advancesSum : null,
      };
    })
    .filter((r) => r.shifts > 0 || r.advances > 0);

  const totals = {
    hours: rows.reduce((s, r) => s + r.hours, 0),
    overtime: rows.reduce((s, r) => s + r.overtime, 0),
    salary: rows.reduce((s, r) => s + (r.salary ?? 0), 0),
    advances: rows.reduce((s, r) => s + r.advances, 0),
    net: rows.reduce((s, r) => s + (r.net ?? 0), 0),
  };

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">דוח עובדים ושכר</h1>
        <div className="flex flex-wrap items-center gap-3">
          {nav}
          <ExportCsvButton
            filename={`workers-${period === "all" ? "all" : month}.csv`}
            headers={["עובד", "משמרות", "שעות", `שעות מעל ${LONG_SHIFT_HOURS}`, "משמרות ארוכות", "סוג שכר", "תעריף", "אומדן שכר", "מפרעות", "נטו לתשלום"]}
            rows={rows.map((r) => [
              r.name,
              r.shifts,
              r.hours.toFixed(2),
              r.overtime.toFixed(2),
              r.longShifts,
              r.payType === "monthly" ? "חודשי" : r.payType === "daily" ? "יומי" : "שעתי",
              r.rate ?? "",
              r.salary?.toFixed(2) ?? "",
              r.advances,
              r.net?.toFixed(2) ?? "",
            ])}
          />
        </div>
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>עובד</TableHead>
              <TableHead>משמרות</TableHead>
              <TableHead>שעות</TableHead>
              <TableHead>שעות מעל {LONG_SHIFT_HOURS}</TableHead>
              <TableHead>סוג שכר</TableHead>
              <TableHead>תעריף</TableHead>
              <TableHead>אומדן שכר</TableHead>
              <TableHead>מפרעות</TableHead>
              <TableHead>נטו לתשלום</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="h-20 text-center text-muted-foreground">
                  אין נתונים לתקופה זו
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Link
                    href={`/dashboard/workers/${r.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {r.name}
                  </Link>
                </TableCell>
                <TableCell>{r.shifts}</TableCell>
                <TableCell>{fmtHours(r.hours)}</TableCell>
                <TableCell>
                  {r.overtime > 0 ? (
                    <span
                      className="font-bold text-destructive"
                      title={`${r.longShifts} משמרות מעל ${LONG_SHIFT_HOURS} שעות`}
                    >
                      {fmtHours(r.overtime)}
                      <span className="ms-1 text-xs font-normal">
                        ({r.longShifts})
                      </span>
                    </span>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>{r.payType === "monthly" ? "חודשי" : r.payType === "daily" ? "יומי" : "שעתי"}</TableCell>
                <TableCell>{r.rate !== null ? formatMoney(r.rate) : "—"}</TableCell>
                <TableCell>{r.salary !== null ? formatMoney(r.salary) : "—"}</TableCell>
                <TableCell className={r.advances > 0 ? "text-destructive" : ""}>
                  {formatMoney(r.advances)}
                </TableCell>
                <TableCell className="font-bold">
                  {r.net !== null ? formatMoney(r.net) : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          {rows.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2}>סה&quot;כ</TableCell>
                <TableCell className="font-bold">{fmtHours(totals.hours)}</TableCell>
                <TableCell className="font-bold text-destructive">
                  {totals.overtime > 0 ? fmtHours(totals.overtime) : "—"}
                </TableCell>
                <TableCell colSpan={2} />
                <TableCell className="font-bold">{formatMoney(totals.salary)}</TableCell>
                <TableCell className="font-bold text-destructive">
                  {formatMoney(totals.advances)}
                </TableCell>
                <TableCell className="font-bold">{formatMoney(totals.net)}</TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
      <p className="text-sm text-muted-foreground">
        * שעות מחושבות ממשמרות שהסתיימו בלבד. שכר חודשי קבוע מוצג בתצוגה
        חודשית בלבד.
      </p>
    </div>
  );
}
