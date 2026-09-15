import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { calculateEndTime } from "@/lib/booking/slots"
import { randomBytes } from "crypto"
import { z } from "zod"
import type { Business, Service, WorkingHours } from "@/types/database"
import { sendBusinessPushNotification } from "@/lib/push/send"
import { sendBookingConfirmation, sendBookingVerificationLink } from "@/lib/whatsapp"
import { logWaMessage } from "@/lib/wa-log"
import { logAppointmentEvent } from "@/lib/appointments/events"
import { getCurrentCustomerUser } from "@/lib/customer-auth"
import { recordBusinessVisit } from "@/lib/customer/businesses"
import { notifyCustomer } from "@/lib/notifications/customer"
import { getDictionary, statusLabel } from "@/lib/i18n"
import {
  createCustomerSessionToken,
  customerSessionExpiresAt,
  CUSTOMER_SESSION_MAX_AGE_SECONDS,
  getCustomerManageCookieName,
  getCustomerSessionCookieName,
  hashCustomerSessionToken,
} from "@/lib/customer-session"
import { resolveVerificationMethod } from "@/lib/booking-verification"

// In-memory IP rate limiter: max 5 bookings per IP per 10 minutes
const IP_WINDOW_MS = 10 * 60 * 1000
const IP_MAX_REQUESTS = 5
const ipBookings = new Map<string, number[]>()

function checkIpRateLimit(ip: string): boolean {
  const now = Date.now()
  const timestamps = (ipBookings.get(ip) ?? []).filter(t => now - t < IP_WINDOW_MS)
  if (timestamps.length >= IP_MAX_REQUESTS) return false
  timestamps.push(now)
  ipBookings.set(ip, timestamps)
  // Periodic cleanup: remove stale IPs every ~100 requests
  if (ipBookings.size > 1000) {
    for (const [key, ts] of ipBookings) {
      if (ts.every(t => now - t >= IP_WINDOW_MS)) ipBookings.delete(key)
    }
  }
  return true
}

const bookingSchema = z.object({
  business_id:      z.string().uuid(),
  service_id:       z.string().uuid(),
  staff_member_id:  z.string().uuid().nullable().optional(),
  customer_name:    z.string().min(1),
  customer_email:   z.string().email().nullable().optional(),
  customer_phone:   z.string().nullable().optional(),
  appointment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time:       z.string().regex(/^\d{2}:\d{2}$/),
  notes:            z.string().nullable().optional(),
  duration_minutes: z.number().int().positive(),
  participants_count: z.number().int().positive().optional(),
  force_new: z.boolean().optional(),
  customer_user_id: z.string().uuid().nullable().optional(),
})

