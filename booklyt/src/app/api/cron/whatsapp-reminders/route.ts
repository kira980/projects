/**
 * GET /api/cron/whatsapp-reminders
 * Runs every 15 minutes via Vercel Cron.
 * Finds appointments starting ~1 hour from now (per each business's timezone)
 * that haven't had a WA reminder sent, and sends a WhatsApp reminder via Twilio.
 *
 * Protected by CRON_SECRET bearer token.
 */
import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { sendAppointmentReminder } from "@/lib/whatsapp"
import { logWaMessage } from "@/lib/wa-log"

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

  // appointment_date is stored in the business's local date, not UTC.
  // To cover all timezones (UTC-12 to UTC+14), fetch yesterday through tomorrow.
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  const query = supabase
    .from("appointments")
    .select(`
      id,
      business_id,
      appointment_date,
      start_time,
      customer_name,
      customer_phone,
      manage_token,
      businesses(name, timezone, wa_reminders, active)
    `)
    .in("status", ["confirmed", "booked"])
    .not("customer_phone", "is", null)
    .is("wa_reminder_sent_at", null)
    .gte("appointment_date", dateStr(yesterday))
    .lte("appointment_date", dateStr(tomorrow))

  const { data: appointments, error } = await query

  if (error) {
    console.error("[wa-reminders] query error:", error)
    return NextResponse.json({ error: "DB error" }, { status: 500 })
  }

  if (!appointments || appointments.length === 0) {
    return NextResponse.json({ sent: 0 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""
  let sent = 0

  for (const appt of appointments as {
    id: string
    business_id: string
    appointment_date: string
    start_time: string
    customer_name: string
    customer_phone: string
    manage_token: string | null
    businesses: { name: string; timezone: string | null; wa_reminders: boolean | null; active: boolean | null } | null
  }[]) {
    if (!appt.customer_phone || !appt.manage_token) continue
    if (appt.businesses?.active === false) continue
    if (appt.businesses?.wa_reminders === false) continue

    const tz = appt.businesses?.timezone ?? "Asia/Jerusalem"

    // Convert "now" to the business timezone and compare directly with stored appointment time
    const nowInTz = new Date(now.toLocaleString("en-US", { timeZone: tz }))
    const [hours, minutes] = appt.start_time.split(":").map(Number)
    const apptTime = new Date(nowInTz)
    const [yr, mo, dy] = appt.appointment_date.split("-").map(Number)
    apptTime.setFullYear(yr, mo - 1, dy)
    apptTime.setHours(hours, minutes, 0, 0)

    const diffMin = (apptTime.getTime() - nowInTz.getTime()) / 60000

    if (diffMin < 55 || diffMin > 75) continue

    const manageUrl = `${baseUrl}/manage-booking/${appt.manage_token}`

    try {
      await sendAppointmentReminder(appt.customer_phone, {
        customerName: appt.customer_name,
        businessName: appt.businesses?.name ?? "",
        manageUrl,
      })

      await logWaMessage(appt.business_id, "reminder", appt.customer_phone)

      await supabase
        .from("appointments")
        .update({ wa_reminder_sent_at: new Date().toISOString() })
        .eq("id", appt.id)

      sent++
    } catch (err) {
      await logWaMessage(appt.business_id, "reminder", appt.customer_phone, "failed")
      console.error(`[wa-reminders] failed for appointment ${appt.id}:`, err)
    }
  }

  return NextResponse.json({ sent })
}
