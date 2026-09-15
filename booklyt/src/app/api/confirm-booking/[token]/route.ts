import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { randomBytes } from "crypto"
import {
  createSession,
  normalizePhone,
  CUSTOMER_AUTH_COOKIE,
  sessionCookieOptions,
} from "@/lib/customer-auth"
import {
  createCustomerSessionToken,
  customerSessionExpiresAt,
  CUSTOMER_SESSION_MAX_AGE_SECONDS,
  getCustomerSessionCookieName,
  hashCustomerSessionToken,
} from "@/lib/customer-session"

type RouteContext = { params: Promise<{ token: string }> }

function getAppointment(service: ReturnType<typeof createServiceClient>, token: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (service as any)
    .from("appointments")
    .select(
      "id, status, customer_name, customer_phone, customer_user_id, business_id, businesses(id, name, slug, booking_verification_method)"
    )
    .eq("manage_token", token)
    .maybeSingle()
}

// POST — confirm booking + create session
export async function POST(_request: Request, context: RouteContext) {
  const { token } = await context.params
  const service = createServiceClient()

  const { data: appointment } = await getAppointment(service, token)
  if (!appointment) {
    return NextResponse.json({ error: "Appointment not found" }, { status: 404 })
  }

  const biz = appointment.businesses as {
    id: string; name: string; slug: string; booking_verification_method: string
  } | null
  if (!biz || biz.booking_verification_method !== "link") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  if (appointment.status === "cancelled") {
    return NextResponse.json({ error: "This booking has been cancelled" }, { status: 400 })
  }
  if (appointment.status === "booked" || appointment.status === "confirmed") {
    return NextResponse.json({ already: true })
  }

  // Confirm
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = service as any
  await svc
    .from("appointments")
    .update({ status: "booked", updated_at: new Date().toISOString() })
    .eq("id", appointment.id)

  const res = NextResponse.json({ confirmed: true })

  // Create session for the customer
  const phone = appointment.customer_phone
    ? normalizePhone(appointment.customer_phone)
    : null

  if (phone) {
    const { data: existingUser } = await svc
      .from("customer_users")
      .select("id, phone, full_name")
      .eq("phone", phone)
      .maybeSingle()

    let userId: string | null = null

    if (existingUser) {
      userId = existingUser.id
      if (appointment.customer_name && !existingUser.full_name) {
        await svc.from("customer_users").update({ full_name: appointment.customer_name }).eq("id", existingUser.id)
      }
    } else {
      const { data: created } = await svc
        .from("customer_users")
        .insert({
          phone,
          full_name: appointment.customer_name ?? null,
          password_hash: randomBytes(32).toString("hex"),
        })
        .select("id")
        .single()
      if (created) userId = created.id
    }

    if (userId) {
      if (!appointment.customer_user_id) {
        await svc.from("appointments").update({ customer_user_id: userId }).eq("id", appointment.id)
      }

      const sessionToken = await createSession(userId)
      res.cookies.set(CUSTOMER_AUTH_COOKIE, sessionToken, sessionCookieOptions())

      const { data: customer } = await svc
        .from("customers")
        .select("id")
        .eq("business_id", biz.id)
        .eq("phone", phone)
        .maybeSingle()

      if (customer) {
        const bizSessionToken = createCustomerSessionToken()
        await svc.from("customer_sessions").insert({
          business_id: biz.id,
          customer_id: customer.id,
          token_hash: hashCustomerSessionToken(bizSessionToken),
          expires_at: customerSessionExpiresAt(),
        })
        res.cookies.set(getCustomerSessionCookieName(biz.id), bizSessionToken, {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          maxAge: CUSTOMER_SESSION_MAX_AGE_SECONDS,
          path: "/",
        })
      }
    }
  }

  return res
}

// DELETE — decline / cancel booking
export async function DELETE(_request: Request, context: RouteContext) {
  const { token } = await context.params
  const service = createServiceClient()

  const { data: appointment } = await getAppointment(service, token)
  if (!appointment) {
    return NextResponse.json({ error: "Appointment not found" }, { status: 404 })
  }

  if (appointment.status === "cancelled") {
    return NextResponse.json({ already: true })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (service as any)
    .from("appointments")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", appointment.id)

  return NextResponse.json({ cancelled: true })
}
