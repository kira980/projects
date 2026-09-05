import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { jerusalemDayRange, shiftDayOf, shiftDayRange } from "@/lib/db/day-lock";
import { normalizeMonth, addMonths, monthDateRange } from "@/lib/reports";
import { formatMoney } from "@/lib/format";
import { ReportNav } from "@/components/report-nav";
import { ExportCsvButton } from "@/components/export-csv-button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function fmtHours(h: number): string {
  const mins = Math.round(h * 60);
  return `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, "0")}`;
}

/**
 * Automatic monthly salary calculation. Hourly workers: closed-shift
 * hours × hourly rate. Fixed workers: their monthly rate. Net = salary −
 * advances taken this month.
 */
export async function SalariesView({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParam } = await searchParams;
  const admin = await requireAdmin();
  const supabase = await createClient();

  const month = normalizeMonth(monthParam);
  const { start, end } = monthDateRange(month);
  // Shifts are bounded by the shift day (21:00 onward is the next day),
  // advances by the money day — the two boundaries differ.
  const shiftStart = shiftDayRange(start).start;
  const shiftEnd = shiftDayRange(end).start;
  const tsStart = jerusalemDayRange(start).start;
  const tsEnd = jerusalemDayRange(end).start;

  const [{ data: workers }, { data: shifts }, { data: advances }] =
    await Promise.all([
      supabase
        .from("workers")
        .select("id, full_name, hourly_rate, pay_type, monthly_rate, daily_rate, is_active")
        .eq("business_id", admin.business_id)
        .eq("is_active", true)
        .order("full_name"),
      supabase
        .from("worker_shifts")
        .select("worker_id, started_at, ended_at")
        .eq("business_id", admin.business_id)
        .gte("started_at", shiftStart)
        .lt("started_at", shiftEnd),
      supabase
        .from("worker_advances")
        .select("worker_id, amount")
        .eq("business_id", admin.business_id)
        .gte("taken_at", tsStart)
        .lt("taken_at", tsEnd),
    ]);

  const hoursByWorker = new Map<string, number>();
  // Distinct business days a worker had a (closed) shift — for daily pay.
  const daysByWorker = new Map<string, Set<string>>();
  for (const s of shifts ?? []) {
    if (!s.ended_at) continue;
    const hours =
      (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) /
      3600_000;
    hoursByWorker.set(
      s.worker_id,
      (hoursByWorker.get(s.worker_id) ?? 0) + Math.max(0, hours)
    );
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

  const rows = (workers ?? []).map((w) => {
    // (filtered below to workers with activity this month)
    const hours = hoursByWorker.get(w.id) ?? 0;
    const days = daysByWorker.get(w.id)?.size ?? 0;
    const payType = (w.pay_type as string) ?? "hourly";
    const rate =
      payType === "monthly"
        ? w.monthly_rate !== null
          ? Number(w.monthly_rate)
          : null
        : payType === "daily"
          ? w.daily_rate !== null
            ? Number(w.daily_rate)
            : null
          : w.hourly_rate !== null
            ? Number(w.hourly_rate)
            : null;
    const salary =
      rate === null
        ? null
        : payType === "monthly"
          ? rate
          : payType === "daily"
            ? days * rate
            : hours * rate;
    const advancesSum = advancesByWorker.get(w.id) ?? 0;
    return {
      id: w.id,
      name: w.full_name,
      payType,
      hours,
      rate,
      salary,
      advances: advancesSum,
      net: salary !== null ? salary - advancesSum : null,
    };
  })
  // Only workers who actually worked (or took an advance) this month.
  .filter((r) => r.hours > 0 || r.advances > 0);

  const totals = {
    salary: rows.reduce((s, r) => s + (r.salary ?? 0), 0),
    advances: rows.reduce((s, r) => s + r.advances, 0),
    net: rows.reduce((s, r) => s + (r.net ?? 0), 0),
  };

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">משכורות</h1>
        <div className="flex flex-wrap items-center gap-3">
          <ReportNav
            basePath="/dashboard/workers"
            extraParams={{ view: "salaries" }}
            param="month"
            current={month}
            prev={addMonths(month, -1)}
            next={addMonths(month, 1)}
            label={month}
          />
          <ExportCsvButton
            filename={`salaries-${month}.csv`}
            headers={["עובד", "סוג שכר", "שעות בחודש", "תעריף", "שכר", "מפרעות", "נטו לתשלום"]}
            rows={rows.map((r) => [
              r.name,
              r.payType === "monthly" ? "חודשי" : r.payType === "daily" ? "יומי" : "שעתי",
              r.hours.toFixed(2),
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
              <TableHead>סוג שכר</TableHead>
              <TableHead>שעות בחודש</TableHead>
              <TableHead>תעריף</TableHead>
              <TableHead>שכר</TableHead>
              <TableHead>מפרעות</TableHead>
              <TableHead>נטו לתשלום</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-20 text-center text-muted-foreground">
                  אין עובדים פעילים
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
                <TableCell>
                  <Badge variant={r.payType === "monthly" ? "info" : "secondary"}>
                    {r.payType === "monthly"
                      ? "חודשי קבוע"
                      : r.payType === "daily"
                        ? "יומי"
                        : "שעתי"}
                  </Badge>
                </TableCell>
                <TableCell>{r.hours > 0 ? fmtHours(r.hours) : "—"}</TableCell>
                <TableCell>{r.rate !== null ? formatMoney(r.rate) : "—"}</TableCell>
                <TableCell className="font-medium">
                  {r.salary !== null ? formatMoney(r.salary) : "—"}
                </TableCell>
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
                <TableCell colSpan={4}>סה&quot;כ</TableCell>
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
        * שכר שעתי מחושב ממשמרות שהסתיימו בחודש שנבחר. עובד ללא תעריף מוצג
        ללא חישוב — אפשר להגדיר תעריף במסך הניהול.
      </p>
    </div>
  );
}
