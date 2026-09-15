import { createServiceClient } from "@/lib/supabase/service"
import type { Json } from "@/types/database"

type AppointmentEventType = "reservation" | "cancellation" | "status_change" | "reschedule" | "note"

export async function logAppointmentEvent({
  businessId,
  appointmentId,
  eventType,
  title,
  description,
  metadata,
}: {
  businessId: string
  appointmentId?: string | null
  eventType: AppointmentEventType
  title: string
  description?: string | null
  metadata?: Json
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any
  const { error } = await service
    .from("appointment_events")
    .insert({
      business_id: businessId,
      appointment_id: appointmentId ?? null,
      event_type: eventType,
      title,
      description: description ?? null,
      metadata: metadata ?? {},
    })

  if (error) {
    console.error("Appointment event log failed:", error)
  }
}
