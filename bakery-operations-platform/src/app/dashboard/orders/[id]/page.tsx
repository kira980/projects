import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatMoney, formatDate, formatDateTime } from "@/lib/format";
import {
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  UNIT_TYPE_LABELS,
  PAYMENT_METHODS,
  type OrderStatus,
  type PaymentStatus,
} from "@/lib/order-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  CancelOrderButton,
  CreateReceiptButton,
  PaymentDialog,
  QuoteButton,
} from "./order-detail-client";

export const metadata = { title: "פרטי הזמנה" };

const methodLabel = (value: string) =>
  PAYMENT_METHODS.find((m) => m.value === value)?.label ?? value;

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = await requireAdmin();
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("*, customers(name, phone)")
    .eq("id", id)
    .eq("business_id", admin.business_id)
    .single();

  if (!order) notFound();

  const [{ data: items }, { data: payments }, { count: issuedDocs }] =
    await Promise.all([
      supabase
        .from("order_items")
        .select("id, product_name, unit_type, quantity, unit_price, line_total, notes")
        .eq("order_id", id)
        .order("created_at"),
      supabase
        .from("payments")
        .select("id, amount, method, paid_at, notes")
        .eq("order_id", id)
        .order("paid_at", { ascending: false }),
      supabase
        .from("order_documents")
        .select("id", { count: "exact", head: true })
        .eq("order_id", id)
        .not("doc_number", "is", null),
    ]);

  const customer = order.customers as unknown as {
    name: string;
    phone: string | null;
  } | null;

  const paidSum = (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
  const remaining = Math.max(0, Number(order.total) - paidSum);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon" asChild aria-label="חזרה">
          <Link href="/dashboard/orders">
            <ArrowRight className="size-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">הזמנה #{order.order_number}</h1>
        {order.delivery_code && (
          <Badge variant="outline" className="font-mono text-base">
            {order.delivery_code}
          </Badge>
        )}
        <Badge>{ORDER_STATUS_LABELS[order.status as OrderStatus]}</Badge>
        <Badge
          variant={
            order.payment_status === "paid"
              ? "secondary"
              : order.payment_status === "partial"
                ? "outline"
                : "destructive"
          }
        >
          {PAYMENT_STATUS_LABELS[order.payment_status as PaymentStatus]}
        </Badge>
        <div className="ms-auto flex flex-wrap gap-2">
          <QuoteButton orderId={id} />
          {order.receipt ? (
            <>
              <Button variant="outline" asChild>
                <Link href={`/dashboard/orders/${id}/doc/receipt`}>
                  <FileText className="size-4" />
                  קבלה
                </Link>
              </Button>
              {order.delivery_type === "delivery" && (
                <Button variant="outline" asChild>
                  <Link href={`/dashboard/orders/${id}/doc/delivery-note`}>
                    <FileText className="size-4" />
                    תעודת משלוח
                  </Link>
                </Button>
              )}
            </>
          ) : (
            order.status !== "cancelled" && (
              <CreateReceiptButton
                orderId={id}
                isDelivery={order.delivery_type === "delivery"}
              />
            )
          )}
          <PaymentDialog orderId={id} remaining={remaining} />
          <CancelOrderButton
            orderId={id}
            orderNumber={Number(order.order_number)}
            hasIssuedDocs={(issuedDocs ?? 0) > 0}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">לקוח</CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              href={`/dashboard/customers/${order.customer_id}`}
              className="font-medium hover:underline"
            >
              {customer?.name}
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
            <CardTitle className="text-sm text-muted-foreground">אספקה</CardTitle>
          </CardHeader>
          <CardContent className="font-medium">
            {order.delivery_type === "delivery" ? "משלוח" : "איסוף עצמי"} ·{" "}
            {formatDate(order.delivery_date)}
            {order.delivery_time ? ` · ${order.delivery_time}` : ""}
            {order.address_text && (
              <p className="text-sm font-normal text-muted-foreground">
                {order.address_text}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">סה&quot;כ</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {formatMoney(order.total)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">נותר לתשלום</CardTitle>
          </CardHeader>
          <CardContent
            className={`text-2xl font-bold ${remaining > 0 ? "text-destructive" : "text-green-600"}`}
          >
            {formatMoney(remaining)}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>פריטים</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>מוצר</TableHead>
                <TableHead>כמות</TableHead>
                <TableHead>מחיר יחידה</TableHead>
                <TableHead>סה&quot;כ שורה</TableHead>
                <TableHead>הערות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(items ?? []).map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.product_name}</TableCell>
                  <TableCell>
                    {Number(item.quantity)}{" "}
                    {UNIT_TYPE_LABELS[item.unit_type] ?? item.unit_type}
                  </TableCell>
                  <TableCell>{formatMoney(item.unit_price)}</TableCell>
                  <TableCell className="font-medium">
                    {formatMoney(item.line_total)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.notes ?? ""}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {(order.notes || order.notes_for_baker || order.notes_for_driver) && (
        <div className="grid gap-4 sm:grid-cols-3">
          {order.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">הערה כללית</CardTitle>
              </CardHeader>
              <CardContent>{order.notes}</CardContent>
            </Card>
          )}
          {order.notes_for_baker && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">הערה לאופה</CardTitle>
              </CardHeader>
              <CardContent>{order.notes_for_baker}</CardContent>
            </Card>
          )}
          {order.notes_for_driver && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">הערה לנהג</CardTitle>
              </CardHeader>
              <CardContent>{order.notes_for_driver}</CardContent>
            </Card>
          )}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>תשלומים</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>זמן</TableHead>
                <TableHead>סכום</TableHead>
                <TableHead>אמצעי</TableHead>
                <TableHead>הערה</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(payments ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="h-16 text-center text-muted-foreground">
                    אין תשלומים עדיין
                  </TableCell>
                </TableRow>
              )}
              {(payments ?? []).map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{formatDateTime(p.paid_at)}</TableCell>
                  <TableCell className="font-medium">{formatMoney(p.amount)}</TableCell>
                  <TableCell>{methodLabel(p.method)}</TableCell>
                  <TableCell className="text-muted-foreground">{p.notes ?? ""}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
