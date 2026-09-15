/**
 * POST /api/book/manage/reschedule
 * Move a booking to a new date/time using its private manage token
 * (same auth model as /api/book/manage/cancel).
 *
 * Body: { token, date: "YYYY-MM-DD", start_time: "HH:MM" }
 * Availability is re-validated server-side with the same slot engine as
 * /api/slots, excluding the appointment being moved.
 */
import { NextResponse } from "next/server"
import { z } from "zod"
import { createServiceClient } from "@/lib/supabase/service"
import { generateTimeSlots, calculateEndTime } from "@/lib/booking/slots"
import { sendBusinessPushNotification } from "@/lib/push/send"
import { logAppointmentEvent } from "@/lib/appointments/events"
import { notifyWaitlistOnSlotOpen } from "@/lib/waitlist/notify"
import { notifyCustomer } from "@/lib/notifications/customer"
import { getDictionary } from "@/lib/i18n"
import type { WorkingHours, WorkingHourBreak } from "@/types/database"

const rescheduleSchema = z.object({
  token: z.string().min(20),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
})

export async function POST(request: Request) {
  try {
    const parsed = rescheduleSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    }
    const { token, date, start_time } = parsed.data

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createServiceClient() as any

    const { data: appointment } = await supabase
      .from("appointments")
      .select("id, business_id, service_id, staff_member_id, customer_user_id, customer_name, appointment_date, start_time, participants_count, status, services(name, duration_minutes), businesses(name, slug, language, booking_mode, group_capacity, slot_interval, active)")
      .eq("manage_token", token)
      .maybeSingle() as {
        data: {
          id: string
          business_id: string
          service_id: string
          staff_member_id: string | null
          customer_user_id: string | null
          customer_name: string
          appointment_date: string
          start_time: string
          participants_count: number
          status: string
          services: { name: string; duration_minutes: number } | null
          businesses: { name: string; slug: string; language: string | null; booking_mode: string; group_capacity: number; slot_interval: number | null; active: boolean } | null
        } | null
      }

    if (!appointment || appointment.businesses?.active === false) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }
    if (appointment.status === "cancelled" || appointment.status === "completed") {
      return NextResponse.json({ error: "This booking can no longer be changed" }, { status: 409 })
    }

    // Don't allow rescheduling into the past
    const now = new Date()
    const [y, m, d] = date.split("-").map(Number)
    const [hh, mm] = start_time.split(":").map(Number)
    if (new Date(y, m - 1, d, hh, mm) <= now) {
      return NextResponse.json({ error: "Pick a time in the future" }, { status: 422 })
    }

    const duration = appointment.services?.duration_minutes ?? 30
    const capacity = appointment.businesses?.booking_mode === "group"
      ? appointment.businesses.group_capacity
      : 1
    const dow = new Date(y, m - 1, d).getDay()

    const [{ data: wh }, { data: breaks }, { data: existingRaw }] = await Promise.all([
      supabase
        .from("working_hours")
        .select("*")
        .eq("business_id", appointment.business_id)
        .eq("day_of_week", dow)
        .maybeSingle() as Promise<{ data: WorkingHours | null }>,
      supabase
        .from("working_hour_breaks")
        .select("start_time, end_time")
        .eq("business_id", appointment.business_id)
        .eq("day_of_week", dow)
        .order("start_time") as Promise<{ data: Pick<WorkingHourBreak, "start_time" | "end_time">[] | null }>,
      (() => {
        let q = supabase
          .from("appointments")
          .select("id, start_time, end_time, participants_count")
          .eq("business_id", appointment.business_id)
          .eq("appointment_date", date)
          .neq("status", "cancelled")
          .neq("id", appointment.id) // exclude the booking being moved
        if (appointment.staff_member_id) q = q.eq("staff_member_id", appointment.staff_member_id)
        return q
      })() as Promise<{ data: { id: string; start_time: string; end_time: string; participants_count: number }[] | null }>,
    ])

    const interval = appointment.businesses?.slot_interval ?? 30
    const slots = generateTimeSlots(wh, existingRaw ?? [], duration, interval, capacity, breaks ?? [])
    const requested = slots.find((s) => s.time === start_time)

    if (!requested || !requested.available ||
        (requested.available_spots !== undefined && requested.available_spots < appointment.participants_count)) {
      return NextResponse.json({ error: "That time is no longer available" }, { status: 409 })
    }

    const endTime = calculateEndTime(start_time, duration)
    const previousDate = appointment.appointment_date
    const previousTime = appointment.start_time
    const nowIso = now.toISOString()

    const { error: updateError } = await supabase
      .from("appointments")
      .update({
        appointment_date: date,
        start_time: `${start_time}:00`,
        end_time: `${endTime}:00`,
        updated_at: nowIso,
      })
      .eq("id", appointment.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    const t = getDictionary(appointment.businesses?.language)

    await logAppointmentEvent({
      businessId: appointment.business_id,
      appointmentId: appointment.id,
      eventType: "reschedule",
      title: "Booking rescheduled",
      description: `${appointment.customer_name}: ${previousDate} ${previousTime.slice(0, 5)} → ${date} ${start_time}.`,
      metadata: {
        customer_name: appointment.customer_name,
        previous_date: previousDate,
        previous_time: previousTime,
        appointment_date: date,
        start_time,
      },
    })

    // The old slot is free now — offer it to the waitlist
    try {
      await notifyWaitlistOnSlotOpen(
        appointment.business_id,
        appointment.service_id,
        previousDate,
        appointment.services?.name,
        previousTime
      )
    } catch (wlErr) {
      console.error("Waitlist notify failed:", wlErr)
    }

    try {
      await sendBusinessPushNotification(appointment.business_id, {
        title: "Booking rescheduled",
        body: `${appointment.customer_name}: ${previousDate} ${previousTime.slice(0, 5)} → ${date} ${start_time} (${t.common.time}).`,
        url: appointment.businesses?.slug ? `/admin/${appointment.businesses.slug}` : "/",
      })
    } catch (pushError) {
      console.error("Reschedule push failed:", pushError)
    }

    if (appointment.customer_user_id) {
      try {
        await notifyCustomer(appointment.customer_user_id, {
          type: "booking_changed",
          title: `Booking moved — ${appointment.businesses?.name ?? "your booking"}`,
          body: `New time: ${date} at ${start_time}.`,
          businessId: appointment.business_id,
        })
      } catch (notifyError) {
        console.error("notifyCustomer failed:", notifyError)
      }
    }

    return NextResponse.json({
      success: true,
      appointment_date: date,
      start_time,
      end_time: endTime,
    })
  } catch (err) {
    console.error("Reschedule booking error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
