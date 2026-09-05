import { redirect } from "next/navigation";
import { getWorkerSession } from "@/lib/kiosk/session";
import { createServiceClient } from "@/lib/supabase/server";
import { businessToday } from "@/lib/db/day-lock";
import {
  WorkerOrdersClient,
  type OrderTypeTab,
  type WorkerOrder,
} from "./orders-client";

export const metadata = { title: "הזמנות" };

export const dynamic = "force-dynamic";

/**
 * The shift manager's order screen: the day's orders, איסוף עצמי first
 * with a switch to משלוח. Each order can be handed over (נאסף / נמסר, paid
 * or unpaid) and its documents printed.
 */
export default async function WorkerOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; type?: string }>;
}) {
  const session = await getWorkerSession("kiosk");
  if (!session) redirect("/workers");
  if (!session.canManageShift) redirect("/workers/menu");

  const sp = await searchParams;
  const today = businessToday();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : today;
  // Counter pickups are the common case, so they open first.
  const type: OrderTypeTab = sp.type === "delivery" ? "delivery" : "takeaway";

  const supabase = createServiceClient();
  const { data: orders } = await supabase
    .from("orders")
    .select(
      "id, order_number, delivery_code, delivery_type, delivery_time, status, total, updated_total, receipt, customers(name, phone)"
    )
    .eq("business_id", session.businessId)
    .eq("delivery_date", date)
    .eq("delivery_type", type === "takeaway" ? "pickup" : "delivery")
    .order("delivery_time", { ascending: true, nullsFirst: false })
    .order("order_number");

  // One round trip for the payments behind every order on screen, so each
  // card can show what is still owed.
  const orderIds = (orders ?? []).map((o) => o.id);
  const { data: payments } = orderIds.length
    ? await supabase
        .from("payments")
        .select("order_id, amount")
        .in("order_id", orderIds)
    : { data: [] as { order_id: string | null; amount: number }[] };

  const paidByOrder = new Map<string, number>();
  for (const p of payments ?? []) {
    if (!p.order_id) continue;
    paidByOrder.set(
      p.order_id,
      (paidByOrder.get(p.order_id) ?? 0) + Number(p.amount)
    );
  }

  const mapped: WorkerOrder[] = (orders ?? []).map((o) => {
    const customer = o.customers as unknown as {
      name: string;
      phone: string | null;
    } | null;
    const total = Number(o.updated_total ?? o.total);
    return {
      id: o.id,
      order_number: Number(o.order_number),
      delivery_code: o.delivery_code,
      customer_name: customer?.name ?? "—",
      customer_phone: customer?.phone ?? null,
      delivery_time: o.delivery_time,
      status: o.status,
      total,
      remaining: Math.max(0, total - (paidByOrder.get(o.id) ?? 0)),
      receipt: Boolean(o.receipt),
    };
  });

  return (
    <WorkerOrdersClient
      key={`${type}:${date}`}
      orders={mapped}
      date={date}
      today={today}
      type={type}
    />
  );
}
