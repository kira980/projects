import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TenantThemeProvider } from '@/components/theme/TenantThemeProvider'
import { TenantSiteFooter } from '@/components/layouts/TenantSiteHeader'
import { getBrandingFromConfig } from '@/lib/render-mode'
import { getWebsiteStyle } from '@/lib/builder/website-style'
import { CustomerAuthForm } from './auth-form'
import type { Business } from '@/types/database'
import type { BrandConfig, PublishedConfig } from '@/types/builder'
import '@/components/layouts/tenant-website.css'

export const dynamic = 'force-dynamic'

// Neutral brand used when a business has not published a website yet.
const FALLBACK_BRAND: BrandConfig = {
  primaryColor: '#7c3aed',
  accentColor: '#f5f3ff',
  backgroundColor: '#ffffff',
  surfaceColor: '#f9fafb',
  textColor: '#0f0f14',
  mutedColor: '#6b7280',
  font: 'Inter',
  radius: '12px',
  buttonStyle: 'rounded',
  cardStyle: 'elevated',
}

interface PageProps {
  params: Promise<{ businessSlug: string }>
}

export default async function CustomerAuthPage({ params }: PageProps) {
  const { businessSlug } = await params
  const supabase = await createClient()

  const { data: business } = await supabase
    .from('businesses')
    .select('*')
    .eq('slug', businessSlug)
    .single() as { data: Business | null; error: unknown }

  if (!business || business.active === false) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: configRaw } = await (supabase as any)
    .from('tenant_experience_configs')
    .select('published_config_json')
    .eq('business_id', business.id)
    .eq('is_published', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle() as { data: { published_config_json: unknown } | null }

  const publishedConfig = (configRaw?.published_config_json ?? null) as PublishedConfig | null
  const brand = publishedConfig?.brand ?? FALLBACK_BRAND
  const branding = getBrandingFromConfig(publishedConfig, business)
  const language = (publishedConfig?.meta?.language ?? business.language ?? 'en') as 'en' | 'ar'
  const name = publishedConfig?.meta?.branding?.businessName?.trim() || business.name

  return (
    <TenantThemeProvider brand={brand}>
      <div
        className="tenant-website tenant-auth-page"
        data-style={publishedConfig?.layout ? getWebsiteStyle(publishedConfig.layout) : 'practice'}
        dir={language === 'ar' ? 'rtl' : 'ltr'}
        lang={language}
      >
        <header className="tenant-site-header">
          <div className="tenant-site-nav">
            <a href={`/book/${businessSlug}`} className="tenant-site-name" aria-label={name}>
              {branding.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={branding.logoUrl} alt="" className="h-10 max-w-32 object-contain" />
              ) : <span className="tenant-monogram">{name.trim().slice(0, 1).toUpperCase()}</span>}
              <span>{name}</span>
            </a>
            <a href={`/book/${businessSlug}`} className="tenant-text-link">
              {language === 'ar' ? 'العودة إلى الموقع' : 'Back to website'}
            </a>
          </div>
        </header>
        <main className="tenant-auth-main">
          <Suspense fallback={null}>
            <CustomerAuthForm language={language} />
          </Suspense>
        </main>
        <TenantSiteFooter name={name} language={language} />
      </div>
    </TenantThemeProvider>
  )
}
