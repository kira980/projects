import { ArrowUpRight, CalendarDays } from 'lucide-react'
import { TenantButton } from '@/components/theme/TenantButton'
import { TenantAuthControls } from './TenantAuthControls'
import type { BrandConfig, LayoutConfig } from '@/types/builder'

interface Props {
  name: string
  logoUrl: string | null
  brand: BrandConfig
  layout: LayoutConfig
  language?: 'en' | 'ar'
  hasServices?: boolean
  hasStaff?: boolean
  customerName?: string | null
  authUrl?: string
}

export function TenantSiteHeader({ name, logoUrl, brand, layout, language = 'en', hasServices = true, hasStaff = true, customerName, authUrl }: Props) {
  const arabic = language === 'ar'
  const visible = (type: string) => layout.sections.some(section => section.type === type && section.visible)
  return (
    <header className="tenant-site-header">
      <div className="tenant-site-nav">
        <a href="#top" className="tenant-site-name" aria-label={name}>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-10 max-w-32 object-contain" />
          ) : <span className="tenant-monogram">{name.trim().slice(0, 1).toUpperCase()}</span>}
          <span>{name}</span>
        </a>
        <nav aria-label={arabic ? 'التنقل' : 'Website navigation'} className="tenant-site-links">
          {hasServices && visible('services') && <a href="#services">{arabic ? 'الخدمات' : 'Services'}</a>}
          {hasStaff && visible('staff') && <a href="#team">{arabic ? 'الفريق' : 'Our team'}</a>}
          {visible('contact') && <a href="#contact">{arabic ? 'تواصل معنا' : 'Visit us'}</a>}
        </nav>
        <TenantAuthControls customerName={customerName} authUrl={authUrl} language={language} />
        <TenantButton href="#booking" buttonStyle={brand.buttonStyle} size="sm">
          <CalendarDays className="h-4 w-4 shrink-0" />{arabic ? 'احجز موعداً' : 'Book a visit'}
        </TenantButton>
      </div>
    </header>
  )
}

export function TenantSiteFooter({ name, language = 'en' }: Pick<Props, 'name' | 'language'>) {
  return (
    <footer className="tenant-site-footer">
      <span>{name}</span>
      <a href="/" target="_blank" rel="noopener noreferrer">{language === 'ar' ? 'الحجز عبر Booklyt' : 'Booking with Booklyt'}<ArrowUpRight className="h-3 w-3" /></a>
    </footer>
  )
}
