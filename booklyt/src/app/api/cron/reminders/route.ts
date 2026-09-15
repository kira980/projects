/**
 * GET /api/cron/reminders
 * Runs every 15 minutes via Vercel Cron.
 * Finds appointments starting ~1 hour from now (per each business's timezone)
 * with push subscriptions, and sends a reminder push to the customer.
 *
 * Protected by CRON_SECRET bearer token.
 */
import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { sendCustomerAppointmentPush } from "@/lib/push/send"
import { notifyCustomer } from "@/lib/notifications/customer"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceClient() as any

  const now = new Date()
  const pad = (n: number) => n.toString().padStart(2, "0")
  const dateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  const query = supabase
    .from("appointments")
    .select(`id, business_id, customer_user_id, customer_name, appointment_date, start_time, manage_token, services(name), businesses(name, app_icon_url, logo_url, language, timezone, active)`)
    .in("status", ["pending", "booked", "confirmed"])
    .is("push_reminder_sent_at", null)
    .gte("appointment_date", dateStr(yesterday))
    .lte("appointment_date", dateStr(tomorrow))

  const { data: appointments, error } = await query as {
    data: {
      id: string
      business_id: string
      customer_user_id: string | null
      customer_name: string
      appointment_date: string
      start_time: string
      manage_token: string | null
      services: { name: string } | null
      businesses: { name: string; app_icon_url: string | null; logo_url: string | null; language: string | null; timezone: string | null; active: boolean | null } | null
    }[] | null
    error: { message: string } | null
  }

  if (error) {
    console.error("[push-reminders] query error:", error)
    return NextResponse.json({ error: "DB error" }, { status: 500 })
  }

  if (!appointments || appointments.length === 0) {
    return NextResponse.json({ sent: 0 })
  }

  let sent = 0

  for (const appt of appointments) {
    if (appt.businesses?.active === false) continue
    const tz = appt.businesses?.timezone ?? "Asia/Jerusalem"

    const nowInTz = new Date(now.toLocaleString("en-US", { timeZone: tz }))
    const [hours, minutes] = appt.start_time.split(":").map(Number)
    const apptTime = new Date(nowInTz)
    const [yr, mo, dy] = appt.appointment_date.split("-").map(Number)
    apptTime.setFullYear(yr, mo - 1, dy)
    apptTime.setHours(hours, minutes, 0, 0)

    const diffMin = (apptTime.getTime() - nowInTz.getTime()) / 60000

    if (diffMin < 55 || diffMin > 75) continue

    const isArabic = appt.businesses?.language === "ar"
    const serviceName = appt.services?.name ?? ""
    const icon = appt.businesses?.app_icon_url || appt.businesses?.logo_url || undefined
    const manageUrl = appt.manage_token ? `/manage-booking/${appt.manage_token}` : "/"

    const title = isArabic ? "تذكير بموعدك 🔔" : "Appointment Reminder 🔔"
    const body = isArabic
      ? `موعدك (${serviceName}) الساعة ${appt.start_time.slice(0, 5)} بعد ساعة.`
      : `Your ${serviceName} appointment at ${appt.start_time.slice(0, 5)} is in 1 hour.`

    try {
      await sendCustomerAppointmentPush(appt.id, { title, body, url: manageUrl, icon })
      // In-app notification center + native FCM devices
      if (appt.customer_user_id) {
        await notifyCustomer(appt.customer_user_id, {
          type: "booking_reminder",
          title,
          body,
          businessId: appt.business_id,
          url: manageUrl,
        })
      }
      await supabase
        .from("appointments")
        .update({ push_reminder_sent_at: new Date().toISOString() })
        .eq("id", appt.id)
      sent++
    } catch (err) {
      console.error(`[push-reminders] failed for appointment ${appt.id}:`, err)
    }
  }

  return NextResponse.json({ sent })
}
