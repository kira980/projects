import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  normalizeMonth,
  normalizeDate,
  normalizePeriod,
  resolveReportRange,
  addMonths,
  addDays,
} from "@/lib/reports";
import { formatMoney } from "@/lib/format";
import { UNIT_TYPE_LABELS } from "@/lib/order-status";
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


export async function ProductsReport({
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

  let ordersQuery = supabase
    .from("orders")
    .select("id, order_items(product_name, unit_type, quantity, line_total)")
    .eq("business_id", admin.business_id)
    .lt("delivery_date", end)
    .neq("status", "cancelled");
  if (start) ordersQuery = ordersQuery.gte("delivery_date", start);

  const { data: orders } = await ordersQuery;

  const totals = new Map<
    string,
    { name: string; unit: string; qty: number; revenue: number; orders: number }
  >();
  for (const o of orders ?? []) {
    const items = o.order_items as unknown as {
      product_name: string;
      unit_type: string;
      quantity: number;
      line_total: number;
    }[];
    for (const item of items) {
      const key = `${item.product_name}|${item.unit_type}`;
      const row = totals.get(key) ?? {
        name: item.product_name,
        unit: item.unit_type,
        qty: 0,
        revenue: 0,
        orders: 0,
      };
      row.qty += Number(item.quantity);
      row.revenue += Number(item.line_total);
      row.orders += 1;
      totals.set(key, row);
    }
  }

  const rows = [...totals.values()].sort((a, b) => b.revenue - a.revenue);
  const exportSuffix = period === "daily" ? date : period === "all" ? "all" : month;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">דוח מוצרים</h1>
        <div className="flex flex-wrap items-center gap-3">
          <PeriodFilter basePath="/dashboard/products" period={period} />
          <ExportCsvButton
            filename={`products-${exportSuffix}.csv`}
            headers={["מוצר", "יחידה", "כמות", "שורות הזמנה", "הכנסות"]}
            rows={rows.map((r) => [
              r.name,
              UNIT_TYPE_LABELS[r.unit] ?? r.unit,
              r.qty,
              r.orders,
              r.revenue,
            ])}
          />
          {period === "monthly" && (
            <ReportNav
              basePath="/dashboard/products"
              param="month"
              current={month}
              prev={addMonths(month, -1)}
              next={addMonths(month, 1)}
              label={month}
            />
          )}
          {period === "daily" && (
            <ReportNav
              basePath="/dashboard/products"
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
              <TableHead>מוצר</TableHead>
              <TableHead>כמות</TableHead>
              <TableHead>שורות הזמנה</TableHead>
              <TableHead>הכנסות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">
                  אין הזמנות לתקופה זו
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={`${r.name}|${r.unit}`}>
                <TableCell>
                  {/* No per-product profile page exists — the manage view
                      is the closest "product home". */}
                  <Link
                    href="/dashboard/products?view=manage"
                    className="font-medium text-primary hover:underline"
                  >
                    {r.name}
                  </Link>
                </TableCell>
                <TableCell>
                  {r.qty} {UNIT_TYPE_LABELS[r.unit] ?? r.unit}
                </TableCell>
                <TableCell>{r.orders}</TableCell>
                <TableCell className="font-medium">{formatMoney(r.revenue)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
