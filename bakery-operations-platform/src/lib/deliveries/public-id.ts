/**
 * Public delivery ID helpers. The stored id (orders.public_delivery_id)
 * is generated in the DB as "D-000123"; these helpers keep formatting and
 * search normalization consistent on the app side.
 */
import type { SupabaseClient } from "@/lib/demo-backend/types";

/**
 * Reserve the next public delivery id for a business ("D-000123"), using
 * the same per-business sequence the migration backfill used. Returns null
 * on failure — callers should treat that as "leave it unset".
 */
export async function takePublicDeliveryId(
  supabase: SupabaseClient,
  businessId: string
): Promise<string | null> {
  const { data: seq, error } = await supabase.rpc("take_delivery_public_seq", {
    p_business_id: businessId,
  });
  if (error || seq === null || seq === undefined) return null;
  return formatDeliveryPublicId(Number(seq));
}

/** Format a raw sequence number as a public delivery id ("D-000123"). */
export function formatDeliveryPublicId(seq: number): string {
  return `D-${String(Math.max(0, Math.floor(seq))).padStart(6, "0")}`;
}

/**
 * Download filename (no extension) for a delivery quotation PDF. The
 * browser's print-to-PDF appends ".pdf". Falls back to the order number
 * when a delivery has no public id yet.
 */
export function quotationFilename(
  deliveryId: string | null,
  orderNumber: number
): string {
  const id = deliveryId?.trim() || `order-${orderNumber}`;
  return `quotation-${id}`;
}

/**
 * Normalize free-text search into a delivery-id fragment. Accepts "123",
 * "d-123", "D000123" etc. Returns an uppercase fragment suitable for an
 * `ilike %frag%` match, or null when there's nothing searchable.
 */
export function normalizeDeliveryIdQuery(input: string): string | null {
  const trimmed = input.trim().toUpperCase().replace(/\s+/g, "");
  if (!trimmed) return null;
  // Keep only the significant characters (letters/digits/dash).
  const frag = trimmed.replace(/[^A-Z0-9-]/g, "");
  return frag || null;
}
