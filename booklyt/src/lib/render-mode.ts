import type { PublishedConfig, MetaConfig, BrandingConfig } from '@/types/builder'

export type RenderMode = 'website' | 'native'

export function getRenderMode(mode?: string): RenderMode {
  return mode === 'app' ? 'native' : 'website'
}

export function getPublishedMeta(publishedConfig: PublishedConfig | null): MetaConfig | undefined {
  return publishedConfig?.meta
}

export function getBrandingFromConfig(
  publishedConfig: PublishedConfig | null,
  business: { name: string; app_name?: string | null; logo_url?: string | null; app_icon_url?: string | null }
): { appName: string; logoUrl: string | null; appIconUrl: string | null; slogan?: string } {
  const branding: BrandingConfig | undefined = publishedConfig?.meta?.branding
  const appConfig = publishedConfig?.meta?.app
  return {
    appName:
      branding?.businessName?.trim() ||
      appConfig?.appDisplayName?.trim() ||
      business.app_name?.trim() ||
      business.name,
    logoUrl: branding?.logoUrl || business.logo_url || null,
    appIconUrl: branding?.appIconUrl || business.app_icon_url || business.logo_url || null,
    slogan: branding?.slogan,
  }
}
