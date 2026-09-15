'use client'

import { InlineEditable } from '@/components/builder/InlineEditable'
import type { BrandConfig, ContentConfig, SectionVariant } from '@/types/builder'

interface Props {
  brand: BrandConfig
  content?: ContentConfig
  variant?: SectionVariant
  language?: 'en' | 'ar'
  forceMobileLayout?: boolean
  onContentChange?: (updates: Partial<ContentConfig>) => void
}

const PLACEHOLDER = {
  en: 'Tell customers who you are. What you do, what makes your place worth the trip, and who they will meet when they walk in.',
  ar: 'عرّف عملاءك بنفسك: ماذا تقدّم، وما الذي يميّز مكانك، ومن سيقابلون عند وصولهم.',
}

export function AboutSection({ brand, content, variant = 'default', language = 'en', forceMobileLayout, onContentChange }: Props) {
  const arabic = language === 'ar'
  const text = content?.aboutText ?? (onContentChange ? PLACEHOLDER[arabic ? 'ar' : 'en'] : '')
  const image = content?.aboutImage

  // Published sites hide an empty About rather than showing an empty slab.
  if (!text.trim() && !image) return null

  return (
    <section id="about" className="site-about" data-variant={variant} data-has-photo={image ? 'true' : 'false'}>
      <div className="site-section-inner site-about-inner">
        {image && (
          <figure className="site-about-media">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="" loading="lazy" />
          </figure>
        )}
        <div className="site-about-copy">
          <p className="tenant-eyebrow">
            <InlineEditable
              value={content?.aboutEyebrow ?? (arabic ? 'من نحن' : 'About us')}
              onChange={onContentChange ? value => onContentChange({ aboutEyebrow: value }) : undefined}
            />
          </p>
          <h2 style={{ fontFamily: `'${brand.font}', serif` }}>
            <InlineEditable
              value={content?.aboutTitle ?? (arabic ? 'قصتنا' : 'Our story')}
              onChange={onContentChange ? value => onContentChange({ aboutTitle: value }) : undefined}
            />
          </h2>
          <div className={`site-about-text ${forceMobileLayout ? 'is-narrow' : ''}`}>
            <InlineEditable
              value={text}
              multiline
              onChange={onContentChange ? value => onContentChange({ aboutText: value }) : undefined}
            />
          </div>
        </div>
      </div>
    </section>
  )
}
