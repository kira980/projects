/**
 * POST /api/customer/auth/otp/verify-booking
 * Verify a booking OTP (purpose="booking") and create or log in the customer.
 * No password required — OTP is the sole credential.
 *
 * Body: { phone, code, full_name? }
 * Returns: { user: { id, phone, full_name } } + sets bf_user cookie (1-year session)
 */
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { randomBytes } from "crypto"
import { createServiceClient } from "@/lib/supabase/service"
import {
  normalizePhone,
  createSession,
  CUSTOMER_AUTH_COOKIE,
  sessionCookieOptions,
} from "@/lib/customer-auth"

const schema = z.object({
  phone: z.string().min(7).max(20),
  code: z.string().length(4),
  full_name: z.string().min(1).max(120).optional(),
})

export async function POST(req: NextRequest) {
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 422 })

  const { code, full_name } = parsed.data
  const phone = normalizePhone(parsed.data.phone)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any
  const now = new Date().toISOString()

  const { data: otp } = await service
    .from("phone_otps")
    .select("id")
    .eq("phone", phone)
    .eq("code", code)
    .eq("purpose", "booking")
    .is("used_at", null)
    .gt("expires_at", now)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle() as { data: { id: string } | null }

  if (!otp) {
    return NextResponse.json({ error: "Invalid or expired code. Request a new one." }, { status: 401 })
  }

  await service.from("phone_otps").update({ used_at: now }).eq("id", otp.id)

  // Find or create the customer user
  const { data: existing } = await service
    .from("customer_users")
    .select("id, phone, full_name")
    .eq("phone", phone)
    .maybeSingle() as { data: { id: string; phone: string; full_name: string | null } | null }

  let user: { id: string; phone: string; full_name: string | null }

  if (existing) {
    // Update full_name if provided and not yet set
    if (full_name && !existing.full_name) {
      await service.from("customer_users").update({ full_name }).eq("id", existing.id)
      user = { ...existing, full_name }
    } else {
      user = existing
    }
  } else {
    // New user — password_hash gets a random value (OTP-only users can't use password login)
    const { data: created, error } = await service
      .from("customer_users")
      .insert({
        phone,
        full_name: full_name ?? null,
        password_hash: randomBytes(32).toString("hex"),
      })
      .select("id, phone, full_name")
      .single() as { data: { id: string; phone: string; full_name: string | null } | null; error: unknown }

    if (!created) {
      console.error("[verify-booking] user insert failed:", error)
      return NextResponse.json({ error: "Account creation failed. Please try again." }, { status: 500 })
    }
    user = created
  }

  const token = await createSession(user.id, req.headers.get("user-agent") ?? undefined)
  const res = NextResponse.json({ user: { id: user.id, phone: user.phone, full_name: user.full_name } })
  res.cookies.set(CUSTOMER_AUTH_COOKIE, token, sessionCookieOptions())
  return res
}
