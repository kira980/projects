/**
 * POST /api/customer/auth/otp
 * Send a WhatsApp OTP to the given phone number.
 *
 * purpose "register" : phone must NOT be registered yet
 * purpose "login"    : phone must already be registered
 * purpose "booking"  : no registration check — creates or logs in via verify-booking
 */
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { randomInt } from "crypto"
import { createServiceClient } from "@/lib/supabase/service"
import { normalizePhone } from "@/lib/customer-auth"
import { sendOtp } from "@/lib/whatsapp"
import { logWaMessage } from "@/lib/wa-log"

const schema = z.object({
  phone: z.string().min(7).max(20),
  purpose: z.enum(["register", "login", "booking"]).default("register"),
  business_id: z.string().uuid().optional(),
})

const OTP_TTL_MINUTES = 10
const MAX_RECENT_OTPS = 5

export async function POST(req: NextRequest) {
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 422 })

  const { purpose, business_id } = parsed.data
  const phone = normalizePhone(parsed.data.phone)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any

  if (purpose !== "booking") {
    const { data: existing } = await service
      .from("customer_users")
      .select("id")
      .eq("phone", phone)
      .maybeSingle()

    if (purpose === "register" && existing) {
      return NextResponse.json({ error: "Phone already registered. Please log in instead." }, { status: 409 })
    }
    if (purpose === "login" && !existing) {
      return NextResponse.json({ error: "Phone not registered. Please sign up first." }, { status: 404 })
    }
  }

  const windowStart = new Date(Date.now() - OTP_TTL_MINUTES * 60 * 1000).toISOString()
  const { count } = await service
    .from("phone_otps")
    .select("id", { count: "exact", head: true })
    .eq("phone", phone)
    .gte("created_at", windowStart)

  if ((count ?? 0) >= MAX_RECENT_OTPS) {
    return NextResponse.json({ error: "Too many OTP requests. Try again in 10 minutes." }, { status: 429 })
  }

  // 4-digit OTP
  const code = String(randomInt(1000, 9999))
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString()

  await service.from("phone_otps").insert({ phone, code, purpose, expires_at: expiresAt })

  try {
    await sendOtp(phone, code)
    if (business_id) logWaMessage(business_id, "auth", phone)
  } catch (err) {
    console.error("[otp] WhatsApp send failed:", err)
    if (business_id) logWaMessage(business_id, "auth", phone, "failed")
    await service.from("phone_otps").delete().eq("phone", phone).eq("code", code).is("used_at", null)
    return NextResponse.json({ error: "Failed to send WhatsApp message. Check the phone number and try again." }, { status: 502 })
  }

  return NextResponse.json({ ok: true, expires_in: OTP_TTL_MINUTES * 60 })
}
