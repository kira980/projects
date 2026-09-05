import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { normalizeDate } from "@/lib/reports";
import { normalizeDeliveryIdQuery } from "@/lib/deliveries/public-id";
import { formatDate, formatMoney } from "@/lib/format";
import {
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
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
import { DeliveriesFilterBar } from "../deliveries/deliveries-filter-bar";

export const metadata = { title: "איסוף עצמי" };

const PAGE_SIZE = 25;

function SummaryCard({
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

/** Takeaway (pickup) orders for a day — same minimal filters as deliveries. */
export default async function TakeawayPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; q?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const admin = await requireAdmin();
  const supabase = await createClient();

  const date = normalizeDate(sp.date);
  const q = sp.q ?? "";
  const page = Math.max(1, Number(sp.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from("orders")
    .select(
      "id, order_number, delivery_code, delivery_time, total, updated_total, status, payment_status, notes, customers(name)",
      { count: "exact" }
    )
    .eq("business_id", admin.business_id)
    .eq("delivery_type", "pickup")
    .eq("delivery_date", date)
    .order("order_number", { ascending: false });

  const qn = normalizeDeliveryIdQuery(q);
  if (qn) query = query.ilike("delivery_code", `%${qn}%`);

  const { data: orders, count } = await query.range(offset, offset + PAGE_SIZE - 1);

  // Summary over the whole filtered day, not just the page.
  let summaryQuery = supabase
    .from("orders")
    .select("total, updated_total, payment_status")
    .eq("business_id", admin.business_id)
    .eq("delivery_type", "pickup")
    .eq("delivery_date", date)
    .neq("status", "cancelled");
  if (qn) summaryQuery = summaryQuery.ilike("delivery_code", `%${qn}%`);
  const { data: allMatching } = await summaryQuery;

  const summaryTotal = (allMatching ?? []).reduce(
    (s, o) => s + Number(o.updated_total ?? o.total),
    0
  );
  const unpaidCount = (allMatching ?? []).filter(
    (o) => o.payment_status !== "paid"
  ).length;

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  function pageUrl(p: number) {
    const params = new URLSearchParams();
    params.set("date", date);
    if (q) params.set("q", q);
    params.set("page", String(p));
    return `/dashboard/takeaway?${params.toString()}`;
  }

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-bold">איסוף עצמי</h1>
        <p className="text-muted-foreground">{formatDate(date)}</p>
      </div>

      <DeliveriesFilterBar
        date={date}
        q={q}
        searchPlaceholder="חיפוש לפי מספר (TA01)..."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <SummaryCard label="הזמנות" value={String(allMatching?.length ?? 0)} />
        <SummaryCard label={'סה"כ'} value={formatMoney(summaryTotal)} />
        <SummaryCard
          label="טרם שולמו"
          value={String(unpaidCount)}
          tone={unpaidCount > 0 ? "negative" : undefined}
        />
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>מס&apos; איסוף</TableHead>
              <TableHead>לקוח</TableHead>
              <TableHead>שעה</TableHead>
              <TableHead>סטטוס</TableHead>
              <TableHead>תשלום</TableHead>
              <TableHead>סה&quot;כ הזמנה</TableHead>
              <TableHead>הערות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(orders ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  אין הזמנות איסוף עצמי ביום זה
                </TableCell>
              </TableRow>
            )}
            {(orders ?? []).map((o) => (
              <TableRow key={o.id}>
                <TableCell className="font-mono font-bold">
                  <Link
                    href={`/dashboard/orders/${o.id}`}
                    className="text-primary hover:underline"
                  >
                    {o.delivery_code ?? `#${o.order_number}`}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link
                    href={`/dashboard/orders/${o.id}`}
                    className="font-medium hover:underline"
                  >
                    {(o.customers as unknown as { name: string } | null)?.name ?? "—"}
                  </Link>
                </TableCell>
                <TableCell>{o.delivery_time ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={o.status === "cancelled" ? "destructive" : "outline"}>
                    {ORDER_STATUS_LABELS[o.status as OrderStatus] ?? o.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      o.payment_status === "paid"
                        ? "secondary"
                        : o.payment_status === "partial"
                          ? "outline"
                          : "destructive"
                    }
                  >
                    {PAYMENT_STATUS_LABELS[o.payment_status as PaymentStatus] ??
                      o.payment_status}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium">
                  {formatMoney(Number(o.updated_total ?? o.total))}
                </TableCell>
                <TableCell className="max-w-48 truncate text-muted-foreground">
                  {o.notes ?? ""}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <Button variant="outline" size="sm" disabled={page <= 1} asChild={page > 1}>
            {page > 1 ? <Link href={pageUrl(page - 1)}>הקודם</Link> : <span>הקודם</span>}
          </Button>
          <span className="text-muted-foreground">
            עמוד {page} מתוך {totalPages} · {count ?? 0} הזמנות
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} asChild={page < totalPages}>
            {page < totalPages ? <Link href={pageUrl(page + 1)}>הבא</Link> : <span>הבא</span>}
          </Button>
        </div>
      )}
    </div>
  );
}
