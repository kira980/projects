import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Tags } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
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
import { formatMoney, formatDate, formatDateTime } from "@/lib/format";
import {
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  type OrderStatus,
  type PaymentStatus,
} from "@/lib/order-status";
import { CustomerDialog } from "../customer-dialog";
import { AddressSection } from "./address-section";

export const metadata = { title: "פרופיל לקוח" };

const PAGE_SIZE = 10;

const METHOD_LABELS: Record<string, string> = {
  cash: "מזומן",
  card: "אשראי",
  transfer: "העברה",
  check: "צ'ק",
  other: "אחר",
};

function pageNum(v: string | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

export default async function CustomerProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ op?: string; pp?: string }>;
}) {
  const { id } = await params;
  const { op, pp } = await searchParams;
  const ordersPage = pageNum(op);
  const paymentsPage = pageNum(pp);
  const admin = await requireAdmin();
  const supabase = await createClient();

  const { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .eq("business_id", admin.business_id)
    .single();

  if (!customer) notFound();

  const oFrom = (ordersPage - 1) * PAGE_SIZE;
  const pFrom = (paymentsPage - 1) * PAGE_SIZE;

  const [
    { data: addresses },
    { data: debtRow },
    { data: orders, count: ordersCount },
    { data: payments, count: paymentsCount },
  ] = await Promise.all([
    supabase
      .from("customer_addresses")
      .select("id, label, address_text, city, is_default, notes")
      .eq("customer_id", id)
      .order("is_default", { ascending: false })
      .order("created_at"),
    supabase
      .from("customer_debts")
      .select("debt")
      .eq("customer_id", id)
      .maybeSingle(),
    supabase
      .from("orders")
      .select(
        "id, order_number, public_delivery_id, created_at, delivery_date, status, total, original_total, updated_total, payment_status, shortage_note, has_shortage",
        { count: "exact" }
      )
      .eq("customer_id", id)
      .eq("business_id", admin.business_id)
      .order("created_at", { ascending: false })
      .range(oFrom, oFrom + PAGE_SIZE - 1),
    supabase
      .from("payments")
      .select(
        "id, paid_at, amount, method, notes, order_id, collected_by_type, collected_by_id",
        { count: "exact" }
      )
      .eq("customer_id", id)
      .eq("business_id", admin.business_id)
      .order("paid_at", { ascending: false })
      .range(pFrom, pFrom + PAGE_SIZE - 1),
  ]);

  const totalDebt = Number(debtRow?.debt ?? 0);

  // Everything below depends only on the first batch (visible orders +
  // payments), so it all runs in one parallel round; only the related-
  // orders lookup truly depends on the allocation rows and runs after.
  const pageOrderIds = (orders ?? []).map((o) => o.id);
  const paymentIds = (payments ?? []).map((p) => p.id);
  const workerIds = [
    ...new Set(
      (payments ?? [])
        .filter((p) => p.collected_by_type === "worker" && p.collected_by_id)
        .map((p) => p.collected_by_id as string)
    ),
  ];
  const adminIds = [
    ...new Set(
      (payments ?? [])
        .filter((p) => p.collected_by_type === "admin" && p.collected_by_id)
        .map((p) => p.collected_by_id as string)
    ),
  ];

  const [
    { data: opays },
    { data: oallocs },
    { data: allocRows },
    { data: workerRows },
    { data: adminRows },
  ] = await Promise.all([
    pageOrderIds.length
      ? supabase.from("payments").select("order_id, amount").in("order_id", pageOrderIds)
      : Promise.resolve({ data: [] as { order_id: string; amount: number }[] }),
    pageOrderIds.length
      ? supabase
          .from("payment_allocations")
          .select("order_id, amount")
          .in("order_id", pageOrderIds)
      : Promise.resolve({ data: [] as { order_id: string; amount: number }[] }),
    paymentIds.length
      ? supabase
          .from("payment_allocations")
          .select("payment_id, order_id")
          .in("payment_id", paymentIds)
      : Promise.resolve({ data: [] as { payment_id: string; order_id: string }[] }),
    workerIds.length
      ? supabase.from("workers").select("id, full_name").in("id", workerIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    adminIds.length
      ? supabase.from("profiles").select("id, full_name").in("id", adminIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ]);

  // Per-order remaining for the visible page.
  const paidByOrder = new Map<string, number>();
  for (const p of opays ?? [])
    paidByOrder.set(p.order_id, (paidByOrder.get(p.order_id) ?? 0) + Number(p.amount));
  for (const a of oallocs ?? [])
    paidByOrder.set(a.order_id, (paidByOrder.get(a.order_id) ?? 0) + Number(a.amount));

  // Resolve related orders for the visible payments.
  const relatedOrderIds = [
    ...new Set([
      ...(payments ?? []).map((p) => p.order_id).filter(Boolean),
      ...(allocRows ?? []).map((a) => a.order_id),
    ]),
  ] as string[];
  const { data: relOrders } = relatedOrderIds.length
    ? await supabase
        .from("orders")
        .select("id, order_number, public_delivery_id")
        .in("id", relatedOrderIds)
    : { data: [] as { id: string; order_number: number; public_delivery_id: string | null }[] };
  const orderById = new Map((relOrders ?? []).map((o) => [o.id, o]));
  const allocsByPayment = new Map<string, string[]>();
  for (const a of allocRows ?? []) {
    allocsByPayment.set(a.payment_id, [...(allocsByPayment.get(a.payment_id) ?? []), a.order_id]);
  }
  const nameById = new Map<string, string>();
  for (const w of workerRows ?? []) nameById.set(w.id, w.full_name);
  for (const a of adminRows ?? []) nameById.set(a.id, a.full_name);

  const ordersTotalPages = Math.max(1, Math.ceil((ordersCount ?? 0) / PAGE_SIZE));
  const paymentsTotalPages = Math.max(1, Math.ceil((paymentsCount ?? 0) / PAGE_SIZE));

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon" asChild aria-label="חזרה">
          <Link href="/dashboard/customers">
            <ArrowRight className="size-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">{customer.name}</h1>
        {!customer.is_active && <Badge variant="destructive">לא פעיל</Badge>}
        {customer.can_order_online && (
          <Badge variant="secondary">הזמנות אונליין (עתידי)</Badge>
        )}
        <div className="ms-auto flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/dashboard/customers/${id}/prices`}>
              <Tags className="size-4" />
              מחירון הלקוח
            </Link>
          </Button>
          <CustomerDialog
            customer={customer}
            trigger={<Button variant="outline">עריכה</Button>}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">טלפון</CardTitle>
          </CardHeader>
          <CardContent dir="ltr" className="text-end font-medium">
            {customer.phone ?? "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">סה&quot;כ הזמנות</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{ordersCount ?? 0}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">סה&quot;כ חוב</CardTitle>
          </CardHeader>
          <CardContent
            className={
              "text-2xl font-bold " + (totalDebt > 0 ? "text-red-600" : "text-emerald-700")
            }
          >
            {formatMoney(totalDebt)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              מחירון הלקוח
            </CardTitle>
          </CardHeader>
          <CardContent className="font-medium">
            <Link href={`/dashboard/customers/${id}/prices`} className="hover:underline">
              צפייה במחירון
            </Link>
          </CardContent>
        </Card>
      </div>

      <AddressSection customerId={id} addresses={addresses ?? []} />

      {/* Orders */}
      <div className="grid gap-3">
        <h2 className="text-lg font-semibold">הזמנות</h2>
        <div className="rounded-lg border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>הזמנה</TableHead>
                <TableHead>מס&apos; משלוח</TableHead>
                <TableHead>תאריך הזמנה</TableHead>
                <TableHead>תאריך אספקה</TableHead>
                <TableHead>סטטוס</TableHead>
                <TableHead>סה&quot;כ</TableHead>
                <TableHead>תשלום</TableHead>
                <TableHead>יתרת חוב</TableHead>
                <TableHead>חוסר</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(orders ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                    אין הזמנות ללקוח זה
                  </TableCell>
                </TableRow>
              )}
              {(orders ?? []).map((o) => {
                const total = Number(o.updated_total ?? o.total);
                const remaining = Math.max(0, total - (paidByOrder.get(o.id) ?? 0));
                return (
                  <TableRow key={o.id}>
                    <TableCell>
                      <Link
                        href={`/dashboard/orders/${o.id}`}
                        className="font-medium hover:underline"
                      >
                        #{o.order_number}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono">
                      {o.public_delivery_id ? (
                        <Link
                          href={`/dashboard/deliveries/${o.id}`}
                          className="hover:underline"
                        >
                          {o.public_delivery_id}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>{formatDate(o.created_at)}</TableCell>
                    <TableCell>{formatDate(o.delivery_date)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {ORDER_STATUS_LABELS[o.status as OrderStatus] ?? o.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatMoney(total)}
                      {o.has_shortage && o.original_total != null && (
                        <span className="text-xs text-muted-foreground line-through">
                          {" "}
                          {formatMoney(Number(o.original_total))}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {PAYMENT_STATUS_LABELS[o.payment_status as PaymentStatus] ??
                        o.payment_status}
                    </TableCell>
                    <TableCell className={remaining > 0 ? "font-medium text-red-600" : ""}>
                      {formatMoney(remaining)}
                    </TableCell>
                    <TableCell className="max-w-40 truncate text-sm text-orange-700">
                      {o.shortage_note ?? "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <Pagination
          basePath={`/dashboard/customers/${id}`}
          param="op"
          page={ordersPage}
          totalPages={ordersTotalPages}
          other={paymentsPage > 1 ? `pp=${paymentsPage}` : ""}
        />
      </div>

      {/* Debt payments */}
      <div className="grid gap-3">
        <h2 className="text-lg font-semibold">תשלומי חוב</h2>
        <div className="rounded-lg border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>תאריך</TableHead>
                <TableHead>סכום</TableHead>
                <TableHead>אמצעי</TableHead>
                <TableHead>הזמנות / מס&apos; משלוח</TableHead>
                <TableHead>הערה</TableHead>
                <TableHead>נרשם ע&quot;י</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(payments ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    אין תשלומי חוב ללקוח זה
                  </TableCell>
                </TableRow>
              )}
              {(payments ?? []).map((p) => {
                const relIds =
                  allocsByPayment.get(p.id) ??
                  (p.order_id ? [p.order_id] : []);
                const rel = relIds
                  .map((oid) => orderById.get(oid))
                  .filter(Boolean) as {
                  order_number: number;
                  public_delivery_id: string | null;
                }[];
                return (
                  <TableRow key={p.id}>
                    <TableCell>{formatDateTime(p.paid_at)}</TableCell>
                    <TableCell className="font-medium">{formatMoney(p.amount)}</TableCell>
                    <TableCell>{METHOD_LABELS[p.method] ?? p.method}</TableCell>
                    <TableCell className="text-sm">
                      {rel.length === 0
                        ? "על חשבון חוב"
                        : rel
                            .map(
                              (o) =>
                                `#${o.order_number}${o.public_delivery_id ? ` (${o.public_delivery_id})` : ""}`
                            )
                            .join(", ")}
                    </TableCell>
                    <TableCell className="max-w-40 truncate">{p.notes ?? "—"}</TableCell>
                    <TableCell>
                      {p.collected_by_id ? (nameById.get(p.collected_by_id) ?? "—") : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <Pagination
          basePath={`/dashboard/customers/${id}`}
          param="pp"
          page={paymentsPage}
          totalPages={paymentsTotalPages}
          other={ordersPage > 1 ? `op=${ordersPage}` : ""}
        />
      </div>
    </div>
  );
}

function Pagination({
  basePath,
  param,
  page,
  totalPages,
  other,
}: {
  basePath: string;
  param: string;
  page: number;
  totalPages: number;
  other: string;
}) {
  if (totalPages <= 1) return null;
  const q = (p: number) => {
    const parts = [`${param}=${p}`, other].filter(Boolean);
    return `${basePath}?${parts.join("&")}`;
  };
  return (
    <div className="flex items-center justify-between text-sm">
      <Button variant="outline" size="sm" disabled={page <= 1} asChild={page > 1}>
        {page > 1 ? <Link href={q(page - 1)}>הקודם</Link> : <span>הקודם</span>}
      </Button>
      <span className="text-muted-foreground">
        עמוד {page} מתוך {totalPages}
      </span>
      <Button variant="outline" size="sm" disabled={page >= totalPages} asChild={page < totalPages}>
        {page < totalPages ? <Link href={q(page + 1)}>הבא</Link> : <span>הבא</span>}
      </Button>
    </div>
  );
}
