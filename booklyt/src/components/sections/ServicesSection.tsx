'use client'

import { Clock, ArrowRight } from 'lucide-react'
import { InlineEditable } from '@/components/builder/InlineEditable'
import { formatCurrency, formatDuration } from '@/lib/utils'
import type { BrandConfig, ContentConfig, SectionVariant, WebsiteStyle } from '@/types/builder'
import type { Service, ServiceCategory } from '@/types/database'

interface Props {
  brand: BrandConfig
  services: Service[]
  categories?: ServiceCategory[]
  content?: ContentConfig
  variant?: SectionVariant
  websiteStyle?: WebsiteStyle
  bookingUrl?: string
  currency?: string
  language?: 'en' | 'ar'
  forceMobileLayout?: boolean
  onContentChange?: (updates: Partial<ContentConfig>) => void
}

export function ServicesSection({ brand, services, categories = [], content, variant = 'default', websiteStyle = 'practice', bookingUrl, currency = 'USD', language = 'en', onContentChange }: Props) {
  if (!services.length) return null
  const arabic = language === 'ar'

  // Categories in the owner's order, then anything uncategorised. A business
  // with no categories renders exactly as before: one unlabelled collection.
  const groups = [
    ...categories.map(category => ({
      id: category.id,
      name: category.name,
      services: services.filter(service => service.category_id === category.id),
    })),
    {
      id: 'uncategorised',
      name: arabic ? 'خدمات أخرى' : 'More services',
      services: services.filter(service => !service.category_id || !categories.some(c => c.id === service.category_id)),
    },
  ].filter(group => group.services.length > 0)
  const showGroupNames = groups.length > 1

  return (
    <section id="services" className="site-services" data-layout={websiteStyle} data-variant={variant}>
      <div className="site-section-inner">
        <div className="tenant-section-heading">
          <div>
            <p className="tenant-eyebrow"><InlineEditable value={content?.servicesEyebrow ?? (arabic ? 'الخدمات والأسعار' : 'The service collection')} onChange={onContentChange ? value => onContentChange({ servicesEyebrow: value }) : undefined} /></p>
            <h2 style={{ fontFamily: `'${brand.font}', serif` }}><InlineEditable value={content?.servicesHeading ?? (arabic ? 'اختر ما يناسبك' : 'Find your kind of care.')} onChange={onContentChange ? value => onContentChange({ servicesHeading: value }) : undefined} /></h2>
          </div>
          {bookingUrl && <a className="tenant-text-link" href={bookingUrl}>{arabic ? 'عرض المواعيد' : 'Make an appointment'}<ArrowRight size={15} /></a>}
        </div>
        {groups.map(group => (
          <div key={group.id} className="site-service-group">
            {showGroupNames && (
              <div className="site-service-group-heading">
                <h3>{group.name}</h3>
                <span aria-hidden="true" />
              </div>
            )}
            <div className="site-service-collection">
              {group.services.map((service, index) => (
                <article key={service.id} className={`site-service site-service-${brand.cardStyle} ${service.image_url ? 'has-image' : ''}`}>
                  {service.image_url && <div className="site-service-photo">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={service.image_url} alt={service.name} loading="lazy" />
                  </div>}
                  <div className="site-service-content">
                    <span className="site-service-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                    <div className="site-service-description">
                      <h3>{service.name}</h3>
                      {service.description && <p>{service.description}</p>}
                      <small><Clock size={13} />{arabic ? `${service.duration_minutes} دقيقة` : formatDuration(service.duration_minutes)}</small>
                    </div>
                    <span className="site-service-price" dir="auto">{formatCurrency(service.price, currency)}</span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
