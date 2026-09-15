'use client'

import { ArrowRight, Clock } from 'lucide-react'
import { InlineEditable } from '@/components/builder/InlineEditable'
import { TenantButton } from '@/components/theme/TenantButton'
import type { BrandConfig, ContentConfig, SectionVariant, WebsiteStyle } from '@/types/builder'
import type { Service } from '@/types/database'

interface Props {
  brand: BrandConfig
  content: ContentConfig
  variant?: SectionVariant
  websiteStyle?: WebsiteStyle
  businessName: string
  bookingUrl: string
  services?: Service[]
  language?: 'en' | 'ar'
  forceMobileLayout?: boolean
  onContentChange?: (updates: Partial<ContentConfig>) => void
}

export function HeroSection({ brand, content, variant = 'default', websiteStyle = 'practice', businessName, bookingUrl, services = [], language = 'en', onContentChange }: Props) {
  const arabic = language === 'ar'
  const title = content.heroTitle ?? businessName
  const subtitle = content.heroSubtitle ?? (arabic ? 'اختر خدمتك والوقت المناسب لك.' : 'Explore our services and find a time that works for you.')
  const cta = content.heroCtaText ?? (arabic ? 'احجز موعداً' : 'Book an appointment')
  const image = content.heroImage
  const showText = !image || content.showHeroText !== false
  const style = variant === 'bold' ? 'performance' : websiteStyle
  const titleNode = content.heroTitleHtml && !onContentChange
    ? <span dangerouslySetInnerHTML={{ __html: content.heroTitleHtml }} />
    : <InlineEditable value={title} multiline onChange={onContentChange ? value => onContentChange({ heroTitle: value, heroTitleHtml: undefined }) : undefined} />
  const photo = image && (
    <figure className="site-hero-media">
      <div className="site-cover">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt={businessName} fetchPriority="high" style={{ objectPosition: `${content.heroImagePositionX ?? 50}% ${content.heroImagePositionY ?? 50}%`, transform: `scale(${(content.heroImageZoom ?? 100) / 100})`, transformOrigin: `${content.heroImagePositionX ?? 50}% ${content.heroImagePositionY ?? 50}%` }} />
      </div>
    </figure>
  )
  const appointmentOverview = (
    <aside className="site-hero-overview">
      <p className="site-kicker">{arabic ? 'خطط لزيارتك' : 'Your next appointment'}</p>
      <h2>{arabic ? 'ابدأ بالخدمة المناسبة لك' : 'A little planning. A better day.'}</h2>
      {services.slice(0, 3).map(service => (
        <div className="site-overview-service" key={service.id}>
          <span>{service.name}</span><small><Clock size={12} />{service.duration_minutes} {arabic ? 'دقيقة' : 'min'}</small>
        </div>
      ))}
      {!services.length && <p className="site-overview-note">{arabic ? 'نتطلع لزيارتك' : 'We look forward to welcoming you.'}</p>}
      <a href={bookingUrl} className="tenant-text-link">{arabic ? 'عرض المواعيد' : 'View availability'}<ArrowRight size={15} /></a>
    </aside>
  )

  return (
    <section className={`site-hero ${image ? 'has-photo' : 'no-photo'} ${!showText ? 'photo-only' : ''}`} data-layout={style} data-variant={variant} style={{ '--cover-overlay': (content.heroImageOverlayOpacity ?? 40) / 100, '--site-heading-font': `'${brand.font}', serif` } as React.CSSProperties}>
      {photo}
      <div className="site-hero-inner">
        {showText ? <div className="site-hero-copy">
          <p className="site-kicker"><InlineEditable value={content.heroEyebrow ?? businessName} onChange={onContentChange ? value => onContentChange({ heroEyebrow: value }) : undefined} /></p>
          <h1>{titleNode}</h1>
          <p className="site-hero-description"><InlineEditable value={subtitle} multiline onChange={onContentChange ? value => onContentChange({ heroSubtitle: value }) : undefined} /></p>
          <div className="site-hero-actions"><TenantButton href={bookingUrl} buttonStyle={brand.buttonStyle} size="lg"><InlineEditable value={cta} onChange={onContentChange ? value => onContentChange({ heroCtaText: value }) : undefined} /><ArrowRight size={16} /></TenantButton></div>
        </div> : <h1 className="sr-only">{businessName}</h1>}
        {showText && !image && appointmentOverview}
        {!showText && <div className="site-photo-cta"><TenantButton href={bookingUrl} buttonStyle={brand.buttonStyle}>{cta}<ArrowRight size={16} /></TenantButton></div>}
      </div>
    </section>
  )
}
