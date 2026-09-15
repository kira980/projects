import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getAdminVerifiedBusiness } from "@/lib/admin-business"
import { hashAdminPassword } from "@/lib/admin-password"

type RouteContext = {
  params: Promise<{ businessSlug: string }>
}

const settingsSchema = z.object({
  name: z.string().min(2).optional(),
  category: z.string().min(1).optional(),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  app_name: z.string().nullable().optional(),
  logo_url: z.string().nullable().optional(),
  app_icon_url: z.string().nullable().optional(),
  booking_mode: z.enum(["appointment", "group"]).optional(),
  group_capacity: z.number().int().min(1).optional(),
  appointments_require_confirmation: z.boolean().optional(),
  customer_confirmation_enabled: z.boolean().optional(),
  booking_verification_method: z.enum(["otp", "link", "none"]).optional(),
  timezone: z.string().optional(),
  wa_booking_confirmation: z.boolean().optional(),
  wa_reminders: z.boolean().optional(),
  wa_waitlist: z.boolean().optional(),
  active: z.boolean().optional(),
  time_format: z.enum(["12h", "24h"]).optional(),
  language: z.enum(["en", "ar"]).optional(),
  currency: z.string().optional(),
  country_code: z.string().optional(),
  slot_interval: z.number().int().min(5).max(120).optional(),
  booking_days_ahead: z.number().int().min(1).max(365).nullable().optional(),
  admin_password: z.string().min(8).optional(),
})

export async function GET(_request: NextRequest, context: RouteContext) {
  const { businessSlug } = await context.params
  const { business, supabase } = await getAdminVerifiedBusiness(businessSlug)

  if (!business) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data, error } = await supabase
    .from("businesses")
    .select(`
      id,
      name,
      slug,
      category,
      phone,
      address,
      logo_url,
      description,
      app_name,
      app_icon_url,
      booking_mode,
      group_capacity,
      appointments_require_confirmation,
      customer_confirmation_enabled,
      booking_verification_method,
      timezone,
      wa_booking_confirmation,
      wa_reminders,
      wa_waitlist,
      active,
      time_format,
      language,
      currency,
      country_code,
      slot_interval,
      booking_days_ahead,
      admin_password_updated_at
    `)
    .eq("id", business.id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { businessSlug } = await context.params
  const { business, supabase } = await getAdminVerifiedBusiness(businessSlug)

  if (!business) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const parsed = settingsSchema.safeParse(await request.json())

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid settings", details: parsed.error.flatten() }, { status: 400 })
  }

  const { admin_password, ...settings } = parsed.data
  const now = new Date().toISOString()
  const update: Record<string, unknown> = {
    ...settings,
    updated_at: now,
  }

  if ("app_name" in settings || "name" in settings) {
    update.app_name = settings.app_name?.trim() || settings.name || null
  }

  if (admin_password) {
    const { salt, hash } = hashAdminPassword(admin_password)
    update.admin_password_salt = salt
    update.admin_password_hash = hash
    update.admin_password_updated_at = now
  }

  const { error } = await supabase
    .from("businesses")
    .update(update)
    .eq("id", business.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
