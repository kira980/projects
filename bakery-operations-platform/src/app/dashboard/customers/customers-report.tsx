import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { jerusalemDayRange } from "@/lib/db/day-lock";
import {
  normalizeMonth,
  normalizeDate,
  normalizePeriod,
  resolveReportRange,
  addMonths,
  addDays,
} from "@/lib/reports";
import { formatMoney } from "@/lib/format";
import { ReportNav } from "@/components/report-nav";
import { PeriodFilter } from "@/components/period-filter";
import { ExportCsvButton } from "@/components/export-csv-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";


export async function CustomersReport({
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
  const tsStart = start ? jerusalemDayRange(start).start : null;
  const tsEnd = jerusalemDayRange(end).start;

  let ordersQuery = supabase
    .from("orders")
    .select("customer_id, total")
    .eq("business_id", admin.business_id)
    .lt("delivery_date", end)
    .neq("status", "cancelled");
  if (start) ordersQuery = ordersQuery.gte("delivery_date", start);

  let paymentsQuery = supabase
    .from("payments")
    .select("customer_id, amount")
    .eq("business_id", admin.business_id)
    .lt("paid_at", tsEnd);
  if (tsStart) paymentsQuery = paymentsQuery.gte("paid_at", tsStart);

  const [{ data: customers }, { data: orders }, { data: payments }, { data: debts }] =
    await Promise.all([
      supabase
        .from("customers")
        .select("id, name")
        .eq("business_id", admin.business_id)
        .order("name"),
      ordersQuery,
      paymentsQuery,
      supabase
        .from("customer_debts")
        .select("customer_id, debt")
        .eq("business_id", admin.business_id),
    ]);

  const orderTotals = new Map<string, { sum: number; count: number }>();
  for (const o of orders ?? []) {
    const row = orderTotals.get(o.customer_id) ?? { sum: 0, count: 0 };
    row.sum += Number(o.total);
    row.count += 1;
    orderTotals.set(o.customer_id, row);
  }
  const paymentTotals = new Map<string, number>();
  for (const p of payments ?? []) {
    paymentTotals.set(
      p.customer_id,
      (paymentTotals.get(p.customer_id) ?? 0) + Number(p.amount)
    );
  }
  const debtMap = new Map(
    (debts ?? []).map((d) => [d.customer_id, Number(d.debt)])
  );

  const rows = (customers ?? [])
    .map((c) => ({
      id: c.id,
      name: c.name,
      orders: orderTotals.get(c.id)?.count ?? 0,
      revenue: orderTotals.get(c.id)?.sum ?? 0,
      paid: paymentTotals.get(c.id) ?? 0,
      debt: debtMap.get(c.id) ?? 0,
    }))
    .filter((r) => r.orders > 0 || r.paid > 0 || r.debt !== 0)
    .sort((a, b) => b.revenue - a.revenue);

  const exportSuffix = period === "daily" ? date : period === "all" ? "all" : month;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">דוח לקוחות</h1>
        <div className="flex flex-wrap items-center gap-3">
          <PeriodFilter basePath="/dashboard/customers" period={period} />
          <ExportCsvButton
            filename={`customers-${exportSuffix}.csv`}
            headers={["לקוח", "הזמנות", "היקף הזמנות", "שולם בתקופה", "חוב פתוח כולל"]}
            rows={rows.map((r) => [r.name, r.orders, r.revenue, r.paid, r.debt])}
          />
          {period === "monthly" && (
            <ReportNav
              basePath="/dashboard/customers"
              param="month"
              current={month}
              prev={addMonths(month, -1)}
              next={addMonths(month, 1)}
              label={month}
            />
          )}
          {period === "daily" && (
            <ReportNav
              basePath="/dashboard/customers"
              param="date"
              current={date}
              prev={addDays(date, -1)}
              next={addDays(date, 1)}
              label={date}
            />
          )}
        </div>
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>לקוח</TableHead>
              <TableHead>הזמנות</TableHead>
              <TableHead>היקף הזמנות</TableHead>
              <TableHead>שולם בתקופה</TableHead>
              <TableHead>חוב פתוח כולל</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">
                  אין נתונים לתקופה זו
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Link
                    href={`/dashboard/customers/${r.id}`}
                    className="font-medium hover:underline"
                  >
                    {r.name}
                  </Link>
                </TableCell>
                <TableCell>{r.orders}</TableCell>
                <TableCell>{formatMoney(r.revenue)}</TableCell>
                <TableCell>{formatMoney(r.paid)}</TableCell>
                <TableCell className={r.debt > 0 ? "font-bold text-destructive" : ""}>
                  {formatMoney(r.debt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
