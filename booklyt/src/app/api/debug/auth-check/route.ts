import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

// DELETE THIS FILE BEFORE GOING TO PRODUCTION
// Visit /api/debug/auth-check while logged in to diagnose dashboard redirect issues.
export async function GET() {
  try {
    const supabase = await createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = createServiceClient() as any

    // 1. What does the server-side auth client see?
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({
        step: "auth",
        error: userError?.message ?? "No user — not logged in or session expired",
        user: null,
      })
    }

    // 2. Does a profiles row exist for this user?
    const { data: profile, error: profileError } = await service
      .from("profiles")
      .select("id, full_name, created_at")
      .eq("id", user.id)
      .maybeSingle()

    // 3. Does a businesses row exist for this user? (service client = no RLS)
    const { data: business, error: bizError } = await service
      .from("businesses")
      .select("id, name, slug, owner_id, created_at")
      .eq("owner_id", user.id)
      .maybeSingle()

    // 4. Same query but with the regular auth client (subject to RLS)
    const { data: businessRLS, error: bizRLSError } = await supabase
      .from("businesses")
      .select("id, name, slug, owner_id")
      .eq("owner_id", user.id)
      .maybeSingle()

    // 5. How many businesses total exist in the table?
    const { count: totalBusinesses } = await service
      .from("businesses")
      .select("*", { count: "exact", head: true })

    // 6. Check FK constraint — does owner_id reference profiles or auth.users?
    const { data: fkInfo } = await service.rpc("get_businesses_fk_info").maybeSingle().catch(() => ({ data: null }))

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
      },
      profile: {
        exists: !!profile,
        data: profile ?? null,
        error: profileError?.message ?? null,
      },
      business_via_service_client: {
        exists: !!business,
        data: business ?? null,
        error: bizError?.message ?? null,
        note: "No RLS — shows raw DB state",
      },
      business_via_auth_client: {
        exists: !!businessRLS,
        data: businessRLS ?? null,
        error: bizRLSError?.message ?? null,
        note: "With RLS — same query the dashboard uses",
      },
      total_businesses_in_db: totalBusinesses,
      fk_info: fkInfo,
      diagnosis: getDiagnosis({ profile, business, businessRLS, bizRLSError, profileError }),
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

function getDiagnosis({ profile, business, businessRLS, bizRLSError, profileError }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  profile: any, business: any, businessRLS: any, bizRLSError: any, profileError: any
}) {
  if (!business) return "❌ No business row exists in DB for this owner_id. Run /onboarding to create one."
  if (business && !businessRLS) {
    if (bizRLSError) return `❌ Business EXISTS in DB but RLS is blocking it. Error: ${bizRLSError.message}`
    return "❌ Business EXISTS in DB but auth client query returns null — RLS policy mismatch or owner_id doesn't match auth.uid()"
  }
  if (!profile) return "⚠️ Business found but no profiles row. Profile trigger is missing. Dashboard should still work."
  if (profileError) return `⚠️ Profile query error: ${profileError.message}`
  return "✅ Everything looks correct — business and profile both exist and are readable by the auth client."
}
