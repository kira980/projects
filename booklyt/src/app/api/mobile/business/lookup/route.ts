import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Accept, Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

/**
 * GET /api/mobile/business/lookup?q=salon&slug=my-salon
 *
 * Returns active, bookable businesses for the mobile app discovery layer.
 * Merges data from `businesses` + `tenant_experience_configs` (meta_json, brand).
 *
 * Query params:
 *   q    – fuzzy name/description search (min 2 chars)
 *   slug – exact slug lookup (returns one result or empty array)
 *
 * Only returns businesses that exist. "Published" status is reported but
 * does not gate the result — an unpublished business is still bookable.
 */

interface MobileBusinessCard {
  id: string
  slug: string
  businessName: string
  slogan: string | null
  logoUrl: string | null
  appIconUrl: string | null
  primaryColor: string
  language: 'en' | 'ar'
  businessType: string | null
  bookingMode: 'appointment' | 'group'
  address: string | null
  phone: string | null
  isPublished: boolean
  bookingUrl: string
  websiteUrl: string
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const q = searchParams.get('q')?.trim() ?? ''
  const slug = searchParams.get('slug')?.trim().toLowerCase() ?? ''

  if (!q && !slug) {
    return NextResponse.json({ results: [] }, { headers: CORS })
  }
  if (q && q.length < 2) {
    return NextResponse.json({ results: [] }, { headers: CORS })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any

  // ── Fetch matching businesses ─────────────────────────────────────────────

  let query = db
    .from('businesses')
    .select('id, slug, name, category, phone, address, logo_url, app_icon_url, app_name, language, booking_mode, description')
    .order('name')
    .limit(20)

  if (slug) {
    query = query.eq('slug', slug)
  } else {
    query = query.or(`name.ilike.%${q}%,slug.ilike.%${q}%,description.ilike.%${q}%`)
  }

  const { data: businesses, error } = await query as {
    data: Array<{
      id: string; slug: string; name: string; category: string
      phone: string | null; address: string | null
      logo_url: string | null; app_icon_url: string | null; app_name: string | null
      language: 'en' | 'ar'; booking_mode: 'appointment' | 'group'
      description: string | null
    }> | null
    error: { message: string } | null
  }

  if (error || !businesses?.length) {
    return NextResponse.json({ results: [] }, { headers: CORS })
  }

  const businessIds = businesses.map((b) => b.id)

  // ── Fetch published configs in bulk ───────────────────────────────────────

  const { data: configs } = await db
    .from('tenant_experience_configs')
    .select('business_id, meta_json, published_config_json, is_published')
    .in('business_id', businessIds) as {
      data: Array<{
        business_id: string
        meta_json: Record<string, unknown> | null
        published_config_json: Record<string, unknown> | null
        is_published: boolean
      }> | null
    }

  const configMap = new Map(
    (configs ?? []).map((c) => [c.business_id, c])
  )

  // ── Merge and return ──────────────────────────────────────────────────────

  const BASE = process.env.NEXT_PUBLIC_APP_URL ?? ''

  const results: MobileBusinessCard[] = businesses.map((biz) => {
    const cfg = configMap.get(biz.id)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meta = cfg?.meta_json as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const brand = (cfg?.published_config_json as any)?.brand

    const logoUrl = meta?.branding?.logoUrl || biz.logo_url || null
    const appIconUrl = meta?.branding?.appIconUrl || biz.app_icon_url || logoUrl
    const primaryColor = brand?.primaryColor ?? '#7c3aed'
    const slogan = meta?.branding?.slogan ?? null
    const businessType = meta?.businessType ?? biz.category ?? null

    return {
      id: biz.id,
      slug: biz.slug,
      businessName: meta?.branding?.businessName?.trim() || biz.app_name?.trim() || biz.name,
      slogan,
      logoUrl,
      appIconUrl,
      primaryColor,
      language: (meta?.language ?? biz.language ?? 'en') as 'en' | 'ar',
      businessType,
      bookingMode: biz.booking_mode,
      address: biz.address,
      phone: biz.phone,
      isPublished: cfg?.is_published ?? false,
      bookingUrl: `${BASE}/app/${biz.slug}`,
      websiteUrl: `${BASE}/book/${biz.slug}`,
    }
  })

  return NextResponse.json({ results }, { headers: CORS })
}
