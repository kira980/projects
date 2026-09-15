import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  // Signup stores the name in auth metadata. This also covers users who
  // reach onboarding after confirming their email in another browser.
  let fullName: string | null = typeof user.user_metadata?.full_name === "string"
    ? user.user_metadata.full_name
    : null
  try {
    const body = await req.json()
    fullName = typeof body.full_name === "string" ? body.full_name : fullName
  } catch {
    // body is optional
  }

  // Use rpc to avoid @supabase/supabase-js v2.45 upsert type-inference bug
  // (profiles.Insert.id is required, which breaks upsert's generic resolution to never[])
  const { error } = await supabase.rpc("ensure_profile", { p_full_name: fullName })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