export async function POST(request: NextRequest) {
  try {
    // IP-based rate limit (catches rotating phone numbers)
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? request.headers.get("x-real-ip")
      ?? "unknown"
    if (!checkIpRateLimit(ip)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      )
    }

    const body = await request.json()
    const parsed = bookingSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const data = parsed.data
    // The bf_user session is authoritative for the customer identity; the
    // body value is only a fallback for legacy clients without the cookie.
    const sessionUser = await getCurrentCustomerUser()
    if (sessionUser) data.customer_user_id = sessionUser.id
    const requestedParticipants = data.participants_count ?? 1
    // Service role: customer identity comes from the bf_user cookie above, not
    // from Supabase auth, so this client was always anon. The rate-limit and
    // conflict checks below must see all of a business's appointments, and the
    // insert previously relied on `WITH CHECK (true)` policies that also let
    // anyone read every customer's contact details.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createServiceClient() as any

    // Rate limit: max 3 bookings per phone per 10 minutes (prevents WhatsApp spam)
    if (data.customer_phone && !data.customer_user_id) {
      const windowStart = new Date(Date.now() - 10 * 60 * 1000).toISOString()
      const { count } = await supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("customer_phone", data.customer_phone)
        .gte("created_at", windowStart)
      if ((count ?? 0) >= 3) {
        return NextResponse.json(
          { error: "Too many booking requests. Please try again in a few minutes." },
          { status: 429 }
        )
      }
    }

    // Verify business exists
    const { data: business } = await supabase
      .from("businesses")
      .select("id, name, slug, app_icon_url, logo_url, booking_mode, group_capacity, appointments_require_confirmation, booking_verification_method, wa_booking_confirmation, active, language")
      .eq("id", data.business_id)
      .single() as {
        data: Pick<Business, "id" | "name" | "slug" | "app_icon_url" | "logo_url" | "booking_mode" | "group_capacity" | "appointments_require_confirmation" | "booking_verification_method" | "wa_booking_confirmation" | "active" | "language"> | null
        error: unknown
      }

    if (!business || business.active === false) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 })
    }

    // Showcase build resolves this to "none"; production uses the per-business setting.
    const verificationMethod = resolveVerificationMethod(business.booking_verification_method)

    if (data.customer_email && !data.force_new) {
      const today = new Date().toISOString().slice(0, 10)
      const { data: existingAppointments } = await supabase
        .from("appointments")
        .select("id, manage_token, appointment_date, start_time")
        .eq("business_id", data.business_id)
        .eq("customer_email", data.customer_email)
        .gte("appointment_date", today)
        .not("status", "in", "(cancelled,completed)")
        .order("appointment_date", { ascending: true })
        .order("start_time", { ascending: true })
        .limit(5) as {
          data: { id: string; manage_token: string | null; appointment_date: string; start_time: string }[] | null
        }

      const validExisting = (existingAppointments ?? []).filter(a => a.manage_token)
      if (validExisting.length > 0) {
        return NextResponse.json({
          existing_booking: true,
          appointments: validExisting.map(a => ({
            manage_url: `/manage-booking/${a.manage_token}`,
            appointment_date: a.appointment_date,
            start_time: a.start_time,
          })),
          // legacy single-item fields kept for backward compat
          manage_url: `/manage-booking/${validExisting[0].manage_token}`,
          appointment_date: validExisting[0].appointment_date,
          start_time: validExisting[0].start_time,
        })
      }
    }

    // Verify service exists and is active
    const { data: service } = await supabase
      .from("services")
      .select("id, duration_minutes, active")
      .eq("id", data.service_id)
      .eq("business_id", data.business_id)
      .single() as { data: Pick<Service, "id" | "duration_minutes" | "active"> | null; error: unknown }

    if (!service || !service.active) {
      return NextResponse.json({ error: "Service not found or inactive" }, { status: 400 })
    }

    // A staff member with assignments may only be booked for those services.
    // No rows at all means "performs everything", matching the booking UI.
    if (data.staff_member_id) {
      const { data: assignments } = await supabase
        .from("staff_services")
        .select("service_id")
        .eq("staff_member_id", data.staff_member_id) as { data: { service_id: string }[] | null }

      if (assignments && assignments.length > 0 &&
          !assignments.some(link => link.service_id === data.service_id)) {
        return NextResponse.json(
          { error: "This team member does not perform the selected service" },
          { status: 400 }
        )
      }
    }

    const endTime = calculateEndTime(data.start_time, data.duration_minutes)

    // Check day of week working hours
    const [y, m, d] = data.appointment_date.split("-").map(Number)
    const dow = new Date(y, m - 1, d).getDay()

    const { data: wh } = await supabase
      .from("working_hours")
      .select("is_open, open_time, close_time")
      .eq("business_id", data.business_id)
      .eq("day_of_week", dow)
      .single() as { data: Pick<WorkingHours, "is_open" | "open_time" | "close_time"> | null; error: unknown }

    if (!wh || !wh.is_open) {
      return NextResponse.json({ error: "Business is closed on this day" }, { status: 400 })
    }

    if (wh.open_time && wh.close_time) {
      const startMins = timeToMins(data.start_time)
      const endMins   = timeToMins(endTime)
      const openMins  = timeToMins(wh.open_time.slice(0, 5))
      const closeMins = timeToMins(wh.close_time.slice(0, 5))

      if (startMins < openMins || endMins > closeMins) {
        return NextResponse.json(
          { error: "Requested time is outside working hours" },
          { status: 400 }
        )
      }
    }

    // Server-side conflict check
    const slotCapacity = business.booking_mode === "group" ? business.group_capacity : 1

    if (business.booking_mode === "appointment" && requestedParticipants !== 1) {
      return NextResponse.json({ error: "Appointments allow one participant per slot" }, { status: 400 })
    }

    if (requestedParticipants > slotCapacity) {
      return NextResponse.json({ error: "Participant count exceeds session capacity" }, { status: 400 })
    }

    type ApptSlot = { id: string; start_time: string; end_time: string; participants_count: number }
    let conflictQuery = supabase
      .from("appointments")
      .select("id, start_time, end_time, participants_count")
      .eq("business_id", data.business_id)
      .eq("appointment_date", data.appointment_date)
      .neq("status", "cancelled")

    if (data.staff_member_id) {
      conflictQuery = conflictQuery.eq("staff_member_id", data.staff_member_id)
    }

    const { data: conflicts } = await conflictQuery as { data: ApptSlot[] | null }
    const startMins = timeToMins(data.start_time)
    const endMins   = timeToMins(endTime)

    const bookedParticipants = (conflicts ?? []).reduce((sum, appt) => {
      const aStart = timeToMins(appt.start_time.slice(0, 5))
      const aEnd   = timeToMins(appt.end_time.slice(0, 5))
      const overlaps = startMins < aEnd && endMins > aStart
      return overlaps ? sum + (appt.participants_count ?? 1) : sum
    }, 0)

    if (bookedParticipants + requestedParticipants > slotCapacity) {
      return NextResponse.json(
        { error: "This time slot is no longer available. Please choose another." },
        { status: 409 }
      )
    }

    // Upsert customer record
    let customerId: string | null = null
    if (data.customer_email) {
      const { data: existingCustomer } = await supabase
        .from("customers")
        .select("id, customer_user_id")
        .eq("business_id", data.business_id)
        .eq("email", data.customer_email)
        .maybeSingle() as { data: { id: string; customer_user_id: string | null } | null }

      if (existingCustomer) {
        customerId = existingCustomer.id
        // Link customer_user_id if the customer just logged in and it wasn't set before
        if (data.customer_user_id && !existingCustomer.customer_user_id) {
          await supabase
            .from("customers")
            .update({ customer_user_id: data.customer_user_id })
            .eq("id", existingCustomer.id)
        }
      } else {
        const { data: newCustomer } = await supabase
          .from("customers")
          .insert({
            business_id:      data.business_id,
            name:             data.customer_name,
            email:            data.customer_email,
            phone:            data.customer_phone ?? null,
            customer_user_id: data.customer_user_id ?? null,
          })
          .select("id")
          .single() as { data: { id: string } | null }

        customerId = newCustomer?.id ?? null
      }
    }

    // Create appointment
    const manageToken = randomBytes(24).toString("hex")
    const { data: appointment, error } = await supabase
      .from("appointments")
      .insert({
        business_id:      data.business_id,
        service_id:       data.service_id,
        staff_member_id:  data.staff_member_id ?? null,
        customer_id:      customerId,
        customer_user_id: data.customer_user_id ?? null,
        customer_name:    data.customer_name,
        customer_email:   data.customer_email,
        customer_phone:   data.customer_phone ?? null,
        appointment_date: data.appointment_date,
        start_time:       `${data.start_time}:00`,
        end_time:         `${endTime}:00`,
        participants_count: requestedParticipants,
        manage_token:     manageToken,
        status:           (verificationMethod === "link" && !data.customer_user_id) || business.appointments_require_confirmation ? "pending" : "booked",
        notes:            data.notes ?? null,
      })
      .select("id")
      .single() as { data: { id: string } | null; error: { message: string } | null }

    if (error) {
      console.error("Booking insert error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Save the business to the customer's "My Businesses" list + notify
    if (data.customer_user_id) {
      try {
        await recordBusinessVisit(data.customer_user_id, data.business_id)
      } catch (visitError) {
        console.error("recordBusinessVisit failed:", visitError)
      }
      try {
        await notifyCustomer(data.customer_user_id, {
          type: "booking_confirmed",
          title: `Booking at ${business.name}`,
          body: `${data.appointment_date} at ${data.start_time} — see you there!`,
          businessId: data.business_id,
          url: `/manage-booking/${manageToken}`,
        })
      } catch (notifyError) {
        console.error("notifyCustomer failed:", notifyError)
      }
    }

    const t = getDictionary(business.language)
    const status = business.appointments_require_confirmation ? "pending" : "booked"

    await logAppointmentEvent({
      businessId: data.business_id,
      appointmentId: appointment!.id,
      eventType: "reservation",
      title: t.events.newReservation,
      description: `${data.customer_name} ${t.events.booked} ${data.appointment_date} ${t.common.time} ${data.start_time}.`,
      metadata: {
        customer_name: data.customer_name,
        appointment_date: data.appointment_date,
        start_time: data.start_time,
        status,
      },
    })

    try {
      await sendBusinessPushNotification(data.business_id, {
        title: t.events.newBookingRequest,
        body: `${data.customer_name} ${t.events.booked} ${data.appointment_date} ${t.common.time} ${data.start_time}. ${statusLabel(status, business.language)}`,
        url: `/admin/${business.slug}`,
        icon: business.app_icon_url || business.logo_url,
      })
    } catch (pushError) {
      console.error("New booking push failed:", pushError)
    }

    if (data.customer_phone) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""
      if (verificationMethod === "link" && !data.customer_user_id) {
        // Unverified user with link method → send verification link
        const dayNames: Record<string, string[]> = {
          ar: ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"],
          en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        }
        const lang = business.language ?? "ar"
        const [yr, mo, dy] = data.appointment_date.split("-").map(Number)
        const apptDate = new Date(yr, mo - 1, dy)
        const dayName = (dayNames[lang] ?? dayNames.ar)[apptDate.getDay()]
        sendBookingVerificationLink(data.customer_phone, {
          customerName: data.customer_name,
          businessName: business.name,
          dayName,
          date: data.appointment_date,
          time: data.start_time,
          confirmUrl: `${baseUrl}/confirm-booking/${manageToken}`,
        }).then(() => logWaMessage(business.id, "verification_link", data.customer_phone!))
          .catch((err) => { logWaMessage(business.id, "verification_link", data.customer_phone!, "failed"); console.error("[wa] booking verification link failed:", err) })
      } else if (verificationMethod !== "link" && business.wa_booking_confirmation !== false) {
        // OTP/none method + wa_booking_confirmation enabled → send regular booking confirmation
        sendBookingConfirmation(data.customer_phone, {
          customerName: data.customer_name,
          businessName: business.name,
          manageUrl: `${baseUrl}/manage-booking/${manageToken}`,
        }).then(() => logWaMessage(business.id, "booking_confirmation", data.customer_phone!))
          .catch((err) => { logWaMessage(business.id, "booking_confirmation", data.customer_phone!, "failed"); console.error("[wa] booking confirmation failed:", err) })
      }
      // Link method + verified user → no WhatsApp needed, booking is already confirmed
    }

    const response = NextResponse.json(
      {
        id: appointment!.id,
        manage_url: `/manage-booking/${manageToken}`,
        verification_method: verificationMethod,
        success: true,
      },
      { status: 201 }
    )

    if (customerId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const serviceSupabase = createServiceClient() as any
      const sessionToken = createCustomerSessionToken()
      const expiresAt = customerSessionExpiresAt()
      const { error: sessionError } = await serviceSupabase
        .from("customer_sessions")
        .insert({
          business_id: data.business_id,
          customer_id: customerId,
          token_hash: hashCustomerSessionToken(sessionToken),
          user_agent: request.headers.get("user-agent"),
          expires_at: expiresAt,
        })
      if (sessionError) {
        console.error("Customer session insert failed:", sessionError)
      }

      response.cookies.set(getCustomerSessionCookieName(data.business_id), sessionToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: CUSTOMER_SESSION_MAX_AGE_SECONDS,
        path: "/",
      })
    }

    response.cookies.set(getCustomerManageCookieName(data.business_id), manageToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: CUSTOMER_SESSION_MAX_AGE_SECONDS,
      path: "/",
    })

    return response
  } catch (err) {
    console.error("Booking error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

function timeToMins(time: string): number {
  const [h, m] = time.split(":").map(Number)
  return h * 60 + m
}
