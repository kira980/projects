"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { createAuditLog } from "@/lib/db/audit";

export type QuoteSnapshot = {
  business: { name: string; phone: string | null; address: string | null };
  customer: { name: string; phone: string | null; address: string | null };
  order_number: number;
  order_date: string;
  delivery_date: string;
  delivery_time: string | null;
  items: {
    product_name: string;
    unit_type: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }[];
  total: number;
  notes: string | null;
};

/**
 * Creates a fresh immutable quote snapshot for the order. Existing
 * snapshots are kept — old printed quotes never change.
 */
export async function createQuoteSnapshot(
  orderId: string,
  // revalidatePath cannot run during a render; the page passes false when
  // it lazily creates the first snapshot inside its render.
  revalidate = true
): Promise<{
  ok: boolean;
  error?: string;
  doc?: { snapshot: QuoteSnapshot; created_at: string };
}> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const [{ data: order }, { data: business }] = await Promise.all([
    supabase
      .from("orders")
      .select("*, customers(name, phone)")
      .eq("id", orderId)
      .eq("business_id", admin.business_id)
      .single(),
    supabase
      .from("businesses")
      .select("name, phone, address")
      .eq("id", admin.business_id)
      .single(),
  ]);

  if (!order || !business) return { ok: false, error: "ההזמנה לא נמצאה" };

  const { data: items } = await supabase
    .from("order_items")
    .select("product_name, unit_type, quantity, unit_price, line_total")
    .eq("order_id", orderId)
    .order("created_at");

  const customer = order.customers as unknown as {
    name: string;
    phone: string | null;
  };

  const snapshot: QuoteSnapshot = {
    business: {
      name: business.name,
      phone: business.phone,
      address: business.address,
    },
    customer: {
      name: customer.name,
      phone: customer.phone,
      address: order.address_text,
    },
    order_number: Number(order.order_number),
    order_date: order.created_at,
    delivery_date: order.delivery_date,
    delivery_time: order.delivery_time,
    items: (items ?? []).map((i) => ({
      product_name: i.product_name,
      unit_type: i.unit_type,
      quantity: Number(i.quantity),
      unit_price: Number(i.unit_price),
      line_total: Number(i.line_total),
    })),
    total: Number(order.total),
    notes: order.notes,
  };

  // Returning the inserted row lets the page render it directly — a
  // re-select of the same query would be deduped by fetch memoization
  // within the render and come back empty.
  const { data: inserted, error } = await supabase
    .from("order_documents")
    .insert({
      business_id: admin.business_id,
      order_id: orderId,
      doc_type: "quote",
      snapshot,
      created_by: admin.id,
    })
    .select("snapshot, created_at")
    .single();

  if (error || !inserted) return { ok: false, error: "שמירת הצעת המחיר נכשלה" };

  await createAuditLog(supabase, {
    businessId: admin.business_id,
    actor: { type: "admin", id: admin.id, name: admin.full_name },
    action: "quote.create",
    entityType: "order",
    entityId: orderId,
    details: { order_number: snapshot.order_number },
  });

  if (revalidate) revalidatePath(`/dashboard/orders/${orderId}/quote`);
  return {
    ok: true,
    doc: {
      snapshot: inserted.snapshot as QuoteSnapshot,
      created_at: inserted.created_at,
    },
  };
}
