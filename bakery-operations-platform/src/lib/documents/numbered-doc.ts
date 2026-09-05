import type { SupabaseClient } from "@/lib/demo-backend/types";
import { createAuditLog, type AuditActor } from "@/lib/db/audit";

/** קבלה (receipt) or תעודת משלוח (delivery note). */
export type NumberedDocType = "receipt" | "delivery_note";

/** Business VAT id (עוסק מורשה) printed on receipts and delivery notes. */
export const BUSINESS_VAT_ID = "021822796";

export type DocSnapshotBase = {
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

export type NumberedDocSnapshot = DocSnapshotBase & { doc_number: number };

export type NumberedDocRow = {
  snapshot: NumberedDocSnapshot;
  doc_number: number;
  created_at: string;
};

/**
 * Creates an immutable receipt / delivery-note snapshot for the order,
 * stamped with the next sequential number in the business's series (unique,
 * never reused — the counter only moves forward). Works with any client:
 * admins pass the RLS client + their business id; the workers app passes a
 * service client. The caller is responsible for authorization and for the
 * receipt-flag policy.
 */
export async function createNumberedDoc(
  supabase: SupabaseClient,
  businessId: string,
  orderId: string,
  docType: NumberedDocType,
  actor: AuditActor
): Promise<{ ok: boolean; error?: string; doc?: NumberedDocRow }> {
  const [{ data: order }, { data: business }] = await Promise.all([
    supabase
      .from("orders")
      .select("*, customers(name, phone)")
      .eq("id", orderId)
      .eq("business_id", businessId)
      .single(),
    supabase
      .from("businesses")
      .select("name, phone, address")
      .eq("id", businessId)
      .single(),
  ]);

  if (!order || !business) return { ok: false, error: "ההזמנה לא נמצאה" };

  const { data: items } = await supabase
    .from("order_items")
    .select("product_name, unit_type, quantity, unit_price, line_total")
    .eq("order_id", orderId)
    .order("created_at");

  // Take the next number in the series before writing the document.
  const { data: docNumber, error: numberError } = await supabase.rpc(
    "take_document_number",
    { p_business_id: businessId, p_doc_type: docType }
  );
  if (numberError || !docNumber) {
    return { ok: false, error: "הקצאת מספר המסמך נכשלה" };
  }

  const customer = order.customers as unknown as {
    name: string;
    phone: string | null;
  };

  const snapshot: NumberedDocSnapshot = {
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
    doc_number: Number(docNumber),
  };

  // Returning the inserted row lets a page render it directly — a re-select
  // of the same query inside one render would be deduped by fetch
  // memoization and come back empty.
  const { data: inserted, error } = await supabase
    .from("order_documents")
    .insert({
      business_id: businessId,
      order_id: orderId,
      doc_type: docType,
      doc_number: Number(docNumber),
      snapshot,
      created_by: actor.id ?? null,
    })
    .select("snapshot, doc_number, created_at")
    .single();

  if (error || !inserted) return { ok: false, error: "שמירת המסמך נכשלה" };

  await createAuditLog(supabase, {
    businessId,
    actor,
    action: `${docType}.create`,
    entityType: "order",
    entityId: orderId,
    details: {
      order_number: snapshot.order_number,
      doc_number: Number(docNumber),
    },
  });

  return {
    ok: true,
    doc: {
      snapshot: inserted.snapshot as NumberedDocSnapshot,
      doc_number: Number(inserted.doc_number),
      created_at: inserted.created_at,
    },
  };
}

/** Returns the latest existing document of this type, or creates a new one. */
export async function getOrCreateNumberedDoc(
  supabase: SupabaseClient,
  businessId: string,
  orderId: string,
  docType: NumberedDocType,
  actor: AuditActor
): Promise<{ ok: boolean; error?: string; doc?: NumberedDocRow }> {
  const { data: existing } = await supabase
    .from("order_documents")
    .select("snapshot, doc_number, created_at")
    .eq("business_id", businessId)
    .eq("order_id", orderId)
    .eq("doc_type", docType)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    return {
      ok: true,
      doc: {
        snapshot: existing.snapshot as NumberedDocSnapshot,
        doc_number: Number(existing.doc_number),
        created_at: existing.created_at,
      },
    };
  }
  return createNumberedDoc(supabase, businessId, orderId, docType, actor);
}
