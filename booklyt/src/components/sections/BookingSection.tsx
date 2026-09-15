'use client'

import { motion } from 'framer-motion'
import { Calendar, ArrowRight } from 'lucide-react'
import { TenantButton } from '@/components/theme/TenantButton'
import type { BrandConfig, SectionVariant } from '@/types/builder'

interface Props {
  brand: BrandConfig
  bookingUrl: string
  businessName: string
  variant?: SectionVariant
  language?: 'en' | 'ar'
}

export function BookingSection({ brand, bookingUrl, businessName, variant = 'default', language = 'en' }: Props) {
  const arabic = language === 'ar'
  const isCentered = variant === 'centered' || variant === 'default'

  return (
    <section className="py-24 px-6" style={{ background: 'var(--tenant-accent)' }}>
      <div className={`max-w-6xl mx-auto ${isCentered ? 'text-center' : ''}`}>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-8"
            style={{ background: 'var(--tenant-primary)' }}
          >
            <Calendar className="w-7 h-7 text-white" />
          </div>
          <h2
            className="text-3xl sm:text-5xl font-bold tracking-tight mb-4 max-w-2xl mx-auto"
            style={{ color: 'var(--tenant-text)', fontFamily: `'${brand.font}', serif` }}
          >
            {arabic ? 'جاهز للحجز؟' : 'Ready to book?'}
          </h2>
          <p
            className="text-base mb-10 max-w-md mx-auto leading-relaxed"
            style={{ color: 'var(--tenant-muted)' }}
          >
            {arabic
              ? 'اختر خدمتك، حدّد الوقت المناسب، وأكّد حجزك فوراً — دون أي مكالمات.'
              : 'Choose your service, pick a time, and confirm instantly — no phone calls needed.'}
          </p>
          <TenantButton href={bookingUrl} buttonStyle={brand.buttonStyle} size="lg">
            {arabic ? `احجز في ${businessName}` : `Book at ${businessName}`} <ArrowRight className="w-4 h-4" />
          </TenantButton>
        </motion.div>
      </div>
    </section>
  )
}
