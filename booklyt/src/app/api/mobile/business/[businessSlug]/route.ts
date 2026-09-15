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
 * GET /api/mobile/business/[businessSlug]
 *
 * Returns the full mobile profile for a single business.
 * Used by the app before opening the WebView to:
 *   – validate the business exists
 *   – get branding for native loading screen
 *   – build the correct bookingUrl
 */

export interface MobileBusinessProfile {
  id: string
  slug: string
  businessName: string
  slogan: string | null
  logoUrl: string | null
  appIconUrl: string | null
  primaryColor: string
  backgroundColor: string
  textColor: string
  language: 'en' | 'ar'
  businessType: string | null
  bookingMode: 'appointment' | 'group'
  address: string | null
  phone: string | null
  description: string | null
  isPublished: boolean
  mobileNavStyle: string
  bookingUrl: string
  websiteUrl: string
}

type RouteContext = { params: Promise<{ businessSlug: string }> }

export async function GET(_req: NextRequest, context: RouteContext) {
  const { businessSlug } = await context.params

  if (!businessSlug) {
    return NextResponse.json({ error: 'Missing slug' }, { status: 400, headers: CORS })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any

  const { data: biz, error } = await db
    .from('businesses')
    .select('id, slug, name, category, phone, address, logo_url, app_icon_url, app_name, language, booking_mode, description')
    .eq('slug', businessSlug)
    .maybeSingle() as {
      data: {
        id: string; slug: string; name: string; category: string
        phone: string | null; address: string | null
        logo_url: string | null; app_icon_url: string | null; app_name: string | null
        language: 'en' | 'ar'; booking_mode: 'appointment' | 'group'
        description: string | null
      } | null
      error: { message: string } | null
    }

  if (error || !biz) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404, headers: CORS })
  }

  const { data: cfg } = await db
    .from('tenant_experience_configs')
    .select('meta_json, published_config_json, is_published')
    .eq('business_id', biz.id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle() as {
      data: {
        meta_json: Record<string, unknown> | null
        published_config_json: Record<string, unknown> | null
        is_published: boolean
      } | null
    }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const meta = cfg?.meta_json as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const brand = (cfg?.published_config_json as any)?.brand

  const logoUrl = meta?.branding?.logoUrl || biz.logo_url || null
  const appIconUrl = meta?.branding?.appIconUrl || biz.app_icon_url || logoUrl

  const BASE = process.env.NEXT_PUBLIC_APP_URL ?? ''

  const profile: MobileBusinessProfile = {
    id: biz.id,
    slug: biz.slug,
    businessName: meta?.branding?.businessName?.trim() || biz.app_name?.trim() || biz.name,
    slogan: meta?.branding?.slogan ?? null,
    logoUrl,
    appIconUrl,
    primaryColor: brand?.primaryColor ?? '#7c3aed',
    backgroundColor: brand?.backgroundColor ?? '#ffffff',
    textColor: brand?.textColor ?? '#18181b',
    language: (meta?.language ?? biz.language ?? 'en') as 'en' | 'ar',
    businessType: meta?.businessType ?? biz.category ?? null,
    bookingMode: biz.booking_mode,
    address: biz.address,
    phone: biz.phone,
    description: biz.description,
    isPublished: cfg?.is_published ?? false,
    mobileNavStyle: meta?.app?.mobileNavStyle ?? 'bottom-tabs',
    bookingUrl: `${BASE}/app/${biz.slug}`,
    websiteUrl: `${BASE}/book/${biz.slug}`,
  }

  return NextResponse.json({ profile }, { headers: CORS })
}
