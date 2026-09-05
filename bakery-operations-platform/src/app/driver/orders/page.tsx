import { redirect } from "next/navigation";
import { getWorkerSession } from "@/lib/kiosk/session";
import { createServiceClient } from "@/lib/supabase/server";
import { businessToday, jerusalemDayRange } from "@/lib/db/day-lock";
import { DriverOrdersClient, type DriverStop } from "./driver-orders-client";

export const dynamic = "force-dynamic";

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function DriverOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const session = await getWorkerSession("driver");
  if (!session) redirect("/driver");

  const supabase = createServiceClient();
  const sp = await searchParams;
  const today = businessToday();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : today;

  // Any active worker sees every open delivery for today — there's no
  // per-driver assignment step. A delivery_orders row only exists once
  // someone (any worker) has completed that stop.
  const { data: orders } = await supabase
    .from("orders")
    .select(
      "id, order_number, delivery_code, customer_id, address_text, delivery_time, notes_for_driver, total, customers(name, phone), order_items(product_name, quantity, unit_type)"
    )
    .eq("business_id", session.businessId)
    .eq("delivery_type", "delivery")
    .eq("delivery_date", date)
    .not("status", "in", "(cancelled)");

  let stops: DriverStop[] = [];

  if ((orders ?? []).length > 0) {
    const orderIds = (orders ?? []).map((o) => o.id);
    const [{ data: deliveryOrders }, { data: payments }] = await Promise.all([
      supabase
        .from("delivery_orders")
        .select("id, order_id, status, collected_amount")
        .in("order_id", orderIds),
      supabase.from("payments").select("order_id, amount").in("order_id", orderIds),
    ]);

    const deliveryOrderByOrderId = new Map(
      (deliveryOrders ?? []).map((d) => [d.order_id, d])
    );

    const customerIds = [...new Set((orders ?? []).map((o) => o.customer_id))];
    const { data: addresses } = customerIds.length
      ? await supabase
          .from("customer_addresses")
          .select("customer_id, city, latitude, longitude, is_default")
          .in("customer_id", customerIds)
      : { data: [] as { customer_id: string; city: string | null; latitude: number | null; longitude: number | null; is_default: boolean }[] };

    const addressByCustomer = new Map<string, { city: string | null; latitude: number | null; longitude: number | null }>();
    for (const a of addresses ?? []) {
      const existing = addressByCustomer.get(a.customer_id);
      if (!existing || a.is_default) {
        addressByCustomer.set(a.customer_id, { city: a.city, latitude: a.latitude, longitude: a.longitude });
      }
    }

    const paidByOrder = new Map<string, number>();
    for (const p of payments ?? []) {
      paidByOrder.set(
        p.order_id,
        (paidByOrder.get(p.order_id) ?? 0) + Number(p.amount)
      );
    }

    stops = (orders ?? []).map((o) => {
      const customer = o.customers as unknown as {
        name: string;
        phone: string | null;
      } | null;
      const address = addressByCustomer.get(o.customer_id);
      const deliveryOrder = deliveryOrderByOrderId.get(o.id);
      return {
        delivery_order_id: deliveryOrder?.id ?? "",
        order_id: o.id,
        order_number: Number(o.order_number),
        delivery_code: o.delivery_code,
        customer_name: customer?.name ?? "—",
        customer_phone: customer?.phone ?? null,
        address_text: o.address_text,
        city: address?.city ?? null,
        latitude: address?.latitude ?? null,
        longitude: address?.longitude ?? null,
        delivery_time: o.delivery_time,
        notes_for_driver: o.notes_for_driver,
        amount_to_collect: Math.max(
          0,
          Number(o.total) - (paidByOrder.get(o.id) ?? 0)
        ),
        status: deliveryOrder?.status ?? "pending",
        collected_amount: Number(deliveryOrder?.collected_amount ?? 0),
        items: (
          o.order_items as unknown as {
            product_name: string;
            quantity: number;
            unit_type: string;
          }[]
        ).map((i) => ({ ...i, quantity: Number(i.quantity) })),
      };
    });
  }

  const { start, end } = jerusalemDayRange(date);
  const { data: collectedToday } = await supabase
    .from("payments")
    .select("amount")
    .eq("business_id", session.businessId)
    .eq("collected_by_type", "worker")
    .eq("collected_by_id", session.workerId)
    .gte("paid_at", start)
    .lt("paid_at", end);

  const collectedTotal = (collectedToday ?? []).reduce(
    (sum, p) => sum + Number(p.amount),
    0
  );

  return (
    <DriverOrdersClient
      key={date}
      stops={stops}
      collectedTotal={collectedTotal}
      date={date}
      today={today}
      prevDate={addDays(date, -1)}
      nextDate={addDays(date, 1)}
    />
  );
}
