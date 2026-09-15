/**
 * POST /api/customer/auth/otp/verify
 * Verify OTP + complete registration or login.
 *
 * For registration: { phone, code, password, full_name? }
 * For login via OTP: not used here (login uses password).
 *
 * Returns: set bf_user cookie + { user }
 */
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createServiceClient } from "@/lib/supabase/service"
import {
  hashPassword,
  createSession,
  normalizePhone,
  CUSTOMER_AUTH_COOKIE,
  sessionCookieOptions,
} from "@/lib/customer-auth"

const schema = z.object({
  phone: z.string().min(7).max(20),
  code: z.string().length(4),
  password: z.string().min(8).max(72),
  full_name: z.string().min(1).max(120).optional(),
})

export async function POST(req: NextRequest) {
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 422 })

  const { code, password, full_name } = parsed.data
  const phone = normalizePhone(parsed.data.phone)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any
  const now = new Date().toISOString()

  // Find a valid, unused OTP
  const { data: otp } = await service
    .from("phone_otps")
    .select("id")
    .eq("phone", phone)
    .eq("code", code)
    .eq("purpose", "register")
    .is("used_at", null)
    .gt("expires_at", now)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle() as { data: { id: string } | null }

  if (!otp) {
    return NextResponse.json({ error: "Invalid or expired code. Request a new one." }, { status: 401 })
  }

  // Mark OTP as used
  await service.from("phone_otps").update({ used_at: now }).eq("id", otp.id)

  // Double-check phone not registered in the race window
  const { data: existing } = await service
    .from("customer_users")
    .select("id")
    .eq("phone", phone)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: "Phone already registered. Please log in instead." }, { status: 409 })
  }

  const password_hash = await hashPassword(password)

  const { data: user, error } = await service
    .from("customer_users")
    .insert({ phone, password_hash, full_name: full_name ?? null })
    .select("id, phone, full_name")
    .single()

  if (error) {
    console.error("[otp/verify] insert user failed:", error)
    return NextResponse.json({ error: "Registration failed. Please try again." }, { status: 500 })
  }

  const token = await createSession(user.id, req.headers.get("user-agent") ?? undefined)

  const res = NextResponse.json({ user: { id: user.id, phone: user.phone, full_name: user.full_name } })
  res.cookies.set(CUSTOMER_AUTH_COOKIE, token, sessionCookieOptions())
  return res
}
