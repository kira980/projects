import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { jerusalemDayRange } from "@/lib/db/day-lock";
import { normalizeDate } from "@/lib/reports";
import { normalizeDeliveryIdQuery } from "@/lib/deliveries/public-id";
import { formatDate, formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DeliveriesFilterBar } from "./deliveries-filter-bar";
import {
  DeliveriesClient,
  type DeliveryRow,
  type DebtPaymentRow,
} from "./deliveries-client";

export const metadata = { title: "משלוחים" };

const PAGE_SIZE = 25;

function DeliverySummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative";
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-sm leading-tight font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent
        className={`text-xl font-bold ${
          tone === "negative"
            ? "text-destructive"
            : tone === "positive"
              ? "text-success"
              : ""
        }`}
      >
        {value}
      </CardContent>
    </Card>
  );
}

export default async function DeliveriesPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; q?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const admin = await requireAdmin();
  const supabase = await createClient();

  // Deliveries default to today — the vans are on today's roads.
  const date = normalizeDate(sp.date);
  const q = sp.q ?? "";
  const page = Math.max(1, Number(sp.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from("orders")
    .select(
      "id, order_number, public_delivery_id, delivery_code, customer_id, address_text, total, updated_total, status, payment_status, has_shortage, shortage_note, customers(name)",
      { count: "exact" }
    )
    .eq("business_id", admin.business_id)
    .eq("delivery_type", "delivery")
    .eq("delivery_date", date)
    .order("order_number", { ascending: false });

  const qn = normalizeDeliveryIdQuery(q);
  if (qn) {
    query = query.or(
      `delivery_code.ilike.%${qn}%,public_delivery_id.ilike.%${qn}%`
    );
  }

  // Summary cards aggregate the WHOLE filtered set (every matching
  // delivery on the day), not just the current page.
  let summaryQuery = supabase
    .from("orders")
    .select("id, total, updated_total")
    .eq("business_id", admin.business_id)
    .eq("delivery_type", "delivery")
    .eq("delivery_date", date);
  if (qn) {
    summaryQuery = summaryQuery.or(
      `delivery_code.ilike.%${qn}%,public_delivery_id.ilike.%${qn}%`
    );
  }

  // Driver debt payments collected during the day — independent of the
  // order queries, so it runs in the same first wave.
  const { start, end } = jerusalemDayRange(date);
  const driverPaymentsQuery = supabase
    .from("payments")
    .select("id, amount, method, order_id, notes, paid_at, customer_id, collected_by_id, customers(name)")
    .eq("business_id", admin.business_id)
    .eq("collected_by_type", "worker")
    .gte("paid_at", start)
    .lt("paid_at", end);

  // Wave 1 — the three queries that depend only on the request params.
  const [{ data: orders, count }, { data: allMatching }, { data: driverPayments }] =
    await Promise.all([
      query.range(offset, offset + PAGE_SIZE - 1),
      summaryQuery,
      driverPaymentsQuery,
    ]);

  const allMatchingIds = (allMatching ?? []).map((o) => o.id);
  const pageOrderIds = (orders ?? []).map((o) => o.id);
  const collectorIds = [
    ...new Set((driverPayments ?? []).map((p) => p.collected_by_id).filter(Boolean)),
  ] as string[];

  // Wave 2 — dependents of wave 1, batched together.
  const [{ data: allCollected }, { data: deliveryOrders }, { data: collectorWorkers }] =
    await Promise.all([
      allMatchingIds.length
        ? supabase
            .from("delivery_orders")
            .select("collected_amount")
            .eq("business_id", admin.business_id)
            .in("order_id", allMatchingIds)
        : Promise.resolve({ data: [] as { collected_amount: number }[] }),
      pageOrderIds.length
        ? supabase
            .from("delivery_orders")
            .select("id, order_id, status, collected_amount, payment_method, completed_by_worker_id")
            .eq("business_id", admin.business_id)
            .in("order_id", pageOrderIds)
        : Promise.resolve({
            data: [] as {
              id: string;
              order_id: string;
              status: string;
              collected_amount: number;
              payment_method: string | null;
              completed_by_worker_id: string | null;
            }[],
          }),
      collectorIds.length
        ? supabase.from("workers").select("id, full_name").in("id", collectorIds)
        : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    ]);

  const summaryCount = count ?? allMatching?.length ?? 0;
  const summaryTotal = (allMatching ?? []).reduce(
    (s, o) => s + Number(o.updated_total ?? o.total),
    0
  );
  const summaryPaid = (allCollected ?? []).reduce(
    (s, d) => s + Number(d.collected_amount ?? 0),
    0
  );
  const summaryLeft = Math.max(0, summaryTotal - summaryPaid);

  const deliveryOrderByOrderId = new Map(
    (deliveryOrders ?? []).map((d) => [d.order_id, d])
  );

  // Wave 3 — worker names for whoever completed each delivery (depends on
  // the delivery_orders from wave 2).
  const completedByIds = [
    ...new Set(
      (deliveryOrders ?? []).map((d) => d.completed_by_worker_id).filter(Boolean)
    ),
  ] as string[];
  const { data: completedByWorkers } = completedByIds.length
    ? await supabase.from("workers").select("id, full_name").in("id", completedByIds)
    : { data: [] as { id: string; full_name: string }[] };
  const workerNames = new Map((completedByWorkers ?? []).map((w) => [w.id, w.full_name]));

  const deliveryRows: DeliveryRow[] = (orders ?? []).map((o) => {
    const d = deliveryOrderByOrderId.get(o.id);
    return {
      order_id: o.id,
      public_delivery_id: o.public_delivery_id,
      delivery_code: o.delivery_code,
      order_number: Number(o.order_number),
      customer_name:
        (o.customers as unknown as { name: string } | null)?.name ?? "—",
      address_text: o.address_text,
      status: d?.status ?? "pending",
      payment_status: o.payment_status,
      collected_amount: Number(d?.collected_amount ?? 0),
      delivered_by: d?.completed_by_worker_id
        ? (workerNames.get(d.completed_by_worker_id) ?? "—")
        : null,
      total: Number(o.updated_total ?? o.total),
      payment_method: d?.payment_method ?? null,
      shortage_note: o.has_shortage ? o.shortage_note : null,
    };
  });

  const collectorNames = new Map((collectorWorkers ?? []).map((w) => [w.id, w.full_name]));

  const debtPayments: DebtPaymentRow[] = (driverPayments ?? [])
    .filter((p) => !p.order_id)
    .map((p) => ({
      id: p.id,
      paid_at: p.paid_at,
      customer_name:
        (p.customers as unknown as { name: string } | null)?.name ?? "—",
      order_number: null,
      amount: Number(p.amount),
      method: p.method,
      collected_by_name: p.collected_by_id ? (collectorNames.get(p.collected_by_id) ?? "—") : "—",
    }));

  const debtsPaid = debtPayments.reduce((s, p) => s + p.amount, 0);
  const cashCollected = (driverPayments ?? [])
    .filter((p) => p.method === "cash")
    .reduce((s, p) => s + Number(p.amount), 0);

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  function pageUrl(p: number) {
    const params = new URLSearchParams();
    params.set("date", date);
    if (q) params.set("q", q);
    params.set("page", String(p));
    return `/dashboard/deliveries?${params.toString()}`;
  }

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-bold">משלוחים</h1>
        <p className="text-muted-foreground">{formatDate(date)}</p>
      </div>

      <DeliveriesFilterBar date={date} q={q} searchPlaceholder="חיפוש לפי מספר משלוח (A01)..." />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <DeliverySummaryCard label="מספר משלוחים" value={String(summaryCount)} />
        <DeliverySummaryCard label={'סה"כ'} value={formatMoney(summaryTotal)} />
        <DeliverySummaryCard label="נגבה" value={formatMoney(summaryPaid)} tone="positive" />
        <DeliverySummaryCard
          label="נותר לגבייה"
          value={formatMoney(summaryLeft)}
          tone={summaryLeft > 0 ? "negative" : undefined}
        />
        <DeliverySummaryCard
          label="תשלומי חוב קודמים"
          value={formatMoney(debtsPaid)}
          tone="positive"
        />
        <DeliverySummaryCard
          label="סך מזומן שנגבה"
          value={formatMoney(cashCollected)}
          tone="positive"
        />
      </div>

      <DeliveriesClient deliveryRows={deliveryRows} debtPayments={debtPayments} />

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <Button variant="outline" size="sm" disabled={page <= 1} asChild={page > 1}>
            {page > 1 ? <Link href={pageUrl(page - 1)}>הקודם</Link> : <span>הקודם</span>}
          </Button>
          <span className="text-muted-foreground">
            עמוד {page} מתוך {totalPages} · {count ?? 0} משלוחים
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} asChild={page < totalPages}>
            {page < totalPages ? <Link href={pageUrl(page + 1)}>הבא</Link> : <span>הבא</span>}
          </Button>
        </div>
      )}
    </div>
  );
}
