import Link from "next/link";
import {
  ExternalLink,
  Lock,
  HandCoins,
  Store,
  Receipt,
  ArrowDownCircle,
  Vault,
  Users,
  PackageOpen,
  type LucideIcon,
} from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSignedFileUrls } from "@/lib/storage";
import {
  businessToday,
  jerusalemDayRange,
  shiftDayRange,
  overtimeHours,
  LONG_SHIFT_HOURS,
} from "@/lib/db/day-lock";
import { addDays } from "@/lib/reports";
import {
  formatMoney,
  formatTime,
  formatDate,
  formatHours,
  toDateInput,
  toTimeInput,
} from "@/lib/format";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/db/vendors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExpenseActions } from "@/app/dashboard/expenses/expense-actions";
import { AdvanceEditRow } from "@/app/dashboard/workers/advance-edit-row";
import { AdvanceDialog } from "@/app/dashboard/workers/advance-dialog";
import {
  VendorOrderActions,
  VendorOrderDialog,
} from "@/app/dashboard/vendors/vendor-order-dialog";
import { DailySalesForm } from "./daily-sales-form";
import { SimpleDateNav } from "./date-nav";
import { ShiftHoursDialog } from "./shift-hours-dialog";
import { NewShiftDialog } from "./new-shift-dialog";
import { StopShiftButton } from "@/app/dashboard/workers/stop-shift-button";
import { LiveDuration } from "./live-duration";

export const metadata = { title: "מבט יומי" };

function msToHours(ms: number): string {
  const mins = Math.floor(ms / 60000);
  return `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, "0")}`;
}

type SummaryCard = {
  label: string;
  value: number;
  icon: LucideIcon;
  tone?: "destructive" | "positive";
  hint?: string;
  /** Given → the whole card is a link to the day's detail behind it. */
  href?: string;
};

/**
 * One figure of the day. Same shape for the outgoing and register rows —
 * and the same height: every card fills its grid cell, so a hint under one
 * of them no longer leaves its neighbours short.
 */
