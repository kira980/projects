'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Star } from 'lucide-react'
import { InlineEditable } from '@/components/builder/InlineEditable'
import type { BrandConfig, ContentConfig, SectionVariant, TestimonialItem } from '@/types/builder'

const PLACEHOLDER_TESTIMONIALS = [
  { name: 'Alex M.', text: 'Booked in 30 seconds. Incredible experience.', rating: 5 },
  { name: 'Sarah L.', text: 'The whole process was seamless. I love being able to book online.', rating: 5 },
  { name: 'James K.', text: 'Professional service from start to finish.', rating: 5 },
]

const PLACEHOLDER_TESTIMONIALS_AR = [
  { name: 'أحمد م.', text: 'حجزت في ثلاثين ثانية. تجربة رائعة.', rating: 5 },
  { name: 'سارة ل.', text: 'كل الخطوات كانت سهلة. أحب إمكانية الحجز عبر الإنترنت.', rating: 5 },
  { name: 'جميل ك.', text: 'خدمة احترافية من البداية إلى النهاية.', rating: 5 },
]

interface Props {
  brand: BrandConfig
  content?: ContentConfig
  variant?: SectionVariant
  forceMobileLayout?: boolean
  language?: 'en' | 'ar'
  onContentChange?: (updates: Partial<ContentConfig>) => void
}

export function TestimonialsSection({ brand, content, variant = 'default', forceMobileLayout, language = 'en', onContentChange }: Props) {
  const arabic = language === 'ar'
  const placeholders = arabic ? PLACEHOLDER_TESTIMONIALS_AR : PLACEHOLDER_TESTIMONIALS
  const testimonials = content?.testimonials?.length ? content.testimonials : onContentChange ? placeholders : []
  const [active, setActive] = useState(0)

  if (!testimonials.length) return null
  const currentIndex = Math.min(active, testimonials.length - 1)

  const move = (direction: -1 | 1) => {
    setActive(current => (current + direction + testimonials.length) % testimonials.length)
  }

  const updateTestimonial = (index: number, updates: Partial<TestimonialItem>) => {
    if (!onContentChange) return
    const next = [...testimonials]
    next[index] = { ...next[index], ...updates }
    onContentChange({ testimonials: next })
  }

  const renderReview = (t: TestimonialItem, i: number) => (
    <motion.div
      key={`${t.name}-${i}`}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: i * 0.1 }}
      className="p-6 rounded-[var(--tenant-card-radius)] min-h-[250px]"
      style={{
        background: 'var(--tenant-surface)',
        border: '1px solid',
        borderColor:
          brand.cardStyle === 'bordered' ? 'rgba(128,128,128,0.15)' : 'transparent',
      }}
    >
      <div className="flex gap-0.5 mb-4">
        {[...Array(Math.max(0, Math.min(5, Math.round(t.rating) || 0)))].map((_, j) => (
          <Star
            key={j}
            className="w-4 h-4 fill-current"
            style={{ color: 'var(--tenant-primary)' }}
          />
        ))}
      </div>
      <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--tenant-muted)' }}>
        &ldquo;<InlineEditable
          value={t.text}
          multiline
          onChange={onContentChange ? value => updateTestimonial(i, { text: value }) : undefined}
        />&rdquo;
      </p>
      <p className="text-sm font-semibold" style={{ color: 'var(--tenant-text)' }}>
        <InlineEditable
          value={t.name}
          onChange={onContentChange ? value => updateTestimonial(i, { name: value }) : undefined}
        />
      </p>
    </motion.div>
  )

  return (
    <section
      className={forceMobileLayout ? 'py-16 px-3' : 'py-20 px-4 sm:py-24 sm:px-6'}
      style={{
        background: variant === 'bold' ? 'var(--tenant-surface)' : 'var(--tenant-background)',
      }}
    >
      <div className="max-w-6xl mx-auto">
        {onContentChange && !content?.testimonials?.length && <p className="text-sm text-center mb-6" style={{ color: 'var(--tenant-muted)' }}>{arabic ? 'تقييمات نموذجية — استبدلها بتقييمات عملائك قبل النشر.' : 'Example reviews — replace with real customer feedback before publishing.'}</p>}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-3xl text-center"
        >
          <p
            className="text-xs font-bold uppercase tracking-[0.2em] mb-4"
            style={{ color: 'var(--tenant-primary)' }}
          >
            <InlineEditable
              value={content?.testimonialEyebrow ?? (arabic ? 'التقييمات' : 'Reviews')}
              onChange={onContentChange ? value => onContentChange({ testimonialEyebrow: value }) : undefined}
            />
          </p>
          <h2
            className={`${forceMobileLayout ? 'text-3xl mb-8' : 'text-3xl sm:text-4xl mb-10 sm:mb-12'} font-bold tracking-tight`}
            style={{ color: 'var(--tenant-text)', fontFamily: `'${brand.font}', serif` }}
          >
            <InlineEditable
              value={content?.testimonialHeading ?? (arabic ? 'ماذا يقول عملاؤنا' : 'What our clients say')}
              onChange={onContentChange ? value => onContentChange({ testimonialHeading: value }) : undefined}
            />
          </h2>
        </motion.div>
        <div className={forceMobileLayout ? 'block' : 'block md:hidden'}>
          <div className="relative">
            {renderReview(testimonials[currentIndex], currentIndex)}
            <button
              type="button"
              aria-label={arabic ? 'التقييم السابق' : 'Previous review'}
              onClick={() => move(-1)}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full border bg-white/90 flex items-center justify-center shadow-sm"
              style={{ color: 'var(--tenant-primary)', borderColor: 'var(--tenant-primary)' }}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              aria-label={arabic ? 'التقييم التالي' : 'Next review'}
              onClick={() => move(1)}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full border bg-white/90 flex items-center justify-center shadow-sm"
              style={{ color: 'var(--tenant-primary)', borderColor: 'var(--tenant-primary)' }}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="flex justify-center gap-1.5 mt-4">
            {testimonials.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={arabic ? `عرض التقييم ${i + 1}` : `Show review ${i + 1}`}
                aria-pressed={currentIndex === i}
                onClick={() => setActive(i)}
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: active === i ? 18 : 6,
                  background: active === i ? 'var(--tenant-primary)' : 'rgba(128,128,128,0.25)',
                }}
              />
            ))}
          </div>
        </div>
        {!forceMobileLayout && (
          <div className="hidden md:grid md:grid-cols-3 gap-6">
            {testimonials.map(renderReview)}
          </div>
        )}
      </div>
    </section>
  )
}
