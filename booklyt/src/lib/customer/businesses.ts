/**
 * Server helpers for the customer's saved businesses.
 * Always scoped by customer_user_id; service-role only (tables have no RLS policies).
 */
import { createServiceClient } from '@/lib/supabase/service'

export interface SavedBusiness {
  businessId: string
  slug: string
  name: string
  logoUrl: string | null
  businessCode: string | null
  category: string | null
  address: string | null
  phone: string | null
  firstVisitedAt: string
  lastVisitedAt: string
  visitCount: number
  favorite: boolean
  notificationsEnabled: boolean
}

/** Upsert a customer↔business relationship and bump visit counters. */
export async function recordBusinessVisit(customerUserId: string, businessId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any
  const now = new Date().toISOString()

  const { data: existing } = await db
    .from('customer_businesses')
    .select('id, visit_count')
    .eq('customer_user_id', customerUserId)
    .eq('business_id', businessId)
    .maybeSingle()

  if (existing) {
    await db
      .from('customer_businesses')
      .update({ last_visited_at: now, visit_count: existing.visit_count + 1 })
      .eq('id', existing.id)
  } else {
    const { error } = await db.from('customer_businesses').insert({
      customer_user_id: customerUserId,
      business_id: businessId,
    })
    // Unique-violation race is fine — the row exists either way
    if (error && error.code !== '23505') {
      console.error('[customer/businesses] visit insert failed:', error)
    }
  }
}

export async function getSavedBusinesses(customerUserId: string): Promise<SavedBusiness[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any

  const { data } = await db
    .from('customer_businesses')
    .select('business_id, first_visited_at, last_visited_at, visit_count, favorite, notifications_enabled, businesses(id, slug, name, app_name, logo_url, business_code, category, address, phone, active)')
    .eq('customer_user_id', customerUserId)
    .order('last_visited_at', { ascending: false })
    .limit(100)

  return (data ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((row: any) => row.businesses && row.businesses.active !== false)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((row: any): SavedBusiness => ({
      businessId: row.business_id,
      slug: row.businesses.slug,
      name: row.businesses.app_name?.trim() || row.businesses.name,
      logoUrl: row.businesses.logo_url,
      businessCode: row.businesses.business_code,
      category: row.businesses.category,
      address: row.businesses.address,
      phone: row.businesses.phone,
      firstVisitedAt: row.first_visited_at,
      lastVisitedAt: row.last_visited_at,
      visitCount: row.visit_count,
      favorite: row.favorite,
      notificationsEnabled: row.notifications_enabled,
    }))
}
