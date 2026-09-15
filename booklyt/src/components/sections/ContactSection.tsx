'use client'

import { MapPin, Phone, Instagram, Navigation2, ArrowUpRight } from 'lucide-react'
import { InlineEditable } from '@/components/builder/InlineEditable'
import type { BrandConfig, ContentConfig, ContactLink, SectionVariant } from '@/types/builder'
import type { Business, WorkingHours } from '@/types/database'

interface Props {
  brand: BrandConfig
  business: Pick<Business, 'address' | 'phone' | 'name'> & Partial<Pick<Business, 'language' | 'time_format'>>
  content?: { contactEyebrow?: string; contactText?: string; contactLinks?: ContactLink[] }
  variant?: SectionVariant
  forceMobileLayout?: boolean
  workingHours?: WorkingHours[]
  onContentChange?: (updates: Partial<ContentConfig>) => void
}

export function ContactSection({ brand, business, content, forceMobileLayout, workingHours = [], onContentChange }: Props) {
  const arabic = business.language === 'ar'
  const today = new Date().getDay()
  const days = arabic ? ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'] : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const formatTime = (value: string | null) => {
    if (!value) return '—'
    const [hour, minute] = value.split(':').map(Number)
    if (business.time_format === '24h') return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
    return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour < 12 ? (arabic ? 'ص' : 'am') : (arabic ? 'م' : 'pm')}`
  }
  return (
    <section className="px-5 py-14 sm:px-6 sm:py-20" style={{ background: 'var(--tenant-surface)' }}>
      <div className={`max-w-6xl mx-auto grid gap-10 ${!forceMobileLayout && workingHours.length ? 'md:grid-cols-2 md:gap-20' : ''}`}>
        <div>
          <p className="tenant-eyebrow"><InlineEditable value={content?.contactEyebrow ?? (arabic ? 'تواصل معنا' : 'Plan your visit')} onChange={onContentChange ? value => onContentChange({ contactEyebrow: value }) : undefined} /></p>
          <h2 className="text-3xl sm:text-4xl mb-8" style={{ fontFamily: `'${brand.font}', serif` }}><InlineEditable value={content?.contactText ?? (arabic ? 'نتطلع لزيارتك' : 'We look forward to seeing you')} onChange={onContentChange ? value => onContentChange({ contactText: value }) : undefined} /></h2>
          <div className="space-y-6">
            {business.address && <a className="tenant-contact-link" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.address)}`} target="_blank" rel="noopener noreferrer"><MapPin className="h-5 w-5 shrink-0" /><span><strong>{business.address}</strong><small>{arabic ? 'عرض الاتجاهات' : 'Get directions'}<ArrowUpRight className="h-3 w-3" /></small></span></a>}
            {business.phone && <a href={`tel:${business.phone.replace(/[^+\d]/g, '')}`} className="tenant-contact-link"><Phone className="h-5 w-5 shrink-0" /><span><strong dir="ltr">{business.phone}</strong><small>{arabic ? 'اتصل بنا' : 'Give us a call'}</small></span></a>}
            <div className="flex flex-wrap gap-3">{(content?.contactLinks ?? []).filter(link => link.enabled && link.value).map(link => {
              const href = link.type === 'phone' ? `tel:${link.value.replace(/[^+\d]/g, '')}` : link.type === 'instagram' ? (link.value.startsWith('https://') ? link.value : `https://instagram.com/${link.value.replace(/^@/, '')}`) : /^https?:\/\//i.test(link.value) ? link.value : null
              if (!href) return null
              const Icon = link.type === 'instagram' ? Instagram : link.type === 'phone' ? Phone : Navigation2
              return <a key={link.type} href={href} target={link.type === 'phone' ? undefined : '_blank'} rel="noopener noreferrer" className="tenant-text-link"><Icon className="h-4 w-4" />{link.type === 'instagram' ? 'Instagram' : link.type === 'phone' ? (arabic ? 'اتصل بنا' : 'Call us') : 'Waze'}</a>
            })}</div>
          </div>
        </div>
        {workingHours.length > 0 && (
          <div className="tenant-hours">
            <h3>{arabic ? 'ساعات العمل' : 'Opening hours'}</h3>
            <ul className="tenant-hours-list">
              {[...workingHours].sort((a, b) => a.day_of_week - b.day_of_week).map(day => (
                <li key={day.id} className="tenant-hours-row" data-open={day.is_open ? 'true' : 'false'} data-today={day.day_of_week === today ? 'true' : 'false'}>
                  <span className="tenant-hours-dot" aria-hidden="true" />
                  <span className="tenant-hours-day">{days[day.day_of_week]}</span>
                  <span className="tenant-hours-time" dir="auto">
                    {day.is_open
                      ? `${formatTime(day.open_time)} – ${formatTime(day.close_time)}`
                      : (arabic ? 'مغلق' : 'Closed')}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}
