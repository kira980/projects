/**
 * POST /api/customer/auth/otp/verify-login
 * Verify a WhatsApp OTP for an existing user and create a session.
 * Passwordless login: only the OTP is required.
 *
 * Body: { phone: string, code: string }
 * Returns: sets bf_user cookie + { user }
 */
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createServiceClient } from "@/lib/supabase/service"
import {
  createSession,
  normalizePhone,
  CUSTOMER_AUTH_COOKIE,
  sessionCookieOptions,
} from "@/lib/customer-auth"

const schema = z.object({
  phone: z.string().min(7).max(20),
  code:  z.string().regex(/^\d{4,6}$/, "Invalid code"),
})

export async function POST(req: NextRequest) {
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 422 })

  const phone = normalizePhone(parsed.data.phone)
  const { code } = parsed.data

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any
  const now = new Date().toISOString()

  // Find a valid, unused login OTP
  const { data: otp } = await service
    .from("phone_otps")
    .select("id")
    .eq("phone", phone)
    .eq("code", code)
    .eq("purpose", "login")
    .is("used_at", null)
    .gt("expires_at", now)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle() as { data: { id: string } | null }

  if (!otp) {
    return NextResponse.json({ error: "Invalid or expired code. Request a new one." }, { status: 401 })
  }

  // Mark OTP as used immediately to prevent replay
  await service.from("phone_otps").update({ used_at: now }).eq("id", otp.id)

  // Load the user
  const { data: user } = await service
    .from("customer_users")
    .select("id, phone, full_name")
    .eq("phone", phone)
    .maybeSingle() as { data: { id: string; phone: string; full_name: string | null } | null }

  if (!user) {
    return NextResponse.json({ error: "Account not found. Please register first." }, { status: 404 })
  }

  const token = await createSession(user.id, req.headers.get("user-agent") ?? undefined)

  const res = NextResponse.json({ user: { id: user.id, phone: user.phone, full_name: user.full_name } })
  res.cookies.set(CUSTOMER_AUTH_COOKIE, token, sessionCookieOptions())
  return res
}
