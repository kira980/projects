import type { BrandConfig, ContentConfig, LayoutConfig, SectionConfig } from '@/types/builder'
import type { Business, Service, ServiceCategory, StaffMember, StaffService, WorkingHours } from '@/types/database'
import type { TimeSlot } from '@/lib/booking/slots'
import { getWebsiteStyle } from '@/lib/builder/website-style'
import '../layouts/tenant-website.css'
import { InlineEditable } from '@/components/builder/InlineEditable'
import { BookingFlow } from '@/components/booking/booking-flow'
import type { CustomerUser } from '@/lib/customer-auth'
import { HeroSection } from './HeroSection'
import { ServicesSection } from './ServicesSection'
import { StaffSection } from './StaffSection'
import { GallerySection } from './GallerySection'
import { AboutSection } from './AboutSection'
import { BookingSection } from './BookingSection'
import { ContactSection } from './ContactSection'
import { TestimonialsSection } from './TestimonialsSection'

interface Props {
  brand: BrandConfig
  layout: LayoutConfig
  content: ContentConfig
  business: Business
  services: Service[]
  categories?: ServiceCategory[]
  staff: StaffMember[]
  staffServices?: StaffService[]
  workingHours?: WorkingHours[]
  forceMobileLayout?: boolean
  previewSlots?: TimeSlot[]
  previewMode?: boolean
  initialExistingBookings?: { manage_url: string; appointment_date: string; start_time: string }[]
  onContentChange?: (updates: Partial<ContentConfig>) => void
  bookingUrl: string
  currentCustomerUser?: CustomerUser | null
  authUrl?: string
}

export function SectionRenderer({
  brand,
  layout,
  content,
  business,
  services,
  categories = [],
  staff,
  staffServices = [],
  workingHours,
  forceMobileLayout,
  previewSlots,
  previewMode,
  initialExistingBookings,
  onContentChange,
  bookingUrl,
  currentCustomerUser,
  authUrl,
}: Props) {
  const websiteStyle = getWebsiteStyle(layout)
  const arabic = business.language === 'ar'
  const visibleSections = layout.sections
    .filter(s => s.visible || s.type === 'booking')
    .sort((a, b) => a.order - b.order)

  return (
    <>
      {visibleSections.map((section: SectionConfig) => {
        switch (section.type) {
          case 'hero':
            return (
              <HeroSection
                key={section.id}
                brand={brand}
                content={content}
                variant={section.variant}
                businessName={business.name}
                websiteStyle={websiteStyle}
                services={services}
                language={business.language}
                forceMobileLayout={forceMobileLayout}
                bookingUrl={bookingUrl}
                onContentChange={onContentChange}
              />
            )
          case 'services':
            return (
              <ServicesSection
                key={section.id}
                brand={brand}
                services={services}
                categories={categories}
                websiteStyle={websiteStyle}
                currency={business.currency}
                language={business.language}
                content={content}
                variant={section.variant}
                bookingUrl={bookingUrl}
                forceMobileLayout={forceMobileLayout}
                onContentChange={onContentChange}
              />
            )
          case 'about':
            return (
              <AboutSection
                key={section.id}
                brand={brand}
                content={content}
                variant={section.variant}
                language={business.language}
                forceMobileLayout={forceMobileLayout}
                onContentChange={onContentChange}
              />
            )
          case 'staff':
            return (
              <StaffSection
                key={section.id}
                brand={brand}
                staff={staff}
                content={content}
                variant={section.variant}
                language={business.language}
                onContentChange={onContentChange}
              />
            )
          case 'gallery':
            return (
              <GallerySection
                key={section.id}
                brand={brand}
                content={content}
                variant={section.variant}
                language={business.language}
                onContentChange={onContentChange}
              />
            )
          case 'booking':
            if (workingHours) {
              return (
                <section
                  key={section.id}
                  id="booking"
                  className="site-booking"
                  data-layout={websiteStyle}
                  style={{ background: 'var(--tenant-surface)' }}
                >
                  <div className="site-booking-inner">
                    <div className="site-booking-intro">
                    <p
                      className="text-xs font-bold uppercase tracking-[0.22em] mb-3"
                      style={{ color: 'var(--tenant-primary)' }}
                    >
                      <InlineEditable
                        value={content.bookingEyebrow ?? (arabic ? 'احجز موعداً' : 'Book an appointment')}
                        onChange={onContentChange ? value => onContentChange({ bookingEyebrow: value }) : undefined}
                      />
                    </p>
                    <h2
                      className="site-booking-heading"
                      style={{
                        color: 'var(--tenant-text)',
                        fontFamily: `'${brand.font}', serif`,
                      }}
                    >
                      <InlineEditable
                        value={content.bookingHeading ?? (arabic ? `احجز في ${business.name}` : `Book at ${business.name}`)}
                        onChange={onContentChange ? value => onContentChange({ bookingHeading: value }) : undefined}
                      />
                    </h2>
                    </div>
                    <BookingFlow
                      business={business}
                      services={services}
                      categories={categories}
                      staff={staff}
                      staffServices={staffServices}
                      workingHours={workingHours}
                      brandColor={brand.calendarColor ?? brand.primaryColor}
                      brandRadius={brand.radius}
                      calendarView={content.calendarView ?? 'monthly'}
                      forceMobileLayout={forceMobileLayout}
                      previewSlots={previewSlots}
                      previewMode={previewMode}
                      initialExistingBookings={initialExistingBookings}
                      currentCustomerUser={currentCustomerUser}
                      authUrl={authUrl}
                    />
                  </div>
                </section>
              )
            }

            return (
              <BookingSection
                key={section.id}
                brand={brand}
                bookingUrl={bookingUrl}
                businessName={business.name}
                variant={section.variant}
                language={business.language}
              />
            )
          case 'contact':
            return (
              <div key={section.id} id="contact">
                <ContactSection
                  brand={brand}
                  business={business}
                  workingHours={workingHours}
                  content={content}
                  variant={section.variant}
                  forceMobileLayout={forceMobileLayout}
                  onContentChange={onContentChange}
                />
              </div>
            )
          case 'testimonials':
            return (
              <TestimonialsSection
                key={section.id}
                brand={brand}
                content={content}
                variant={section.variant}
                language={business.language}
                forceMobileLayout={forceMobileLayout}
                onContentChange={onContentChange}
              />
            )
          default:
            return null
        }
      })}
    </>
  )
}
