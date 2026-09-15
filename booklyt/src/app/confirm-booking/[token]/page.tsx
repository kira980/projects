import { notFound } from "next/navigation"
import { createServiceClient } from "@/lib/supabase/service"
import ConfirmBookingClient from "./confirm-client"

interface Props {
  params: Promise<{ token: string }>
}

export default async function ConfirmBookingPage({ params }: Props) {
  const { token } = await params
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any

  const { data: appointment } = await service
    .from("appointments")
    .select(
      "id, status, customer_name, customer_phone, appointment_date, start_time, end_time, businesses(id, name, slug, language, booking_verification_method), services(name, price, duration_minutes), staff_members(name)"
    )
    .eq("manage_token", token)
    .maybeSingle()

  if (!appointment) return notFound()

  const biz = appointment.businesses as {
    id: string; name: string; slug: string; language: string | null; booking_verification_method: string
  } | null
  if (!biz || biz.booking_verification_method !== "link") return notFound()

  const svc = appointment.services as { name: string; price: number; duration_minutes: number } | null
  const staffMember = appointment.staff_members as { name: string } | null

  const statusMap: Record<string, "pending" | "already_confirmed" | "cancelled"> = {
    pending: "pending",
    booked: "already_confirmed",
    confirmed: "already_confirmed",
    cancelled: "cancelled",
  }

  return (
    <ConfirmBookingClient
      token={token}
      status={statusMap[appointment.status] ?? "pending"}
      language={biz.language ?? "ar"}
      businessName={biz.name}
      customerName={appointment.customer_name}
      customerPhone={appointment.customer_phone}
      serviceName={svc?.name}
      servicePrice={svc?.price}
      serviceDuration={svc?.duration_minutes}
      staffName={staffMember?.name}
      appointmentDate={appointment.appointment_date}
      startTime={appointment.start_time}
      endTime={appointment.end_time}
      manageUrl={`/manage-booking/${token}`}
    />
  )
}
