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


export async function VendorsReport({
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
    .from("vendor_orders")
    .select("vendor_id, amount")
    .eq("business_id", admin.business_id)
    .lt("received_at", tsEnd);
  if (tsStart) ordersQuery = ordersQuery.gte("received_at", tsStart);

  let paymentsQuery = supabase
    .from("vendor_payments")
    .select("vendor_id, amount")
    .eq("business_id", admin.business_id)
    .lt("paid_at", tsEnd);
  if (tsStart) paymentsQuery = paymentsQuery.gte("paid_at", tsStart);

  const [{ data: vendors }, { data: orders }, { data: payments }, { data: debts }] =
    await Promise.all([
      supabase
        .from("vendors")
        .select("id, name")
        .eq("business_id", admin.business_id)
        .order("name"),
      ordersQuery,
      paymentsQuery,
      supabase
        .from("vendor_debts")
        .select("vendor_id, debt")
        .eq("business_id", admin.business_id),
    ]);

  const purchases = new Map<string, number>();
  for (const o of orders ?? []) {
    purchases.set(o.vendor_id, (purchases.get(o.vendor_id) ?? 0) + Number(o.amount));
  }
  const paid = new Map<string, number>();
  for (const p of payments ?? []) {
    paid.set(p.vendor_id, (paid.get(p.vendor_id) ?? 0) + Number(p.amount));
  }
  const debtMap = new Map(
    (debts ?? []).map((d) => [d.vendor_id, Number(d.debt)])
  );

  const rows = (vendors ?? [])
    .map((v) => ({
      id: v.id,
      name: v.name,
      purchases: purchases.get(v.id) ?? 0,
      paid: paid.get(v.id) ?? 0,
      debt: debtMap.get(v.id) ?? 0,
    }))
    .filter((r) => r.purchases > 0 || r.paid > 0 || r.debt !== 0);

  const exportSuffix = period === "daily" ? date : period === "all" ? "all" : month;

  const catParams: Record<string, string> = { view: "report" };

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">דוח ספקים</h1>
        <div className="flex flex-wrap items-center gap-3">
          <PeriodFilter basePath="/dashboard/vendors" period={period} extraParams={catParams} />
          <ExportCsvButton
            filename={`vendors-${exportSuffix}.csv`}
            headers={["ספק", "קניות בתקופה", "שולם בתקופה", "חוב פתוח כולל"]}
            rows={rows.map((r) => [r.name, r.purchases, r.paid, r.debt])}
          />
          {period === "monthly" && (
            <ReportNav
              basePath="/dashboard/vendors"
              extraParams={{ ...catParams, period: "monthly" }}
              param="month"
              current={month}
              prev={addMonths(month, -1)}
              next={addMonths(month, 1)}
              label={month}
            />
          )}
          {period === "daily" && (
            <ReportNav
              basePath="/dashboard/vendors"
              extraParams={catParams}
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
              <TableHead>ספק</TableHead>
              <TableHead>קניות בתקופה</TableHead>
              <TableHead>שולם בתקופה</TableHead>
              <TableHead>חוב פתוח כולל</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">
                  אין נתונים לתקופה זו
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Link
                    href={`/dashboard/vendors/${r.id}`}
                    className="font-medium hover:underline"
                  >
                    {r.name}
                  </Link>
                </TableCell>
                <TableCell>{formatMoney(r.purchases)}</TableCell>
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
