import { NextResponse } from "next/server"
import { z } from "zod"
import { format, parseISO } from "date-fns"
import { arSA } from "date-fns/locale"
import { createServiceClient } from "@/lib/supabase/service"
import { sendCustomerAppointmentPush } from "@/lib/push/send"

const schema = z.object({ appointment_id: z.string().uuid() })

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createServiceClient() as any
    const { data: appt } = await supabase
      .from("appointments")
      .select("id, customer_name, appointment_date, start_time, manage_token, services(name), businesses(name, language, app_icon_url, logo_url)")
      .eq("id", parsed.data.appointment_id)
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

    if (!appt) return NextResponse.json({ ok: true }) // silently ignore — subscription may not be saved yet

    const isAr = appt.businesses?.language === "ar"
    const serviceName = appt.services?.name ?? ""
    const businessName = appt.businesses?.name ?? ""
    const icon = appt.businesses?.app_icon_url || appt.businesses?.logo_url || undefined
    const manageUrl = appt.manage_token ? `/manage-booking/${appt.manage_token}` : "/"

    const dateStr = isAr
      ? format(parseISO(appt.appointment_date), "EEEE، d MMMM", { locale: arSA })
      : format(parseISO(appt.appointment_date), "EEEE, MMMM d")
    const time = appt.start_time.slice(0, 5)

    const title = isAr ? "✅ تم تأكيد موعدك" : "✅ Booking Confirmed"
    const body = isAr
      ? `${serviceName}${businessName ? ` في ${businessName}` : ""} — ${dateStr} الساعة ${time}`
      : `${serviceName}${businessName ? ` at ${businessName}` : ""} — ${dateStr} at ${time}`

    await sendCustomerAppointmentPush(appt.id, { title, body, url: manageUrl, icon })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("send-confirmation error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
