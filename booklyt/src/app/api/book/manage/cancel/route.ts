import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { sendBusinessPushNotification } from "@/lib/push/send"
import { logAppointmentEvent } from "@/lib/appointments/events"
import { notifyWaitlistOnSlotOpen } from "@/lib/waitlist/notify"
import { notifyCustomer } from "@/lib/notifications/customer"
import { getDictionary } from "@/lib/i18n"
import { z } from "zod"

const cancelSchema = z.object({
  token: z.string().min(20),
})

export async function POST(request: Request) {
  try {
    const parsed = cancelSchema.safeParse(await request.json())

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createServiceClient() as any
    const now = new Date().toISOString()

    const { data, error } = await supabase
      .from("appointments")
      .update({
        status: "cancelled",
        cancelled_at: now,
        updated_at: now,
      })
      .eq("manage_token", parsed.data.token)
      .neq("status", "cancelled")
      .select("id, business_id, service_id, customer_user_id, customer_name, appointment_date, start_time, services(name), businesses(name, slug, language)")
      .maybeSingle() as {
        data: {
          id: string
          business_id: string
          service_id: string
          customer_user_id: string | null
          customer_name: string
          appointment_date: string
          start_time: string
          services: { name: string } | null
          businesses: { name: string; slug: string; language: string | null } | null
        } | null
        error: { message: string } | null
      }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: "Booking not found or already cancelled" }, { status: 404 })
    }
    const t = getDictionary(data.businesses?.language)

    await logAppointmentEvent({
      businessId: data.business_id,
      appointmentId: data.id,
      eventType: "cancellation",
      title: t.events.bookingCancelled,
      description: `${data.customer_name} ${t.events.cancelledVerb} ${data.appointment_date} ${t.common.time} ${data.start_time.slice(0, 5)}.`,
      metadata: {
        customer_name: data.customer_name,
        appointment_date: data.appointment_date,
        start_time: data.start_time,
      },
    })

    // Notify waitlisted customers that a slot is now open
    try {
      await notifyWaitlistOnSlotOpen(data.business_id, data.service_id, data.appointment_date, data.services?.name, data.start_time)
    } catch (wlErr) {
      console.error("Waitlist notify failed:", wlErr)
    }

    try {
      await sendBusinessPushNotification(data.business_id, {
        title: t.events.bookingCancelled,
        body: `${data.customer_name} ${t.events.cancelledVerb} ${data.appointment_date} ${t.common.time} ${data.start_time.slice(0, 5)}.`,
        url: data.businesses?.slug ? `/admin/${data.businesses.slug}` : "/",
      })
    } catch (pushError) {
      console.error("Cancel booking push failed:", pushError)
    }

    // In-app notification for the customer's own record
    if (data.customer_user_id) {
      try {
        await notifyCustomer(data.customer_user_id, {
          type: "booking_cancelled",
          title: `Booking cancelled — ${data.businesses?.name ?? "your booking"}`,
          body: `${data.appointment_date} at ${data.start_time.slice(0, 5)} was cancelled.`,
          businessId: data.business_id,
        })
      } catch (notifyError) {
        console.error("notifyCustomer failed:", notifyError)
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Cancel booking error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