function renderSummaryCard(c: SummaryCard) {
  const Icon = c.icon;
  const tone =
    c.tone === "destructive"
      ? "text-destructive"
      : c.tone === "positive"
        ? "text-success"
        : "";
  const card = (
    <Card
      size="sm"
      className={`h-full${
        c.href ? " transition-colors hover:border-primary/50 hover:bg-muted/40" : ""
      }`}
    >
      <CardHeader>
        <div className="flex items-center gap-2">
          <span
            className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
              c.tone === "destructive"
                ? "bg-destructive-soft text-destructive"
                : c.tone === "positive"
                  ? "bg-success-soft text-success"
                  : "bg-primary-soft text-primary"
            }`}
          >
            <Icon className="size-4" aria-hidden />
          </span>
          <CardTitle className="text-sm leading-tight font-medium text-muted-foreground">
            {c.label}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className={`text-xl font-bold sm:text-2xl ${tone}`}>
        {formatMoney(c.value)}
        {c.hint && (
          <p className="mt-1 text-xs font-normal text-muted-foreground">
            {c.hint}
          </p>
        )}
      </CardContent>
    </Card>
  );
  return c.href ? (
    <Link key={c.label} href={c.href} className="block h-full">
      {card}
    </Link>
  ) : (
    <div key={c.label} className="h-full">
      {card}
    </div>
  );
}

export default async function SimpleDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const sp = await searchParams;
  const admin = await requireAdmin();
  const supabase = await createClient();

  const businessDay = businessToday();
  // The whole page is day-scoped; arrows/picker change the day shown.
  const today = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "")
    ? sp.date!
    : businessDay;
  // Money (advances, goods, payments) is bounded by the money day, which
  // ends at 02:00 so a trading night stays whole. Shifts are bounded by the
  // shift day, where a clock-in from 21:00 onward is the next day's work.
  const { start, end } = jerusalemDayRange(today);
  const shiftRange = shiftDayRange(today);

  const [
    { data: todayShifts },
    { data: openShifts },
    { data: advances },
    { data: vendorOrders },
    { data: vendors },
    { data: lock },
    { data: dailySales },
    { data: yesterdaySales },
    { data: vendorPayments },
    { data: expenses },
    { data: allWorkers },
    { data: profiles },
  ] = await Promise.all([
    supabase
      .from("worker_shifts")
      .select("id, worker_id, started_at, ended_at")
      .eq("business_id", admin.business_id)
      .gte("started_at", shiftRange.start)
      .lt("started_at", shiftRange.end),
    supabase
      .from("worker_shifts")
      .select("id, worker_id, started_at")
      .eq("business_id", admin.business_id)
      .is("ended_at", null),
    supabase
      .from("worker_advances")
      .select("id, worker_id, amount, taken_at, notes")
      .eq("business_id", admin.business_id)
      .gte("taken_at", start)
      .lt("taken_at", end)
      .order("taken_at", { ascending: false }),
    supabase
      .from("vendor_orders")
      .select("id, vendor_id, amount, status, payment_method, paid_by_worker_id, receipt_file_path, notes, received_at")
      .eq("business_id", admin.business_id)
      .gte("received_at", start)
      .lt("received_at", end)
      .order("received_at", { ascending: false }),
    supabase
      .from("vendors")
      .select("id, name")
      .eq("business_id", admin.business_id),
    supabase
      .from("day_locks")
      .select("is_locked")
      .eq("business_id", admin.business_id)
      .eq("lock_date", today)
      .maybeSingle(),
    supabase
      .from("daily_sales")
      .select("left_in_register")
      .eq("business_id", admin.business_id)
      .eq("sales_date", today)
      .maybeSingle(),
    supabase
      .from("daily_sales")
      .select("left_in_register")
      .eq("business_id", admin.business_id)
      .eq("sales_date", addDays(today, -1))
      .maybeSingle(),
    supabase
      .from("vendor_payments")
      .select("amount")
      .eq("business_id", admin.business_id)
      .gte("paid_at", start)
      .lt("paid_at", end),
    supabase
      .from("expenses")
      .select("id, amount, method, description, spent_by_type, spent_by_id, created_at")
      .eq("business_id", admin.business_id)
      .eq("expense_date", today)
      .order("created_at", { ascending: false }),
    supabase
      .from("workers")
      .select("id, full_name")
      .eq("business_id", admin.business_id)
      .order("full_name"),
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("business_id", admin.business_id),
  ]);

  // A shift still running belongs to the day it is running ON. The open
  // ones are fetched without a date (that is what "open" means), so on any
  // day but today they would be pasted onto a day they have nothing to do
  // with — today's workers appearing on last Tuesday's board. A shift that
  // was opened on the day being viewed and never closed is already in
  // todayShifts, which filters by start.
  const carriedOpenShifts =
    today === businessDay
      ? (openShifts ?? []).filter((s) => s.started_at < shiftRange.start)
      : [];

  // Only workers with real activity on the day shown (in shift then, or a
  // shift that started that day) — not the full active-worker roster.
  const activeWorkerIds = new Set<string>([
    ...(todayShifts ?? []).map((s) => s.worker_id),
    ...carriedOpenShifts.map((s) => s.worker_id),
  ]);

  const advanceByWorker = new Map<string, number>();
  for (const a of advances ?? []) {
    advanceByWorker.set(
      a.worker_id,
      (advanceByWorker.get(a.worker_id) ?? 0) + Number(a.amount)
    );
  }
  // Server component rendered per request — capturing the current time is
  // fine here (used only for the elapsed time of still-open shifts).
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();
  const hoursByWorker = new Map<string, number>();
  for (const s of todayShifts ?? []) {
    const ms =
      (s.ended_at ? new Date(s.ended_at).getTime() : nowMs) -
      new Date(s.started_at).getTime();
    hoursByWorker.set(s.worker_id, (hoursByWorker.get(s.worker_id) ?? 0) + Math.max(0, ms));
  }

  // Both worker lists come from the same business roster (fetched above
  // in the parallel batch) — no extra queries needed.
  const activeWorkers = (allWorkers ?? []).filter((w) =>
    activeWorkerIds.has(w.id)
  );

  // Every shift of the day, finished ones included — the table shows one
  // row each, so an evening shift no longer hides behind the morning's
  // total. An open shift that started yesterday is not in todayShifts, but
  // it is still running today and belongs here.
  type Shift = { id: string; started_at: string; ended_at: string | null };
  type Worker = { id: string; full_name: string };
  const shiftsByWorker = new Map<string, Shift[]>();
  const seenShiftIds = new Set<string>();
  for (const s of [
    ...(todayShifts ?? []),
    ...carriedOpenShifts.map((o) => ({ ...o, ended_at: null })),
  ]) {
    if (seenShiftIds.has(s.id)) continue;
    seenShiftIds.add(s.id);
    shiftsByWorker.set(s.worker_id, [
      ...(shiftsByWorker.get(s.worker_id) ?? []),
      { id: s.id, started_at: s.started_at, ended_at: s.ended_at },
    ]);
  }
  for (const list of shiftsByWorker.values()) {
    list.sort((a, b) => a.started_at.localeCompare(b.started_at));
  }

  // One table row per shift; the worker's name, advance and pencil sit on
  // the first of their rows so the eye still groups them.
  type ShiftRow = { worker: Worker; shift: Shift | null; first: boolean };
  const shiftRows = activeWorkers.flatMap<ShiftRow>((w) => {
    const list = shiftsByWorker.get(w.id) ?? [];
    if (list.length === 0) return [{ worker: w, shift: null, first: true }];
    return list.map((shift, i) => ({ worker: w, shift, first: i === 0 }));
  });

  const vendorNames = new Map((vendors ?? []).map((v) => [v.id, v.name]));
  const workerNames = new Map(
    (allWorkers ?? []).map((w) => [w.id, w.full_name])
  );
  // Expenses are recorded by workers at the kiosk and by admins here, so
  // both kinds of id can appear against one.
  const spenderNames = new Map<string, string>([
    ...(allWorkers ?? []).map((w) => [w.id, w.full_name] as [string, string]),
    ...(profiles ?? []).map((p) => [p.id, p.full_name] as [string, string]),
  ]);

  // All receipt URLs signed in one storage round trip.
  const ordersWithReceipts = (vendorOrders ?? []).filter(
    (o) => o.receipt_file_path
  );
  const signedByPath = await getSignedFileUrls(
    supabase,
    "receipts",
    ordersWithReceipts.map((o) => o.receipt_file_path as string)
  );
  const receiptUrls = new Map<string, string>();
  for (const o of ordersWithReceipts) {
    const url = signedByPath.get(o.receipt_file_path as string);
    if (url) receiptUrls.set(o.id, url);
  }

  const totalAdvances = [...advanceByWorker.values()].reduce((a, b) => a + b, 0);
  const totalGoods = (vendorOrders ?? []).reduce((sum, o) => sum + Number(o.amount), 0);
  const totalGoodsRemaining = (vendorOrders ?? [])
    .filter((o) => o.status !== "paid")
    .reduce((sum, o) => sum + Number(o.amount), 0);

  const totalVendorPayments = (vendorPayments ?? []).reduce(
    (sum, p) => sum + Number(p.amount),
    0
  );
  const totalExpenses = (expenses ?? []).reduce((sum, e) => sum + Number(e.amount), 0);
  const totalPayments = totalAdvances + totalVendorPayments + totalExpenses;

  const leftToday =
    dailySales?.left_in_register != null ? Number(dailySales.left_in_register) : 0;
  const leftYesterday =
    yesterdaySales?.left_in_register != null
      ? Number(yesterdaySales.left_in_register)
      : 0;

  // Red (outgoing) cards on top; money-in / register cards a line below.
  // The first three link to a per-day drill-down of the payments behind them.
  const summaryCards: SummaryCard[] = [
    {
      label: "מפרעות עובדים",
      value: totalAdvances,
      icon: HandCoins,
      tone: "destructive",
      href: `/dashboard/simple/payments?type=advances&date=${today}`,
    },
    {
      label: "תשלום לספקים",
      value: totalVendorPayments,
      icon: Store,
      tone: "destructive",
      href: `/dashboard/simple/payments?type=vendors&date=${today}`,
    },
    {
      label: "תשלומים אחרים",
      value: totalExpenses,
      icon: Receipt,
      tone: "destructive",
      href: `/dashboard/simple/payments?type=other&date=${today}`,
    },
    { label: "סך תשלומים", value: totalPayments, icon: ArrowDownCircle, tone: "destructive" },
  ];
  // Takings are not here at all: מזומן / ויזה live encrypted in /secret and
  // this server cannot read them. What is left is the till, which the shift
  // manager records from the kiosk and which stays in the clear.
  const registerCards: SummaryCard[] = [
    {
      label: "כסף בקופה מאתמול",
      value: leftYesterday,
      icon: Vault,
      href: "/dashboard/simple/register",
    },
    {
      label: "נשאר בקופה היום",
      value: leftToday,
      icon: Vault,
      hint: "לחצו לעריכת כל הימים",
      href: "/dashboard/simple/register",
    },
  ];

  return (
    <div className="grid gap-6">
      <PageHeader title="מבט יומי" description={formatDate(today)}>
        <SimpleDateNav date={today} today={businessDay} />
      </PageHeader>

      {lock?.is_locked && (
        <Alert variant="warning">
          <Lock className="size-4" />
          <AlertDescription>היום נעול לפעולות כספיות.</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {summaryCards.map(renderSummaryCard)}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {registerCards.map(renderSummaryCard)}
      </div>

      {/* Keyed by day: the inputs are uncontrolled, so without a remount
          they kept the previous day's typing when the arrows moved. */}
      <DailySalesForm
        key={today}
        today={today}
        locked={lock?.is_locked ?? false}
        left={
          dailySales?.left_in_register != null
            ? Number(dailySales.left_in_register)
            : null
        }
      />

      <section className="grid gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold">
            עובדים ומפרעות
            {totalAdvances > 0 && (
              <span className="ms-2 text-sm font-normal text-muted-foreground">
                (סה&quot;כ מפרעות היום: {formatMoney(totalAdvances)})
              </span>
            )}
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <NewShiftDialog workers={allWorkers ?? []} date={today} />
            {/* Only workers with activity today are listed here — a day
                somebody never clocked at all is fixed on the hours screen. */}
            <Link
              href={`/dashboard/workers?view=hours&mode=day&date=${today}`}
              className="text-sm text-primary hover:underline"
            >
              עריכת שעות לכל העובדים
            </Link>
          </div>
        </div>
        <div className="rounded-lg border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>עובד</TableHead>
                <TableHead>סטטוס</TableHead>
                <TableHead>תחילת משמרת</TableHead>
                <TableHead>סיום משמרת</TableHead>
                <TableHead>שעות</TableHead>
                <TableHead>סה&quot;כ היום</TableHead>
                <TableHead>מפרעה היום</TableHead>
                <TableHead className="w-16">עריכה</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shiftRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="p-0">
                    <EmptyState
                      icon={Users}
                      title="אין עובדים פעילים היום"
                      description="כאן יופיעו העובדים שפתחו משמרת או לקחו מפרעה במהלך היום."
                    />
                  </TableCell>
                </TableRow>
              )}
              {shiftRows.map(({ worker: w, shift, first }) => {
                const isOpen = !!shift && !shift.ended_at;
                const totalMs = hoursByWorker.get(w.id) ?? 0;
                const advance = advanceByWorker.get(w.id) ?? 0;
                // Past twelve hours the whole line turns red — a shift
                // that long is either overtime to pay or a clock-out
                // nobody made, and both want looking at.
                const over = shift
                  ? overtimeHours(shift.started_at, shift.ended_at)
                  : 0;
                return (
                  <TableRow
                    key={`${today}:${shift?.id ?? w.id}`}
                    className={over > 0 ? "bg-destructive-soft/40" : undefined}
                  >
                    <TableCell>
                      {first ? (
                        <Link
                          href={`/dashboard/workers/${w.id}`}
                          className="font-medium hover:underline"
                        >
                          {w.full_name}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">↳</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {!shift ? (
                        <Badge variant="outline">לא במשמרת</Badge>
                      ) : isOpen ? (
                        <Badge variant="success">במשמרת</Badge>
                      ) : (
                        <Badge variant="outline">הסתיימה</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {shift ? formatTime(shift.started_at) : "—"}
                    </TableCell>
                    <TableCell>
                      {/* Ending it asks for the finish time, defaulted to
                          now — the worker who left without clocking out. */}
                      {shift?.ended_at ? (
                        formatTime(shift.ended_at)
                      ) : isOpen && shift ? (
                        <StopShiftButton
                          shiftId={shift.id}
                          workerName={w.full_name}
                        />
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      {/* Still in: this keeps counting, so it doesn't
                          freeze at whatever it was on page load. */}
                      {isOpen && shift ? (
                        <LiveDuration since={shift.started_at} />
                      ) : shift?.ended_at ? (
                        <span
                          className={over > 0 ? "font-bold text-destructive" : ""}
                          title={
                            over > 0
                              ? `${formatHours(shift.started_at, shift.ended_at)} — ${over.toFixed(1)} שעות מעל ${LONG_SHIFT_HOURS}`
                              : undefined
                          }
                        >
                          {formatHours(shift.started_at, shift.ended_at)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      {first && totalMs > 0 ? msToHours(totalMs) : ""}
                    </TableCell>
                    <TableCell>
                      {first && advance > 0 ? (
                        <span className="font-medium text-destructive">
                          {formatMoney(advance)}
                        </span>
                      ) : (
                        ""
                      )}
                    </TableCell>
                    <TableCell>
                      {first && (
                        <ShiftHoursDialog
                          workerName={w.full_name}
                          shifts={(shiftsByWorker.get(w.id) ?? []).map((s) => ({
                            id: s.id,
                            startTime: toTimeInput(s.started_at),
                            endTime: s.ended_at ? toTimeInput(s.ended_at) : null,
                          }))}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* The table above sums the day per worker; this one is the advances
          themselves, where a mistaken amount can be fixed or removed. */}
      <section className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">מפרעות היום</h2>
          {/* The kiosk can only ever record the day that is running, so an
              advance for an earlier day is entered here. */}
          <AdvanceDialog workers={allWorkers ?? []} defaultDate={today} />
        </div>
        <div className="rounded-lg border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>עובד</TableHead>
                <TableHead>סכום</TableHead>
                <TableHead>שעה</TableHead>
                <TableHead>הערות</TableHead>
                <TableHead className="w-24">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(advances ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="p-0">
                    <EmptyState
                      icon={HandCoins}
                      title="לא ניתנו מפרעות היום"
                      description="מפרעות שאחראי המשמרת רושם בקיוסק יופיעו כאן."
                    />
                  </TableCell>
                </TableRow>
              )}
              {(advances ?? []).map((a) => (
                <AdvanceEditRow
                  key={`${today}:${a.id}`}
                  advance={{
                    id: a.id,
                    amount: Number(a.amount),
                    workerName: workerNames.get(a.worker_id) ?? null,
                  }}
                  leading={
                    <TableCell>
                      <Link
                        href={`/dashboard/workers/${a.worker_id}`}
                        className="font-medium hover:underline"
                      >
                        {workerNames.get(a.worker_id) ?? "—"}
                      </Link>
                    </TableCell>
                  }
                  trailing={
                    <>
                      <TableCell>{formatTime(a.taken_at)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {a.notes ?? ""}
                      </TableCell>
                    </>
                  }
                />
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">
            סחורה שהתקבלה היום
            {totalGoods > 0 && (
              <span className="ms-2 text-sm font-normal text-muted-foreground">
                (סה&quot;כ: {formatMoney(totalGoods)}
                {totalGoodsRemaining > 0 && `, נותר: ${formatMoney(totalGoodsRemaining)}`})
              </span>
            )}
          </h2>
          {/* Goods that came in on the day being viewed, entered after the
              fact — the arrival keeps that day, not today. */}
          <VendorOrderDialog
            vendors={vendors ?? []}
            defaultDate={today}
            trigger={
              <Button size="sm" variant="outline">
                <PackageOpen className="size-4" />
                רישום סחורה
              </Button>
            }
          />
        </div>
        <div className="rounded-lg border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ספק</TableHead>
                <TableHead>סכום</TableHead>
                <TableHead>נותר</TableHead>
                <TableHead>סטטוס</TableHead>
                <TableHead>אמצעי</TableHead>
                <TableHead>מי שילם</TableHead>
                <TableHead>קבלה</TableHead>
                <TableHead>שעה</TableHead>
                <TableHead>הערות</TableHead>
                <TableHead className="w-24">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(vendorOrders ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="p-0">
                    <EmptyState
                      icon={PackageOpen}
                      title="לא התקבלה סחורה היום"
                      description="כאן תוצג הסחורה שהתקבלה מהספקים במהלך היום."
                    />
                  </TableCell>
                </TableRow>
              )}
              {(vendorOrders ?? []).map((o) => {
                const remaining = o.status === "paid" ? 0 : Number(o.amount);
                return (
                <TableRow key={`${today}:${o.id}`}>
                  <TableCell>
                    <Link
                      href={`/dashboard/vendors/${o.vendor_id}`}
                      className="font-medium hover:underline"
                    >
                      {vendorNames.get(o.vendor_id) ?? "—"}
                    </Link>
                  </TableCell>
                  <TableCell>{formatMoney(o.amount)}</TableCell>
                  <TableCell className={remaining > 0 ? "font-medium text-destructive" : ""}>
                    {formatMoney(remaining)}
                  </TableCell>
                  <TableCell>
                    {o.status === "paid" ? (
                      <Badge variant="success">שולם</Badge>
                    ) : (
                      <Badge variant="destructive">לא שולם</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {o.payment_method
                      ? PAYMENT_METHOD_LABELS[o.payment_method as PaymentMethod]
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {o.paid_by_worker_id
                      ? workerNames.get(o.paid_by_worker_id) ?? "—"
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {receiptUrls.has(o.id) ? (
                      <a
                        href={receiptUrls.get(o.id)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        צפייה <ExternalLink className="size-3.5" />
                      </a>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>{formatTime(o.received_at)}</TableCell>
                  <TableCell className="text-muted-foreground">{o.notes ?? ""}</TableCell>
                  <TableCell>
                    <VendorOrderActions
                      vendors={vendors ?? []}
                      vendorName={vendorNames.get(o.vendor_id)}
                      order={{
                        id: o.id,
                        vendor_id: o.vendor_id,
                        amount: Number(o.amount),
                        status: o.status,
                        payment_method: o.payment_method,
                        paid_by_worker_id: o.paid_by_worker_id,
                        notes: o.notes,
                        received_date: toDateInput(o.received_at),
                        received_time: toTimeInput(o.received_at),
                      }}
                    />
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* תשלומים אחרים — the third of the day's outgoing figures, and the
          only one that had no table of its own on this page. */}
      <section className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">
            תשלומים אחרים היום
            {totalExpenses > 0 && (
              <span className="ms-2 text-sm font-normal text-muted-foreground">
                (סה&quot;כ: {formatMoney(totalExpenses)})
              </span>
            )}
          </h2>
          <Link
            href="/dashboard/expenses"
            className="text-sm text-primary hover:underline"
          >
            רישום תשלום חדש
          </Link>
        </div>
        <div className="rounded-lg border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>תיאור</TableHead>
                <TableHead>סכום</TableHead>
                <TableHead>אמצעי</TableHead>
                <TableHead>נרשם ע&quot;י</TableHead>
                <TableHead>שעה</TableHead>
                <TableHead className="w-24">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(expenses ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="p-0">
                    <EmptyState
                      icon={Receipt}
                      title="לא נרשמו תשלומים אחרים היום"
                      description="תשלומים שנרשמו בקיוסק או בדף ההוצאות יופיעו כאן."
                    />
                  </TableCell>
                </TableRow>
              )}
              {(expenses ?? []).map((e) => (
                <TableRow key={`${today}:${e.id}`}>
                  <TableCell className="font-medium">
                    {e.description ?? "—"}
                  </TableCell>
                  <TableCell className="font-medium text-destructive">
                    {formatMoney(e.amount)}
                  </TableCell>
                  <TableCell>
                    {e.method
                      ? PAYMENT_METHOD_LABELS[e.method as PaymentMethod]
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {(e.spent_by_id && spenderNames.get(e.spent_by_id)) ||
                      (e.spent_by_type === "admin" ? "מנהל" : "—")}
                  </TableCell>
                  <TableCell>{formatTime(e.created_at)}</TableCell>
                  <TableCell>
                    <ExpenseActions
                      expense={{
                        id: e.id,
                        amount: Number(e.amount),
                        method: e.method,
                        description: e.description,
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
