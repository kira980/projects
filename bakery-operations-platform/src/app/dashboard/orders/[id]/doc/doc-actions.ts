"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import {
  createNumberedDoc,
  getOrCreateNumberedDoc,
  type NumberedDocRow,
  type NumberedDocType,
} from "@/lib/documents/numbered-doc";

/**
 * Creates a receipt / delivery-note snapshot for an order (admin). Only
 * receipt-flagged orders may issue one. Returns the created row so the doc
 * page can render it directly on first visit.
 */
export async function createNumberedDocument(
  orderId: string,
  docType: NumberedDocType,
  // revalidatePath cannot run during a render; the page passes false when
  // it lazily creates the first snapshot inside its render.
  revalidate = true
): Promise<{ ok: boolean; error?: string; doc?: NumberedDocRow }> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("receipt")
    .eq("id", orderId)
    .eq("business_id", admin.business_id)
    .maybeSingle();

  if (!order) return { ok: false, error: "ההזמנה לא נמצאה" };
  if (!order.receipt) return { ok: false, error: "ההזמנה אינה מסומנת לקבלה" };

  const res = await createNumberedDoc(
    supabase,
    admin.business_id,
    orderId,
    docType,
    { type: "admin", id: admin.id, name: admin.full_name }
  );

  if (res.ok && revalidate) {
    revalidatePath(
      `/dashboard/orders/${orderId}/doc/${docType === "receipt" ? "receipt" : "delivery-note"}`
    );
  }
  return res;
}

/**
 * "צור קבלה" — issues the receipt documents for an order: a קבלה always,
 * plus a תעודת משלוח for delivery orders (pickup gets a receipt only). Marks
 * the order as a receipt order and is idempotent (reuses any already-issued
 * document rather than minting a new number).
 */
export async function issueOrderReceipt(
  orderId: string
): Promise<{ ok: boolean; error?: string }> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("id, delivery_type, receipt, status")
    .eq("id", orderId)
    .eq("business_id", admin.business_id)
    .single();

  if (!order) return { ok: false, error: "ההזמנה לא נמצאה" };
  if (order.status === "cancelled") {
    return { ok: false, error: "לא ניתן להפיק קבלה להזמנה מבוטלת" };
  }

  // Flag the order as a receipt order so the documents (and the workers'
  // print screen) treat it consistently.
  if (!order.receipt) {
    await supabase
      .from("orders")
      .update({ receipt: true })
      .eq("id", orderId)
      .eq("business_id", admin.business_id);
  }

  const actor = { type: "admin" as const, id: admin.id, name: admin.full_name };
  const types: NumberedDocType[] =
    order.delivery_type === "delivery"
      ? ["receipt", "delivery_note"]
      : ["receipt"];

  for (const t of types) {
    const r = await getOrCreateNumberedDoc(
      supabase,
      admin.business_id,
      orderId,
      t,
      actor
    );
    if (!r.ok) return { ok: false, error: r.error };
  }

  revalidatePath(`/dashboard/orders/${orderId}`);
  revalidatePath(`/dashboard/deliveries/${orderId}`);
  return { ok: true };
}
