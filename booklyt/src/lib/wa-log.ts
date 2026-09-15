import { createServiceClient } from "@/lib/supabase/service"

export type WaMessageType = "auth" | "booking_confirmation" | "reminder" | "waitlist" | "verification_link"

export async function logWaMessage(
  businessId: string,
  messageType: WaMessageType,
  recipientPhone: string,
  status: "sent" | "failed" = "sent",
) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createServiceClient() as any
    await supabase.from("wa_message_log").insert({
      business_id: businessId,
      message_type: messageType,
      recipient_phone: recipientPhone,
      status,
    })
  } catch (err) {
    console.error("[wa-log] failed to log message:", err)
  }
}
