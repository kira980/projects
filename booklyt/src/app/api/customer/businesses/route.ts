/**
 * Saved businesses for the authenticated customer ("My Businesses").
 *
 * GET    — list my businesses (?favorite=1 filters to favorites)
 * POST   — record a visit: { slug } or { business_id } → upsert + bump counters
 * PATCH  — update flags:   { business_id, favorite?, notifications_enabled? }
 *
 * All handlers require the bf_user session and scope every query by
 * customer_user_id; tables are service-role-only (RLS with no policies).
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import { getCurrentCustomerUser } from '@/lib/customer-auth'
import { recordBusinessVisit } from '@/lib/customer/businesses'

export const dynamic = 'force-dynamic'

export interface SavedBusiness {
  business_id: string
  slug: string
  name: string
  logo_url: string | null
  business_code: string | null
  category: string | null
  address: string | null
  phone: string | null
  first_visited_at: string
  last_visited_at: string
  visit_count: number
  favorite: boolean
  notifications_enabled: boolean
}

export async function GET(req: NextRequest) {
  const user = await getCurrentCustomerUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any

  let query = db
    .from('customer_businesses')
    .select('business_id, first_visited_at, last_visited_at, visit_count, favorite, notifications_enabled, businesses(id, slug, name, app_name, logo_url, business_code, category, address, phone, active, app_enabled)')
    .eq('customer_user_id', user.id)
    .order('last_visited_at', { ascending: false })
    .limit(100)

  if (req.nextUrl.searchParams.get('favorite') === '1') {
    query = query.eq('favorite', true)
  }

  const { data, error } = await query
  if (error) {
    console.error('[customer/businesses] list failed:', error)
    return NextResponse.json({ error: 'Failed to load businesses' }, { status: 500 })
  }

  const businesses: SavedBusiness[] = (data ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((row: any) => row.businesses && row.businesses.active !== false)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((row: any) => ({
      business_id: row.business_id,
      slug: row.businesses.slug,
      name: row.businesses.app_name?.trim() || row.businesses.name,
      logo_url: row.businesses.logo_url,
      business_code: row.businesses.business_code,
      category: row.businesses.category,
      address: row.businesses.address,
      phone: row.businesses.phone,
      first_visited_at: row.first_visited_at,
      last_visited_at: row.last_visited_at,
      visit_count: row.visit_count,
      favorite: row.favorite,
      notifications_enabled: row.notifications_enabled,
    }))

  return NextResponse.json({ businesses })
}

const visitSchema = z.object({
  business_id: z.string().uuid().optional(),
  slug: z.string().min(1).max(120).optional(),
}).refine((v) => v.business_id || v.slug, { message: 'business_id or slug required' })

export async function POST(req: NextRequest) {
  const user = await getCurrentCustomerUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const parsed = visitSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 422 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any

  let businessId = parsed.data.business_id ?? null
  if (!businessId && parsed.data.slug) {
    const { data: biz } = await db
      .from('businesses')
      .select('id, active')
      .eq('slug', parsed.data.slug)
      .maybeSingle()
    if (!biz || biz.active === false) return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    businessId = biz.id
  }
  if (!businessId) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

  await recordBusinessVisit(user.id, businessId)

  return NextResponse.json({ ok: true })
}

const patchSchema = z.object({
  business_id: z.string().uuid(),
  favorite: z.boolean().optional(),
  notifications_enabled: z.boolean().optional(),
})

export async function PATCH(req: NextRequest) {
  const user = await getCurrentCustomerUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 422 })

  const updates: Record<string, boolean> = {}
  if (parsed.data.favorite !== undefined) updates.favorite = parsed.data.favorite
  if (parsed.data.notifications_enabled !== undefined) updates.notifications_enabled = parsed.data.notifications_enabled
  if (!Object.keys(updates).length) return NextResponse.json({ error: 'Nothing to update' }, { status: 422 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any
  const { data, error } = await db
    .from('customer_businesses')
    .update(updates)
    .eq('customer_user_id', user.id)
    .eq('business_id', parsed.data.business_id)
    .select('id')

  if (error) {
    console.error('[customer/businesses] update failed:', error)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
  if (!data?.length) return NextResponse.json({ error: 'Business not saved yet' }, { status: 404 })

  return NextResponse.json({ ok: true })
}
