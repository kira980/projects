import { createServiceClient } from '@/lib/supabase/service'
import { BUSINESS_CODE_REGEX } from '@/lib/booklyt'

export interface ResolvedBusinessCode {
  id: string
  slug: string
  appEnabled: boolean
}

/**
 * Resolve a 6-digit Booklyt business code to its business.
 * Public read — returns only what a public booking page already exposes.
 */
export async function resolveBusinessCode(code: string): Promise<ResolvedBusinessCode | null> {
  if (!BUSINESS_CODE_REGEX.test(code)) return null

  const db = createServiceClient()
  const { data } = await db
    .from('businesses')
    .select('id, slug, app_enabled, active')
    .eq('business_code', code)
    .maybeSingle()

  if (!data || data.active === false) return null
  return { id: data.id, slug: data.slug, appEnabled: data.app_enabled !== false }
}
