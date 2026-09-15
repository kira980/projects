import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import type { Business } from "@/types/database"

export const dynamic = "force-dynamic"

export async function GET() {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supa = supabase as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: business } = await supa
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle() as { data: Pick<Business, "id"> | null; error: unknown }

  if (!business) return NextResponse.json({ error: "No business" }, { status: 404 })

  const { data: rows } = await supa
    .from("wa_message_log")
    .select("message_type, status")
    .eq("business_id", business.id) as {
      data: { message_type: string; status: string }[] | null
      error: unknown
    }

  const logs = rows ?? []

  const counts = {
    auth: 0,
    booking_confirmation: 0,
    reminder: 0,
    waitlist: 0,
    verification_link: 0,
    total: 0,
    failed: 0,
  }

  for (const row of logs) {
    if (row.message_type in counts) {
      counts[row.message_type as keyof typeof counts]++
    }
    counts.total++
    if (row.status === "failed") counts.failed++
  }

  return NextResponse.json(counts)
}
