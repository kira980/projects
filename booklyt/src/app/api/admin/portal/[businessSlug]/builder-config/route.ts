import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { getAdminVerifiedBusiness } from "@/lib/admin-business"
import { getDefaultConfig, publishConfig, saveDraft } from "@/lib/supabase/tenant-config"

import { getBuilderWebsiteData } from '@/lib/builder/website-data'

export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{ businessSlug: string }>
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { businessSlug } = await context.params
  const { business, supabase } = await getAdminVerifiedBusiness(businessSlug)

  if (!business) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data, error } = await supabase
    .from("tenant_experience_configs")
    .select("*")
    .eq("business_id", business.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  try {
    if (error) throw error
    const previewData = await getBuilderWebsiteData(supabase, business.id)
    return NextResponse.json({ ...(data ?? getDefaultConfig(business.id)), business_language: business.language, preview_data: previewData }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Could not load your website data. Please try again.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { businessSlug } = await context.params
  const { business } = await getAdminVerifiedBusiness(businessSlug)

  if (!business) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { action, brand, layout, content, meta } = body

  try {
    if (action === "save_draft") {
      await saveDraft(business.id, {
        brand,
        layout,
        content,
        meta,
        savedAt: new Date().toISOString(),
      })
      return NextResponse.json({ success: true, message: "Draft saved" })
    }

    if (action === "publish") {
      const published = await publishConfig(business.id)
      revalidatePath(`/book/${business.slug}`)
      return NextResponse.json({ success: true, message: "Published", published })
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (err) {
    // Never String(err) here: Supabase errors are plain objects, not Error
    // instances, and stringify to "[object Object]".
    const message =
      err instanceof Error ? err.message
        : typeof err === 'string' ? err
          : JSON.stringify(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
