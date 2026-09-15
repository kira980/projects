import { TenantThemeProvider } from '@/components/theme/TenantThemeProvider'
import { SectionRenderer } from '@/components/sections/SectionRenderer'
import { TenantSiteHeader, TenantSiteFooter } from './TenantSiteHeader'
import { getWebsiteStyle, normalizeLayoutSections } from '@/lib/builder/website-style'
import { getBrandingFromConfig } from '@/lib/render-mode'
import type { ComponentProps } from 'react'
import type { PublishedConfig } from '@/types/builder'
import './tenant-website.css'

type Props = Omit<ComponentProps<typeof SectionRenderer>, 'brand' | 'layout' | 'content' | 'bookingUrl'> & {
  config: Omit<PublishedConfig, 'publishedAt'>
  isNative?: boolean
}

// Used by the public website AND both builder viewports. Preview only disables
// booking side effects; the content, brand resolution and page markup stay shared.
export function TenantWebsite({ config: rawConfig, business, isNative = false, ...props }: Props) {
  // Sites published before the Offers → About change carry legacy sections.
  const config = { ...rawConfig, layout: normalizeLayoutSections(rawConfig.layout) }
  const branding = getBrandingFromConfig({ ...config, publishedAt: '' }, business)
  const displayBusiness = {
    ...business,
    name: config.meta?.branding?.businessName?.trim() || business.name,
    language: config.meta?.language ?? business.language,
    logo_url: branding.logoUrl,
    app_icon_url: branding.appIconUrl,
  }
  return (
    <TenantThemeProvider brand={config.brand}>
      <div id="top" className="tenant-website" data-style={getWebsiteStyle(config.layout)} data-spacing={config.layout.spacingStyle} dir={displayBusiness.language === 'ar' ? 'rtl' : 'ltr'} lang={displayBusiness.language}>
        {!isNative && <TenantSiteHeader name={displayBusiness.name} logoUrl={branding.logoUrl} brand={config.brand} layout={config.layout} language={displayBusiness.language} hasServices={props.services.length > 0} hasStaff={props.staff.length > 0} customerName={props.currentCustomerUser?.full_name ?? props.currentCustomerUser?.phone ?? null} authUrl={props.authUrl} />}
        <main>
          <SectionRenderer {...props} brand={config.brand} layout={config.layout} content={config.content} business={displayBusiness} bookingUrl="#booking" />
        </main>
        {!isNative && <TenantSiteFooter name={displayBusiness.name} language={displayBusiness.language} />}
      </div>
    </TenantThemeProvider>
  )
}
