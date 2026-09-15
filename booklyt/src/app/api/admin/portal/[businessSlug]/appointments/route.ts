import { NextResponse } from "next/server"
import { z } from "zod"
import { getAdminVerifiedBusiness } from "@/lib/admin-business"
import { sendBusinessPushNotification, sendCustomerAppointmentPush } from "@/lib/push/send"
import { logAppointmentEvent } from "@/lib/appointments/events"
import { notifyWaitlistOnSlotOpen } from "@/lib/waitlist/notify"
import { getDictionary, statusLabel } from "@/lib/i18n"

type RouteContext = {
  params: Promise<{ businessSlug: string }>
}

const statusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["pending", "booked", "confirmed", "cancelled", "completed"]),
})

export async function GET(_request: Request, context: RouteContext) {
  const { businessSlug } = await context.params
  const { business, supabase } = await getAdminVerifiedBusiness(businessSlug)

  if (!business) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const currentTime = now.toTimeString().slice(0, 8)

  await supabase
    .from("appointments")
    .update({ status: "completed", updated_at: now.toISOString() })
    .eq("business_id", business.id)
    .in("status", ["pending", "booked", "confirmed"])
    .or(`appointment_date.lt.${today},and(appointment_date.eq.${today},end_time.lte.${currentTime})`)

  const [
    { data: appointments },
    { data: waitlist },
    { data: services },
    { data: staff },
    { data: workingHours },
    { data: breaks },
    { data: history },
  ] = await Promise.all([
    supabase
      .from("appointments")
      .select("*, services(id,name,duration_minutes,price), staff_members(id,name,role,avatar_url)")
      .eq("business_id", business.id)
      .order("appointment_date", { ascending: false })
      .order("start_time", { ascending: false })
      .limit(100),
    supabase
      .from("waitlist_entries")
      .select("*, services(id,name,duration_minutes,price), staff_members(id,name,role,avatar_url)")
      .eq("business_id", business.id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("services")
      .select("*")
      .eq("business_id", business.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("staff_members")
      .select("*")
      .eq("business_id", business.id)
      .eq("active", true)
      .order("created_at", { ascending: true }),
    supabase
      .from("working_hours")
      .select("*")
      .eq("business_id", business.id)
      .order("day_of_week", { ascending: true }),
    supabase
      .from("working_hour_breaks")
      .select("*")
      .eq("business_id", business.id)
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true }),
    supabase
      .from("appointment_events")
      .select("*")
      .eq("business_id", business.id)
      .order("created_at", { ascending: false })
      .limit(100),
  ])

  return NextResponse.json({
    business,
    appointments: appointments ?? [],
    waitlist: waitlist ?? [],
    services: services ?? [],
    staff: staff ?? [],
    workingHours: workingHours ?? [],
    breaks: breaks ?? [],
    history: history ?? [],
  })
}

export async function PATCH(request: Request, context: RouteContext) {
  const { businessSlug } = await context.params
  const { business, supabase } = await getAdminVerifiedBusiness(businessSlug)

  if (!business) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const parsed = statusSchema.safeParse(await request.json())

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const now = new Date().toISOString()
  const { data: appointment, error } = await supabase
    .from("appointments")
    .update({
      status: parsed.data.status,
      cancelled_at: parsed.data.status === "cancelled" ? now : null,
      updated_at: now,
    })
    .eq("business_id", business.id)
    .eq("id", parsed.data.id)
    .select("id, service_id, customer_name, appointment_date, start_time, manage_token, services(name)")
    .maybeSingle() as {
      data: { id: string; service_id: string; customer_name: string; appointment_date: string; start_time: string; manage_token: string | null; services: { name: string } | null } | null
      error: { message: string } | null
    }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!appointment) {
    return NextResponse.json({ error: "Appointment not found" }, { status: 404 })
  }
  const t = getDictionary(business.language)

  await logAppointmentEvent({
    businessId: business.id,
    appointmentId: appointment.id,
    eventType: parsed.data.status === "cancelled" ? "cancellation" : "status_change",
    title: t.events.appointmentUpdated,
    description: `${appointment.customer_name} ${t.events.isNow} ${statusLabel(parsed.data.status, business.language)}.`,
    metadata: {
      status: parsed.data.status,
      customer_name: appointment.customer_name,
      appointment_date: appointment.appointment_date,
      start_time: appointment.start_time,
    },
  })

  // Notify waitlist if a slot opened
  if (parsed.data.status === "cancelled") {
    try {
      await notifyWaitlistOnSlotOpen(business.id, appointment.service_id, appointment.appointment_date, (appointment.services as { name: string } | null)?.name, appointment.start_time)
    } catch (wlErr) {
      console.error("Waitlist notify failed:", wlErr)
    }
  }

  // Notify customer when their appointment is confirmed or cancelled
  if (parsed.data.status === "confirmed" || parsed.data.status === "cancelled") {
    try {
      const serviceName = (appointment.services as { name: string } | null)?.name ?? ''
      const isAr = business.language === "ar"
      const isCancelled = parsed.data.status === "cancelled"
      const title = isCancelled
        ? (isAr ? "❌ تم إلغاء موعدك" : "❌ Appointment Cancelled")
        : t.events.appointmentUpdated
      const body = isCancelled
        ? (isAr
            ? `تم إلغاء موعدك (${serviceName}) بتاريخ ${appointment.appointment_date} الساعة ${appointment.start_time.slice(0, 5)} من قِبل العمل.`
            : `Your ${serviceName} appointment on ${appointment.appointment_date} at ${appointment.start_time.slice(0, 5)} was cancelled by the business.`)
        : (isAr
            ? `${serviceName} ${appointment.appointment_date} ${t.common.time} ${appointment.start_time.slice(0, 5)} — ${statusLabel("confirmed", business.language)}`
            : `${serviceName} on ${appointment.appointment_date} at ${appointment.start_time.slice(0, 5)} — ${statusLabel("confirmed", business.language)}`)
      await sendCustomerAppointmentPush(appointment.id, {
        title,
        body,
        url: appointment.manage_token ? `/manage-booking/${appointment.manage_token}` : undefined,
      })
    } catch (pushErr) {
      console.error("Customer status push failed:", pushErr)
    }
  }

  try {
    await sendBusinessPushNotification(business.id, {
      title: t.events.appointmentUpdated,
      body: `${appointment?.customer_name ?? t.admin.appointments} ${t.events.isNow} ${statusLabel(parsed.data.status, business.language)}.`,
      url: `/admin/${business.slug}`,
    })
  } catch (pushError) {
    console.error("Admin status push failed:", pushError)
  }

  return NextResponse.json({ success: true })
}
