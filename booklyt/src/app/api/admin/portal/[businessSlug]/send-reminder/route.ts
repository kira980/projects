import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getAdminVerifiedBusiness } from "@/lib/admin-business"
import { createServiceClient } from "@/lib/supabase/service"
import { sendCustomerAppointmentPush } from "@/lib/push/send"
import { format, parseISO } from "date-fns"

type RouteContext = { params: Promise<{ businessSlug: string }> }

const schema = z.object({ appointment_id: z.string().uuid() })

export async function POST(request: NextRequest, context: RouteContext) {
  const { businessSlug } = await context.params
  const { business } = await getAdminVerifiedBusiness(businessSlug)
  if (!business) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceClient() as any
  const { data: appt } = await supabase
    .from("appointments")
    .select("id, customer_name, appointment_date, start_time, manage_token, services(name), businesses(name, language, app_icon_url, logo_url)")
    .eq("id", parsed.data.appointment_id)
    .eq("business_id", business.id)
    .maybeSingle() as {
      data: {
        id: string
        customer_name: string
        appointment_date: string
        start_time: string
        manage_token: string | null
        services: { name: string } | null
        businesses: { name: string; language: string | null; app_icon_url: string | null; logo_url: string | null } | null
      } | null
    }

  if (!appt) return NextResponse.json({ error: "Appointment not found" }, { status: 404 })
  if (!appt.manage_token) return NextResponse.json({ error: "No manage token" }, { status: 400 })

  const isArabic = appt.businesses?.language === "ar"
  const serviceName = appt.services?.name ?? ""
  const icon = appt.businesses?.app_icon_url || appt.businesses?.logo_url || undefined
  const manageUrl = `/manage-booking/${appt.manage_token}`
  const dateStr = format(parseISO(appt.appointment_date), "EEE, MMM d")
  const timeStr = appt.start_time.slice(0, 5)

  const title = isArabic ? "⏰ تذكير بموعدك" : "⏰ Appointment Reminder"
  const body = isArabic
    ? `${serviceName} — ${dateStr} الساعة ${timeStr}. يرجى تأكيد حضورك.`
    : `${serviceName} on ${dateStr} at ${timeStr}. Please confirm your attendance.`

  // Check if customer has a push subscription before sending
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("id")
    .eq("appointment_id", appt.id)
    .limit(1) as { data: { id: string }[] | null }

  if (!subs || subs.length === 0) {
    return NextResponse.json({ error: "Customer has no push subscription", no_subscription: true }, { status: 200 })
  }

  await sendCustomerAppointmentPush(appt.id, { title, body, url: manageUrl, icon })
  return NextResponse.json({ ok: true })
}
