import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { jerusalemDayRange } from "@/lib/db/day-lock";
import { normalizeMonth, addMonths, monthDateRange } from "@/lib/reports";
import { formatMoney } from "@/lib/format";
import { ReportNav } from "@/components/report-nav";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";


export async function MonthlyReport({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParam } = await searchParams;
  const admin = await requireAdmin();
  const supabase = await createClient();

  const month = normalizeMonth(monthParam);
  const { start, end } = monthDateRange(month);
  const { start: tsStart } = jerusalemDayRange(start);
  const { start: tsEnd } = jerusalemDayRange(end);

  const [
    { data: expenses },
    { data: advances },
    { data: vendorOrders },
    { data: payments },
  ] = await Promise.all([
    supabase
      .from("expenses")
      .select("amount, expense_date")
      .eq("business_id", admin.business_id)
      .gte("expense_date", start)
      .lt("expense_date", end),
    supabase
      .from("worker_advances")
      .select("amount")
      .eq("business_id", admin.business_id)
      .gte("taken_at", tsStart)
      .lt("taken_at", tsEnd),
    supabase
      .from("vendor_orders")
      .select("amount")
      .eq("business_id", admin.business_id)
      .gte("received_at", tsStart)
      .lt("received_at", tsEnd),
    supabase
      .from("payments")
      .select("amount")
      .eq("business_id", admin.business_id)
      .gte("paid_at", tsStart)
      .lt("paid_at", tsEnd),
  ]);

  const sum = (rows: { amount: unknown }[] | null) =>
    (rows ?? []).reduce((s, r) => s + Number(r.amount), 0);

  const totalExpenses = sum(expenses);
  const totalAdvances = sum(advances);
  const totalGoods = sum(vendorOrders);
  const totalCustomerPayments = sum(payments);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">דוח חודשי</h1>
        <ReportNav
          basePath="/dashboard/reports"
          extraParams={{ view: "monthly" }}
          param="month"
          current={month}
          prev={addMonths(month, -1)}
          next={addMonths(month, 1)}
          label={month}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "תשלומי לקוחות", value: totalCustomerPayments },
          { label: "קניות מספקים", value: totalGoods, neg: true },
          { label: "הוצאות", value: totalExpenses, neg: true },
          { label: "מפרעות", value: totalAdvances, neg: true },
        ].map((m) => (
          <Card key={m.label}>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">{m.label}</CardTitle>
            </CardHeader>
            <CardContent
              className={`text-xl font-bold ${m.neg && m.value > 0 ? "text-destructive" : ""}`}
            >
              {formatMoney(m.value)}
            </CardContent>
          </Card>
        ))}
      </div>

    </div>
  );
}
