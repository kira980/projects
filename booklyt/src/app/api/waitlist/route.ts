import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { z } from "zod"

const waitlistSchema = z.object({
  business_id: z.string().uuid(),
  service_id: z.string().uuid(),
  staff_member_id: z.string().uuid().nullable().optional(),
  customer_name: z.string().min(2),
  customer_email: z.string().email().nullable().optional(),
  customer_phone: z.string().nullable().optional(),
  preferred_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  participants_count: z.number().int().positive().optional(),
  preferred_eras: z.array(z.enum(["morning", "noon", "evening"])).optional(),
})

export async function POST(request: Request) {
  try {
    const parsed = waitlistSchema.safeParse(await request.json())

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const data = parsed.data

    if (!data.customer_email && !data.customer_phone) {
      return NextResponse.json(
        { error: "Please add an email or phone so the business can contact you." },
        { status: 400 }
      )
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createServiceClient() as any

    const base = {
      business_id: data.business_id,
      service_id: data.service_id,
      staff_member_id: data.staff_member_id ?? null,
      customer_name: data.customer_name,
      customer_email: data.customer_email ?? null,
      customer_phone: data.customer_phone ?? null,
      preferred_date: data.preferred_date,
      participants_count: data.participants_count ?? 1,
    }

    // Try inserting with preferred_eras first; if the column doesn't exist yet
    // (migration pending), fall back to inserting without it.
    let entry: { id: string; notify_token?: string | null } | null = null
    const { data: entry1, error: err1 } = await supabase
      .from("waitlist_entries")
      .insert({ ...base, preferred_eras: data.preferred_eras ?? [] })
      .select("id, notify_token")
      .single()

    if (err1) {
      // 42703 = column does not exist — migration not yet applied
      if (err1.code === "42703") {
        const { data: entry2, error: err2 } = await supabase
          .from("waitlist_entries")
          .insert(base)
          .select("id")
          .single()

        if (err2) {
          console.error("Waitlist insert error (fallback):", err2)
          return NextResponse.json({ error: err2.message }, { status: 500 })
        }
        entry = entry2
      } else {
        console.error("Waitlist insert error:", err1)
        return NextResponse.json({ error: err1.message }, { status: 500 })
      }
    } else {
      entry = entry1
    }

    return NextResponse.json({ success: true, entry_id: entry!.id, notify_token: entry!.notify_token }, { status: 201 })
  } catch (err) {
    console.error("Waitlist error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
