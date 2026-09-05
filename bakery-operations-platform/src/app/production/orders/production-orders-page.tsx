import { redirect } from "next/navigation";
import { getWorkerSession } from "@/lib/kiosk/session";
import { createServiceClient } from "@/lib/supabase/server";
import { businessToday } from "@/lib/db/day-lock";
import type { OrderStatus } from "@/lib/order-status";
import {
  ProductionOrdersClient,
  type DeliveryTypeFilter,
  type ProductionOrder,
} from "./orders-client";

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * The single prep screen: every order for the day — משלוח and איסוף עצמי
 * together — with the type filter chosen on screen. The old split screens
 * (/production/takeaway) redirect here with their type preselected.
 */
export async function ProductionOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; type?: string }>;
}) {
  const session = await getWorkerSession("production");
  if (!session) {
    redirect(`/production?next=${encodeURIComponent("/production/orders")}`);
  }

  const sp = await searchParams;
  const today = businessToday();
  const tomorrow = addDays(today, 1);
  // Default to tomorrow — bakers prep the next day's orders.
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : tomorrow;
  const initialType: DeliveryTypeFilter =
    sp.type === "takeaway" ? "takeaway" : sp.type === "delivery" ? "delivery" : "all";

  const supabase = createServiceClient();
  const { data: orders } = await supabase
    .from("orders")
    .select(
      "id, order_number, delivery_code, status, delivery_type, delivery_date, delivery_time, notes_for_baker, shortage_note, customers(name), order_items(id, product_name, product_name_ar, quantity, original_quantity, prepared_quantity, missing_quantity, unit_price, unit_type, notes)"
    )
    .eq("business_id", session.businessId)
    .eq("delivery_date", date)
    .in("status", ["new", "preparing", "ready", "problem", "shortage"])
    .order("delivery_time", { ascending: true, nullsFirst: false })
    .order("order_number");

  const mapped: ProductionOrder[] = (orders ?? []).map((o) => ({
    id: o.id,
    order_number: Number(o.order_number),
    delivery_code: o.delivery_code,
    customer_name:
      (o.customers as unknown as { name: string } | null)?.name ?? "—",
    status: o.status as OrderStatus,
    delivery_type: o.delivery_type,
    delivery_date: o.delivery_date,
    delivery_time: o.delivery_time,
    notes_for_baker: o.notes_for_baker,
    shortage_note: o.shortage_note,
    items: (
      o.order_items as unknown as {
        id: string;
        product_name: string;
        product_name_ar: string | null;
        quantity: number;
        original_quantity: number | null;
        prepared_quantity: number | null;
        missing_quantity: number | null;
        unit_price: number;
        unit_type: string;
        notes: string | null;
      }[]
    ).map((i) => ({
      id: i.id,
      product_name: i.product_name,
      product_name_ar: i.product_name_ar,
      quantity: Number(i.quantity),
      original_quantity: Number(i.original_quantity ?? i.quantity),
      prepared_quantity:
        i.prepared_quantity === null ? null : Number(i.prepared_quantity),
      missing_quantity: Number(i.missing_quantity ?? 0),
      unit_price: Number(i.unit_price),
      unit_type: i.unit_type,
      notes: i.notes,
    })),
  }));

  return (
    <ProductionOrdersClient
      key={date}
      orders={mapped}
      date={date}
      today={today}
      tomorrow={tomorrow}
      prevDate={addDays(date, -1)}
      nextDate={addDays(date, 1)}
      initialType={initialType}
      bakerName={session.name}
    />
  );
}
