import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import type { TenantExperienceConfig, PublishedConfig, DraftConfig, MetaConfig, ContentConfig } from '@/types/builder'
import { DEFAULT_TEMPLATE } from '@/lib/builder/templates'

const TABLE = 'tenant_experience_configs' as const

// Reads use the anon-key server client and respect RLS.
// Writes use the service-role client to avoid auth-forwarding issues in Route Handlers.

export async function getTenantConfig(businessId: string): Promise<TenantExperienceConfig | null> {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from(TABLE)
    .select('*')
    .eq('business_id', businessId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error('Could not load the saved website configuration.')
  return (data as TenantExperienceConfig | null) ?? null
}

export async function getPublishedConfig(businessId: string): Promise<PublishedConfig | null> {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from(TABLE)
    .select('published_config_json')
    .eq('business_id', businessId)
    .eq('is_published', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (data?.published_config_json as PublishedConfig) ?? null
}

// `blob:` URLs are object URLs that exist only inside the tab that created them,
// and `data:` URLs would bloat the row. Both appear in the builder when an image
// upload fails after the optimistic local preview is set. Persisting either one
// makes the editor preview look correct while the live site renders a broken
// image — so strip them at the write boundary as a last line of defence.
function isEphemeralUrl(value: unknown): boolean {
  return typeof value === 'string' && /^(blob:|data:)/i.test(value.trim())
}

function stripEphemeralUrls(draft: DraftConfig): DraftConfig {
  const content: ContentConfig = { ...(draft.content ?? {}) }

  if (isEphemeralUrl(content.heroImage)) delete content.heroImage
  if (Array.isArray(content.galleryImages)) {
    content.galleryImages = content.galleryImages.filter(url => !isEphemeralUrl(url))
  }

  const meta: MetaConfig = { ...(draft.meta ?? {}) }
  if (meta.branding) {
    const branding = { ...meta.branding }
    if (isEphemeralUrl(branding.logoUrl)) delete branding.logoUrl
    if (isEphemeralUrl(branding.appIconUrl)) delete branding.appIconUrl
    meta.branding = branding
  }
  if (meta.app && isEphemeralUrl(meta.app.splashBackground)) {
    meta.app = { ...meta.app, splashBackground: undefined }
  }

  const brand = isEphemeralUrl(draft.brand?.logo)
    ? { ...draft.brand, logo: undefined }
    : draft.brand

  return { ...draft, brand, content, meta }
}

export async function saveDraft(businessId: string, rawDraft: DraftConfig) {
  const draft = stripEphemeralUrls(rawDraft)
  const service = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (service as any)
    .from(TABLE)
    .upsert(
      {
        business_id: businessId,
        brand_json: draft.brand,
        layout_json: draft.layout,
        content_json: draft.content,
        meta_json: draft.meta ?? {},
        draft_config_json: { ...draft, savedAt: new Date().toISOString() },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'business_id' }
    )

  if (error) throw new Error(`Save draft failed: ${error.message} (${error.code})`)
}

export async function publishConfig(businessId: string) {
  const service = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: current, error: readError } = await (service as any)
    .from(TABLE)
    .select('brand_json, layout_json, content_json, meta_json')
    .eq('business_id', businessId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (readError) throw new Error(`Read failed: ${readError.message}`)
  if (!current) throw new Error('No saved config found - click "Save draft" first')

  const published: PublishedConfig = {
    brand: current.brand_json,
    layout: current.layout_json,
    content: current.content_json,
    meta: (current.meta_json && Object.keys(current.meta_json).length > 0)
      ? current.meta_json as MetaConfig
      : undefined,
    publishedAt: new Date().toISOString(),
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (service as any)
    .from(TABLE)
    .upsert(
      {
        business_id: businessId,
        published_config_json: published,
        is_published: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'business_id' }
    )

  if (error) throw new Error(`Publish failed: ${error.message} (${error.code})`)
  return published
}

export function getDefaultConfig(businessId: string): TenantExperienceConfig {
  return {
    business_id: businessId,
    brand_json: DEFAULT_TEMPLATE.brand,
    layout_json: DEFAULT_TEMPLATE.layout,
    content_json: DEFAULT_TEMPLATE.content as TenantExperienceConfig['content_json'],
    meta_json: {},
    is_published: false,
  }
}
