import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/format";
import { ExportCsvButton } from "@/components/export-csv-button";
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


export async function DebtsReport() {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const [{ data: customers }, { data: customerDebts }, { data: deliveryOrders }] =
    await Promise.all([
      supabase
        .from("customers")
        .select("id, name, phone")
        .eq("business_id", admin.business_id),
      supabase
        .from("customer_debts")
        .select("customer_id, debt")
        .eq("business_id", admin.business_id),
      supabase
        .from("delivery_orders")
        .select("id, order_id, orders(order_number, delivery_code, customer_id, total, payment_status)")
        .eq("business_id", admin.business_id),
    ]);

  const customerNames = new Map(
    (customers ?? []).map((c) => [c.id, { name: c.name, phone: c.phone }])
  );

  const customerRows = (customerDebts ?? [])
    .map((d) => ({
      id: d.customer_id,
      name: customerNames.get(d.customer_id)?.name ?? "—",
      phone: customerNames.get(d.customer_id)?.phone ?? null,
      debt: Number(d.debt),
    }))
    .filter((r) => r.debt > 0)
    .sort((a, b) => b.debt - a.debt);

  // חובות משלוחים: delivery orders whose parent order is still
  // unpaid/partial. Remaining amount comes from orders.total minus
  // payments already recorded for that order.
  type UnpaidOrder = { order_number: number; delivery_code: string | null; customer_id: string; total: number; payment_status: string };
  const unpaidDeliveries = (deliveryOrders ?? [])
    .map((d) => ({
      order_id: d.order_id,
      order: (d as unknown as { orders: UnpaidOrder | null }).orders,
    }))
    .filter((d): d is { order_id: string; order: UnpaidOrder } =>
      !!d.order && ["unpaid", "partial"].includes(d.order.payment_status)
    );

  const orderIdsForPayments = unpaidDeliveries.map((d) => d.order_id);

  const { data: deliveryPayments } = orderIdsForPayments.length
    ? await supabase
        .from("payments")
        .select("order_id, amount")
        .in("order_id", orderIdsForPayments)
    : { data: [] as { order_id: string | null; amount: number }[] };

  const paidByOrder = new Map<string, number>();
  for (const p of deliveryPayments ?? []) {
    if (!p.order_id) continue;
    paidByOrder.set(p.order_id, (paidByOrder.get(p.order_id) ?? 0) + Number(p.amount));
  }

  const totalDeliveryDebt = unpaidDeliveries.reduce(
    (s, d) =>
      s + Math.max(0, d.order.total - (paidByOrder.get(d.order_id) ?? 0)),
    0
  );

  const totalCustomerDebt = customerRows.reduce((s, r) => s + r.debt, 0);

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-bold">דוח חובות</h1>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              חובות לקוחות
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-success">
            {formatMoney(totalCustomerDebt)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              חובות משלוחים
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-warning">
            {formatMoney(totalDeliveryDebt)}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">חובות לקוחות</h2>
          <ExportCsvButton
            filename="customer-debts.csv"
            headers={["לקוח", "טלפון", "חוב"]}
            rows={customerRows.map((r) => [r.name, r.phone, r.debt])}
          />
        </div>
        <div className="rounded-lg border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>לקוח</TableHead>
                <TableHead>טלפון</TableHead>
                <TableHead>חוב</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customerRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="h-16 text-center text-muted-foreground">
                    אין חובות לקוחות 🎉
                  </TableCell>
                </TableRow>
              )}
              {customerRows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link
                      href={`/dashboard/customers/${r.id}`}
                      className="font-medium hover:underline"
                    >
                      {r.name}
                    </Link>
                  </TableCell>
                  <TableCell dir="ltr" className="text-end">
                    {r.phone ?? "—"}
                  </TableCell>
                  <TableCell className="font-bold">{formatMoney(r.debt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
