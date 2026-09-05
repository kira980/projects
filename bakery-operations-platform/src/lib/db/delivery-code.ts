import type { SupabaseClient } from "@/lib/demo-backend/types";

/**
 * Order codes — one sequence per business+delivery_date. Deliveries:
 * "A01".."A99", "B01".. (99 per letter). Takeaway (pickup): same with a
 * leading "T" ("TA01"). Assigned once at order creation; the code is the
 * order's public number.
 */
export function formatOrderCode(seq: number, takeaway: boolean): string {
  const letter = String.fromCharCode(65 + Math.floor((seq - 1) / 99));
  const number = String(((seq - 1) % 99) + 1).padStart(2, "0");
  return `${takeaway ? "T" : ""}${letter}${number}`;
}

export async function takeDeliveryCode(
  supabase: SupabaseClient,
  businessId: string,
  deliveryDate: string
): Promise<string | null> {
  const { data: seq, error } = await supabase.rpc("take_delivery_code_seq", {
    p_business_id: businessId,
    p_delivery_date: deliveryDate,
  });
  if (error || seq === null) return null;
  return formatOrderCode(Number(seq), false);
}

export async function takeTakeawayCode(
  supabase: SupabaseClient,
  businessId: string,
  deliveryDate: string
): Promise<string | null> {
  const { data: seq, error } = await supabase.rpc("take_takeaway_code_seq", {
    p_business_id: businessId,
    p_delivery_date: deliveryDate,
  });
  if (error || seq === null) return null;
  return formatOrderCode(Number(seq), true);
}
