import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { jerusalemDayRange } from "@/lib/db/day-lock";
import { normalizeDate, addDays } from "@/lib/reports";
import { formatMoney, formatDate } from "@/lib/format";
import { ReportNav } from "@/components/report-nav";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";


export async function DailyReport({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date: dateParam } = await searchParams;
  const admin = await requireAdmin();
  const supabase = await createClient();

  const date = normalizeDate(dateParam);
  const { start, end } = jerusalemDayRange(date);

  const [
    { data: expenses },
    { data: advances },
    { data: vendorPayments },
    { data: vendorOrders },
    { data: payments },
    { data: orders },
  ] = await Promise.all([
    supabase
      .from("expenses")
      .select("amount")
      .eq("business_id", admin.business_id)
      .eq("expense_date", date),
    supabase
      .from("worker_advances")
      .select("amount")
      .eq("business_id", admin.business_id)
      .gte("taken_at", start)
      .lt("taken_at", end),
    supabase
      .from("vendor_payments")
      .select("amount")
      .eq("business_id", admin.business_id)
      .gte("paid_at", start)
      .lt("paid_at", end),
    supabase
      .from("vendor_orders")
      .select("amount")
      .eq("business_id", admin.business_id)
      .gte("received_at", start)
      .lt("received_at", end),
    supabase
      .from("payments")
      .select("amount, collected_by_type")
      .eq("business_id", admin.business_id)
      .gte("paid_at", start)
      .lt("paid_at", end),
    supabase
      .from("orders")
      .select("total, status")
      .eq("business_id", admin.business_id)
      .eq("delivery_date", date)
      .neq("status", "cancelled"),
  ]);

  const sum = (rows: { amount: unknown }[] | null) =>
    (rows ?? []).reduce((s, r) => s + Number(r.amount), 0);

  const ordersTotal = (orders ?? []).reduce((s, o) => s + Number(o.total), 0);
  const totalExpenses = sum(expenses);
  const totalAdvances = sum(advances);
  const totalVendorPayments = sum(vendorPayments);
  const goodsReceived = sum(vendorOrders);
  const customerPayments = sum(payments);
  const driverCollections = (payments ?? [])
    .filter((p) => p.collected_by_type === "worker")
    .reduce((s, p) => s + Number(p.amount), 0);

  const metrics: { label: string; value: number; negative?: boolean }[] = [
    { label: `הזמנות לאספקה היום (${orders?.length ?? 0})`, value: ordersTotal },
    { label: "תשלומי לקוחות שהתקבלו", value: customerPayments },
    { label: "מזה — גביית נהגים", value: driverCollections },
    { label: "סחורה שהתקבלה מספקים", value: goodsReceived, negative: true },
    { label: "תשלומים לספקים", value: totalVendorPayments, negative: true },
    { label: "הוצאות", value: totalExpenses, negative: true },
    { label: "מפרעות לעובדים", value: totalAdvances, negative: true },
  ];

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">דוח יומי</h1>
        <ReportNav
          basePath="/dashboard/reports"
          param="date"
          current={date}
          prev={addDays(date, -1)}
          next={addDays(date, 1)}
          label={formatDate(date)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <Card key={m.label}>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">
                {m.label}
              </CardTitle>
            </CardHeader>
            <CardContent
              className={`text-2xl font-bold ${m.negative && m.value > 0 ? "text-destructive" : ""}`}
            >
              {m.negative && m.value > 0 ? "-" : ""}
              {formatMoney(m.value)}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>שורה תחתונה (תקבולים − תשלומים)</CardTitle>
        </CardHeader>
        <CardContent className="text-3xl font-bold">
          {formatMoney(
            customerPayments -
              totalVendorPayments -
              totalExpenses -
              totalAdvances
          )}
        </CardContent>
      </Card>
    </div>
  );
}
