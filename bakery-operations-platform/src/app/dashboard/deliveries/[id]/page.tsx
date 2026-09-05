import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateReceiptButton } from "@/app/dashboard/orders/[id]/order-detail-client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney, formatDate, formatDateTime } from "@/lib/format";
import {
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  UNIT_TYPE_LABELS,
  type OrderStatus,
  type PaymentStatus,
} from "@/lib/order-status";

export const metadata = { title: "פרטי משלוח" };

const DO_STATUS_LABELS: Record<string, string> = {
  pending: "ממתין",
  delivered_paid: "נמסר ושולם",
  delivered_unpaid: "נמסר ללא תשלום",
  partial: "שולם חלקית",
  failed: "נכשל",
};

export default async function DeliveryDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = await requireAdmin();
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, order_number, public_delivery_id, customer_id, status, payment_status, delivery_type, delivery_date, delivery_time, address_text, total, original_total, updated_total, has_shortage, shortage_note, notes, notes_for_driver, receipt, created_at, customers(name, phone)"
    )
    .eq("id", id)
    .eq("business_id", admin.business_id)
    .single();

  if (!order) notFound();

  const [{ data: items }, { data: deliveryOrder }, { data: payments }, { data: allocs }, { data: history }] =
    await Promise.all([
      supabase
        .from("order_items")
        .select(
          "id, product_name, unit_type, quantity, original_quantity, prepared_quantity, missing_quantity, unit_price, line_total, shortage_note"
        )
        .eq("order_id", id)
        .order("created_at"),
      supabase
        .from("delivery_orders")
        .select("id, status, collected_amount, payment_method, driver_notes, completed_at, completed_by_worker_id")
        .eq("order_id", id)
        .maybeSingle(),
      supabase.from("payments").select("amount").eq("order_id", id),
      supabase.from("payment_allocations").select("amount").eq("order_id", id),
      supabase
        .from("audit_logs")
        .select("id, action, actor_name, created_at, details")
        .eq("business_id", admin.business_id)
        .eq("entity_id", id)
        .order("created_at", { ascending: true }),
    ]);

  const customer = order.customers as unknown as { name: string; phone: string | null } | null;

  let driverName: string | null = null;
  if (deliveryOrder?.completed_by_worker_id) {
    const { data: w } = await supabase
      .from("workers")
      .select("full_name")
      .eq("id", deliveryOrder.completed_by_worker_id)
      .maybeSingle();
    driverName = w?.full_name ?? null;
  }

  const total = Number(order.updated_total ?? order.total);
  const paid =
    (payments ?? []).reduce((s, p) => s + Number(p.amount), 0) +
    (allocs ?? []).reduce((s, a) => s + Number(a.amount), 0);
  const remaining = Math.max(0, total - paid);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon" asChild aria-label="חזרה">
          <Link href="/dashboard/deliveries">
            <ArrowRight className="size-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold font-mono">{order.public_delivery_id ?? "—"}</h1>
        <span className="text-muted-foreground">הזמנה #{order.order_number}</span>
        <Badge variant="outline">
          {ORDER_STATUS_LABELS[order.status as OrderStatus] ?? order.status}
        </Badge>
        {order.has_shortage && <Badge className="bg-orange-600 text-white">ناقص</Badge>}
        <div className="ms-auto flex flex-wrap gap-2">
          <Button asChild>
            <Link href={`/dashboard/deliveries/${id}/quote`}>
              <FileText className="size-4" />
              הצעת מחיר
            </Link>
          </Button>
          {order.receipt ? (
            <>
              <Button variant="outline" asChild>
                <Link href={`/dashboard/orders/${id}/doc/receipt`}>
                  <FileText className="size-4" />
                  קבלה
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href={`/dashboard/orders/${id}/doc/delivery-note`}>
                  <FileText className="size-4" />
                  תעודת משלוח
                </Link>
              </Button>
            </>
          ) : (
            order.status !== "cancelled" && (
              <CreateReceiptButton orderId={id} isDelivery />
            )
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">לקוח</CardTitle>
          </CardHeader>
          <CardContent className="font-medium">
            <Link href={`/dashboard/customers/${order.customer_id}`} className="hover:underline">
              {customer?.name ?? "—"}
            </Link>
            {customer?.phone && (
              <p dir="ltr" className="text-end text-sm text-muted-foreground">
                {customer.phone}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">נהג</CardTitle>
          </CardHeader>
          <CardContent className="font-medium">{driverName ?? "טרם נמסר"}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">תאריך אספקה</CardTitle>
          </CardHeader>
          <CardContent className="font-medium">
            {formatDate(order.delivery_date)}
            {order.delivery_time ? ` · ${order.delivery_time}` : ""}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">כתובת</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{order.address_text ?? "—"}</CardContent>
        </Card>
      </div>

      {/* Items */}
      <div className="grid gap-3">
        <h2 className="text-lg font-semibold">פריטים</h2>
        <div className="rounded-lg border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>מוצר</TableHead>
                <TableHead>הוזמן</TableHead>
                <TableHead>הוכן</TableHead>
                <TableHead>חוסר</TableHead>
                <TableHead>מחיר יחידה</TableHead>
                <TableHead>סה&quot;כ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(items ?? []).map((it) => {
                const ordered = Number(it.original_quantity ?? it.quantity);
                const prepared = Number(it.prepared_quantity ?? it.quantity);
                const missing = Number(it.missing_quantity ?? 0);
                const unit = UNIT_TYPE_LABELS[it.unit_type] ?? it.unit_type;
                return (
                  <TableRow key={it.id}>
                    <TableCell className="font-medium">{it.product_name}</TableCell>
                    <TableCell>
                      {ordered} {unit}
                    </TableCell>
                    <TableCell>
                      {prepared} {unit}
                    </TableCell>
                    <TableCell className={missing > 0 ? "font-medium text-orange-600" : ""}>
                      {missing > 0 ? `${missing} ${unit}` : "—"}
                    </TableCell>
                    <TableCell>{formatMoney(it.unit_price)}</TableCell>
                    <TableCell className="font-medium">{formatMoney(it.line_total)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        {order.has_shortage && order.original_total != null && (
          <div className="flex justify-end gap-6 text-sm">
            <span className="text-muted-foreground line-through">
              מקורי: {formatMoney(Number(order.original_total))}
            </span>
            <span className="font-bold">מעודכן: {formatMoney(total)}</span>
          </div>
        )}
        {order.shortage_note && (
          <p className="rounded-lg border border-orange-300 bg-orange-50 p-2 text-sm text-orange-900">
            ⚠️ {order.shortage_note}
          </p>
        )}
      </div>

      {/* Payment + notes */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">סטטוס תשלום</CardTitle>
          </CardHeader>
          <CardContent className="font-medium">
            {PAYMENT_STATUS_LABELS[order.payment_status as PaymentStatus] ?? order.payment_status}
            {deliveryOrder && (
              <p className="text-sm text-muted-foreground">
                מסירה: {DO_STATUS_LABELS[deliveryOrder.status] ?? deliveryOrder.status}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">יתרת חוב</CardTitle>
          </CardHeader>
          <CardContent
            className={"text-xl font-bold " + (remaining > 0 ? "text-red-600" : "text-emerald-700")}
          >
            {formatMoney(remaining)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">הערות</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {order.notes || order.notes_for_driver || deliveryOrder?.driver_notes || "—"}
          </CardContent>
        </Card>
      </div>

      {/* Status history */}
      <div className="grid gap-3">
        <h2 className="text-lg font-semibold">היסטוריית סטטוס</h2>
        <div className="rounded-lg border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>מתי</TableHead>
                <TableHead>פעולה</TableHead>
                <TableHead>מבצע</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(history ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="h-20 text-center text-muted-foreground">
                    אין היסטוריה
                  </TableCell>
                </TableRow>
              )}
              {(history ?? []).map((h) => (
                <TableRow key={h.id}>
                  <TableCell>{formatDateTime(h.created_at)}</TableCell>
                  <TableCell>{h.action}</TableCell>
                  <TableCell>{h.actor_name}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
