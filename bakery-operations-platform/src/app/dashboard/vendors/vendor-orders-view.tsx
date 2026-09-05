import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { jerusalemDayRange } from "@/lib/db/day-lock";
import {
  normalizeDate,
  normalizeMonth,
  addDays,
  addMonths,
  monthDateRange,
} from "@/lib/reports";
import {
  formatMoney,
  formatDate,
  formatTime,
  formatDateTime,
  toDateInput,
  toTimeInput,
} from "@/lib/format";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/db/vendors";
import { ReportNav } from "@/components/report-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VendorOrderDialog, VendorOrderActions } from "./vendor-order-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/** Goods received from vendors — daily (default) or monthly, admin can add. */
export async function VendorOrdersView({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; month?: string; date?: string }>;
}) {
  const sp = await searchParams;
  const admin = await requireAdmin();
  const supabase = await createClient();

  const period = sp.period === "monthly" ? "monthly" : "daily";
  const date = normalizeDate(sp.date);
  const month = normalizeMonth(sp.month);
  const range =
    period === "daily"
      ? { start: date, end: addDays(date, 1) }
      : monthDateRange(month);
  const tsStart = jerusalemDayRange(range.start).start;
  const tsEnd = jerusalemDayRange(range.end).start;

  const [{ data: orders }, { data: vendors }, { data: workers }] =
    await Promise.all([
      supabase
        .from("vendor_orders")
        .select(
          "id, vendor_id, amount, status, payment_method, paid_by_worker_id, received_by_type, notes, received_at"
        )
        .eq("business_id", admin.business_id)
        .gte("received_at", tsStart)
        .lt("received_at", tsEnd)
        .order("received_at", { ascending: false }),
      supabase
        .from("vendors")
        .select("id, name, is_active")
        .eq("business_id", admin.business_id)
        .order("name"),
      supabase
        .from("workers")
        .select("id, full_name")
        .eq("business_id", admin.business_id),
    ]);

  const vendorNames = new Map((vendors ?? []).map((v) => [v.id, v.name]));
  const workerNames = new Map((workers ?? []).map((w) => [w.id, w.full_name]));
  const activeVendors = (vendors ?? []).filter((v) => v.is_active);

  const total = (orders ?? []).reduce((s, o) => s + Number(o.amount), 0);
  const totalUnpaid = (orders ?? [])
    .filter((o) => o.status !== "paid")
    .reduce((s, o) => s + Number(o.amount), 0);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">קבלות סחורה מספקים</h1>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-2" role="group" aria-label="תקופה">
            <Button
              asChild
              size="sm"
              variant={period === "daily" ? "default" : "outline"}
            >
              <Link href="/dashboard/vendors">יומי</Link>
            </Button>
            <Button
              asChild
              size="sm"
              variant={period === "monthly" ? "default" : "outline"}
            >
              <Link href="/dashboard/vendors?period=monthly">חודשי</Link>
            </Button>
          </div>
          {period === "daily" ? (
            <ReportNav
              basePath="/dashboard/vendors"
              param="date"
              current={date}
              prev={addDays(date, -1)}
              next={addDays(date, 1)}
              label={formatDate(date)}
            />
          ) : (
            <ReportNav
              basePath="/dashboard/vendors"
              extraParams={{ period: "monthly" }}
              param="month"
              current={month}
              prev={addMonths(month, -1)}
              next={addMonths(month, 1)}
              label={month}
            />
          )}
          {/* On a day view a new arrival belongs to the day on screen. */}
          <VendorOrderDialog
            vendors={activeVendors}
            defaultDate={period === "daily" ? date : undefined}
          />
        </div>
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ספק</TableHead>
              <TableHead>שעה</TableHead>
              <TableHead>סכום</TableHead>
              <TableHead>סטטוס</TableHead>
              <TableHead>אמצעי</TableHead>
              <TableHead>מי שילם</TableHead>
              <TableHead>הערות</TableHead>
              <TableHead className="w-24">פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(orders ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="h-20 text-center text-muted-foreground">
                  {period === "daily"
                    ? "לא התקבלה סחורה ביום זה"
                    : "לא התקבלה סחורה בחודש זה"}
                </TableCell>
              </TableRow>
            )}
            {(orders ?? []).map((o) => (
              <TableRow key={o.id}>
                <TableCell>
                  <Link
                    href={`/dashboard/vendors/${o.vendor_id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {vendorNames.get(o.vendor_id) ?? "—"}
                  </Link>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {period === "daily"
                    ? formatTime(o.received_at)
                    : formatDateTime(o.received_at)}
                </TableCell>
                <TableCell className="font-medium">{formatMoney(o.amount)}</TableCell>
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
                    ? (workerNames.get(o.paid_by_worker_id) ?? "—")
                    : o.status === "paid" && o.received_by_type === "admin"
                      ? "מנהל"
                      : "—"}
                </TableCell>
                <TableCell className="max-w-56 truncate text-muted-foreground">
                  {o.notes ?? ""}
                </TableCell>
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
            ))}
          </TableBody>
          {(orders ?? []).length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2}>
                  {period === "daily" ? 'סה"כ ליום' : 'סה"כ לחודש'}
                </TableCell>
                <TableCell className="font-bold">{formatMoney(total)}</TableCell>
                <TableCell colSpan={5} className="text-destructive">
                  {totalUnpaid > 0 ? `לא שולם: ${formatMoney(totalUnpaid)}` : ""}
                </TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </div>
  );
}
