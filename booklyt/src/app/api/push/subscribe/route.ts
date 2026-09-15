import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { getAdminVerifiedBusiness } from "@/lib/admin-business"
import { z } from "zod"

const subscriptionSchema = z.object({
  business_id: z.string().uuid().nullable().optional(),
  admin_slug: z.string().min(1).nullable().optional(),
  appointment_id: z.string().uuid().nullable().optional(),
  waitlist_entry_id: z.string().uuid().nullable().optional(),
  notify_token: z.string().min(1).nullable().optional(),
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
})

export async function POST(request: Request) {
  try {
    const parsed = subscriptionSchema.safeParse(await request.json())

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid subscription" }, { status: 400 })
    }

    const data = parsed.data
    const supabase = await createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = createServiceClient() as any
    let verifiedBusinessId = data.business_id ?? null
    let resolvedWaitlistEntryId = data.waitlist_entry_id ?? null

    if (data.admin_slug) {
      const { business } = await getAdminVerifiedBusiness(data.admin_slug)

      if (!business || (data.business_id && business.id !== data.business_id)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }

      verifiedBusinessId = business.id
    } else if (data.business_id) {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }

      const { data: business } = await supabase
        .from("businesses")
        .select("id")
        .eq("id", data.business_id)
        .eq("owner_id", user.id)
        .maybeSingle()

      if (!business) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
    }

    // Resolve waitlist_entry_id from notify_token (persists across browser sessions)
    if (data.notify_token && !resolvedWaitlistEntryId) {
      const { data: wlEntry } = await service
        .from("waitlist_entries")
        .select("id")
        .eq("notify_token", data.notify_token)
        .maybeSingle()
      if (wlEntry) resolvedWaitlistEntryId = wlEntry.id
    }

    // Verify waitlist entry exists if provided directly
    if (resolvedWaitlistEntryId && !verifiedBusinessId) {
      const { data: wlEntry } = await service
        .from("waitlist_entries")
        .select("id")
        .eq("id", resolvedWaitlistEntryId)
        .maybeSingle()
      if (!wlEntry) {
        return NextResponse.json({ error: "Waitlist entry not found" }, { status: 404 })
      }
    }

    // For appointment subscriptions: delete any existing row for this (endpoint, appointment_id)
    // pair then insert fresh — avoids relying on a partial unique index for upsert conflict resolution.
    // For admin/waitlist subscriptions: upsert by endpoint as before.
    let error: { message: string } | null = null
    if (data.appointment_id) {
      await service
        .from("push_subscriptions")
        .delete()
        .eq("endpoint", data.endpoint)
        .eq("appointment_id", data.appointment_id)

      const res = await service
        .from("push_subscriptions")
        .insert({
          business_id: verifiedBusinessId,
          appointment_id: data.appointment_id,
          waitlist_entry_id: null,
          endpoint: data.endpoint,
          p256dh: data.keys.p256dh,
          auth: data.keys.auth,
          user_agent: request.headers.get("user-agent"),
          updated_at: new Date().toISOString(),
        })
      error = res.error
    } else {
      const res = await service
        .from("push_subscriptions")
        .upsert(
          {
            business_id: verifiedBusinessId,
            appointment_id: null,
            waitlist_entry_id: resolvedWaitlistEntryId,
            endpoint: data.endpoint,
            p256dh: data.keys.p256dh,
            auth: data.keys.auth,
            user_agent: request.headers.get("user-agent"),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "endpoint" }
        )
      error = res.error
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Push subscribe error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
