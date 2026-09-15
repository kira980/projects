'use client'

import { motion } from 'framer-motion'
import { Users } from 'lucide-react'
import { InlineEditable } from '@/components/builder/InlineEditable'
import type { BrandConfig, ContentConfig, SectionVariant } from '@/types/builder'
import type { StaffMember } from '@/types/database'

interface Props {
  brand: BrandConfig
  staff: StaffMember[]
  content?: ContentConfig
  variant?: SectionVariant
  language?: 'en' | 'ar'
  onContentChange?: (updates: Partial<ContentConfig>) => void
}

export function StaffSection({ brand, staff, content, variant = 'default', language = 'en', onContentChange }: Props) {
  const arabic = language === 'ar'
  if (!staff.length) return null

  return (
    <section
      id="team"
      className="py-24 px-6"
      style={{
        background:
          variant === 'bold' || variant === 'minimal'
            ? 'var(--tenant-surface)'
            : 'var(--tenant-background)',
      }}
    >
      <div className="max-w-6xl mx-auto">
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
              value={content?.staffEyebrow ?? (arabic ? 'فريقنا' : 'Our Team')}
              onChange={onContentChange ? value => onContentChange({ staffEyebrow: value }) : undefined}
            />
          </p>
          <h2
            className="text-3xl sm:text-4xl font-bold tracking-tight mb-12"
            style={{ color: 'var(--tenant-text)', fontFamily: `'${brand.font}', serif` }}
          >
            <InlineEditable
              value={content?.staffHeading ?? (arabic ? 'تعرّف على الفريق' : 'Meet the team')}
              onChange={onContentChange ? value => onContentChange({ staffHeading: value }) : undefined}
            />
          </h2>
        </motion.div>

        <div
          className={`grid gap-6 ${
            variant === 'centered'
              ? 'justify-center grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
              : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
          }`}
        >
          {staff.map((member, i) => (
            <motion.div
              key={member.id}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.07 }}
              className="text-center"
            >
              <div
                className="w-full aspect-square rounded-[var(--tenant-card-radius)] mb-4 overflow-hidden flex items-center justify-center"
                style={{ background: 'var(--tenant-accent)' }}
              >
                {member.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={member.avatar_url}
                    alt={member.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Users className="w-10 h-10" style={{ color: 'var(--tenant-primary)' }} />
                )}
              </div>
              <p className="font-semibold" style={{ color: 'var(--tenant-text)' }}>
                {member.name}
              </p>
              {member.role && (
                <p className="text-sm mt-0.5" style={{ color: 'var(--tenant-muted)' }}>
                  {member.role}
                </p>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
