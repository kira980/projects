import Link from "next/link";
import { Plus, ShoppingBag, ShoppingCart, Truck } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatMoney, formatDate } from "@/lib/format";
import { defaultDeliveryDate } from "@/lib/delivery-day";
import { type OrderStatus } from "@/lib/order-status";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkRow } from "@/components/ui/link-row";
import { OrderStatusBadge } from "@/components/ui/status-badge";
import { OrdersDateFilter } from "./orders-date-filter";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "הזמנות" };

// The bakery workflow cares about three states: new → ready, or shortage.
const FILTERS: { value: string; label: string }[] = [
  { value: "", label: "הכל" },
  { value: "new", label: "חדשות" },
  { value: "ready", label: "מוכנות" },
  { value: "shortage", label: "חסר" },
];

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; date?: string }>;
}) {
  const { status, date: dateParam } = await searchParams;
  const admin = await requireAdmin();
  const supabase = await createClient();

  // Default to the delivery day currently being worked (06:00 rollover).
  const date =
    dateParam === "all"
      ? "all"
      : dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
        ? dateParam
        : defaultDeliveryDate();

  let query = supabase
    .from("orders")
    .select(
      "id, order_number, customer_id, status, delivery_type, delivery_date, total, created_at, customers(name)"
    )
    .eq("business_id", admin.business_id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (status) query = query.eq("status", status);
  if (date !== "all") query = query.eq("delivery_date", date);

  const { data: orders } = await query;

  function filterUrl(value: string) {
    const params = new URLSearchParams();
    if (value) params.set("status", value);
    if (date !== defaultDeliveryDate()) params.set("date", date);
    const qs = params.toString();
    return qs ? `/dashboard/orders?${qs}` : "/dashboard/orders";
  }

  return (
    <div className="grid gap-5">
      <PageHeader
        title="הזמנות"
        description="לחיצה על שורה פותחת את ההזמנה. תשלומים נמצאים בעמוד המשלוח."
      >
        <Button asChild size="lg">
          <Link href="/dashboard/orders/new">
            <Plus />
            הזמנה חדשה
          </Link>
        </Button>
      </PageHeader>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="סינון לפי סטטוס">
          {FILTERS.map((f) => (
            <Button
              key={f.value}
              asChild
              size="sm"
              variant={(status ?? "") === f.value ? "default" : "outline"}
            >
              <Link href={filterUrl(f.value)}>{f.label}</Link>
            </Button>
          ))}
        </div>
        <OrdersDateFilter date={date} />
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>מס&apos;</TableHead>
              <TableHead>לקוח</TableHead>
              <TableHead>אספקה</TableHead>
              <TableHead>סוג</TableHead>
              <TableHead>סה&quot;כ</TableHead>
              <TableHead>סטטוס</TableHead>
              <TableHead>משלוח / איסוף</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(orders ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="p-0">
                  <EmptyState
                    icon={ShoppingCart}
                    title={
                      status
                        ? "אין הזמנות בסטטוס הזה"
                        : date !== "all"
                          ? `אין הזמנות לתאריך ${formatDate(date)}`
                          : "עדיין אין הזמנות"
                    }
                    description="כשתיצרו הזמנה חדשה היא תופיע כאן."
                  >
                    <Button asChild size="lg">
                      <Link href="/dashboard/orders/new">
                        <Plus />
                        הזמנה חדשה
                      </Link>
                    </Button>
                  </EmptyState>
                </TableCell>
              </TableRow>
            )}
            {(orders ?? []).map((o) => {
              const customer = o.customers as unknown as { name: string } | null;
              return (
                <LinkRow key={o.id} href={`/dashboard/orders/${o.id}`}>
                  <TableCell className="font-bold text-primary">
                    #{o.order_number}
                  </TableCell>
                  <TableCell className="font-medium">
                    {customer?.name ?? "—"}
                  </TableCell>
                  <TableCell>{formatDate(o.delivery_date)}</TableCell>
                  <TableCell>
                    {o.delivery_type === "delivery" ? "משלוח" : "איסוף עצמי"}
                  </TableCell>
                  <TableCell className="font-medium">{formatMoney(o.total)}</TableCell>
                  <TableCell>
                    <OrderStatusBadge status={o.status as OrderStatus} />
                  </TableCell>
                  <TableCell>
                    {o.delivery_type === "delivery" ? (
                      <Link
                        href={`/dashboard/deliveries/${o.id}`}
                        className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
                      >
                        <Truck className="size-4" aria-hidden />
                        משלוח
                      </Link>
                    ) : (
                      <Link
                        href={`/dashboard/takeaway?date=${o.delivery_date}`}
                        className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
                      >
                        <ShoppingBag className="size-4" aria-hidden />
                        איסוף עצמי
                      </Link>
                    )}
                  </TableCell>
                </LinkRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
