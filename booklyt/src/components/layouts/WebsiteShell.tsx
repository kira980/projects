import { BookingFlow } from '@/components/booking/booking-flow'
import { PwaInstallCard } from '@/components/pwa-install-card'
import { TenantWebsite } from './TenantWebsite'
import { NativeBottomNav } from './NativeBottomNav'
import { Calendar, MapPin, Phone } from 'lucide-react'
import { BUSINESS_CATEGORIES } from '@/lib/utils'
import type { RenderMode } from '@/lib/render-mode'
import type { CustomerUser } from '@/lib/customer-auth'
import type { Business, Service, ServiceCategory, StaffMember, StaffService, WorkingHours } from '@/types/database'
import type { PublishedConfig } from '@/types/builder'

interface WebsiteShellProps {
  publishedConfig: PublishedConfig | null
  business: Business
  services: Service[]
  categories?: ServiceCategory[]
  staff: StaffMember[]
  staffServices?: StaffService[]
  workingHours: WorkingHours[]
  appName: string
  logoUrl: string | null
  appIconUrl: string | null
  initialExistingBookings: { manage_url: string; appointment_date: string; start_time: string }[]
  renderMode?: RenderMode
  currentCustomerUser?: CustomerUser | null
  authUrl?: string
}

function formatTime(t: string | null): string {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const p = h < 12 ? 'AM' : 'PM'
  const d = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${d}:${m.toString().padStart(2, '0')} ${p}`
}

export function WebsiteShell({
  publishedConfig,
  business,
  services,
  categories = [],
  staff,
  staffServices = [],
  workingHours,
  appName,
  logoUrl,
  appIconUrl,
  initialExistingBookings,
  renderMode = 'website',
  currentCustomerUser,
  authUrl,
}: WebsiteShellProps) {
  const isNative = renderMode === 'native'

  // Native chrome: bottom nav values derived from the same brand data the page uses
  const navPrimaryColor = publishedConfig?.brand?.primaryColor ?? '#7c3aed'
  const navBgColor = publishedConfig?.brand?.backgroundColor ?? '#ffffff'
  const navTextColor = publishedConfig?.brand?.textColor ?? '#18181b'
  const navLanguage = ((publishedConfig?.meta?.language ?? business.language) || 'en') as 'en' | 'ar'
  const hasContact = !!(business.phone || business.address)

  const nativeBottomNav = isNative ? (
    <NativeBottomNav
      language={navLanguage}
      primaryColor={navPrimaryColor}
      bgColor={navBgColor}
      textColor={navTextColor}
      existingBookingUrl={initialExistingBookings[0]?.manage_url ?? null}
      hasContact={hasContact}
      businessId={business.id}
    />
  ) : null

  // ── Path 1: full branded page via SectionRenderer ──────────────────────────
  if (publishedConfig?.brand && publishedConfig.layout) {
    const b = publishedConfig.brand
    return (
      <>
        {/* Fixed status-bar overlay — covers the safe area above the SectionRenderer nav */}
        {isNative && (
          <div
            className="fixed top-0 left-0 right-0 z-50 pointer-events-none"
            style={{ height: 'env(safe-area-inset-top)', background: b.backgroundColor }}
          />
        )}
        <TenantWebsite
          config={publishedConfig}
          business={business}
          services={services}
          categories={categories}
          staff={staff}
          staffServices={staffServices}
          workingHours={workingHours}
          initialExistingBookings={initialExistingBookings}
          currentCustomerUser={currentCustomerUser}
          authUrl={authUrl}
          isNative={isNative}
        />
        {isNative ? (
          <>
            <div className="h-20" />
            {nativeBottomNav}
          </>
        ) : (
          <PwaInstallCard appName={appName} iconUrl={appIconUrl} />
        )}
      </>
    )
  }

  // ── Path 2: brand config exists but no layout — inline branded page ─────────
  if (publishedConfig?.brand) {
    const b = publishedConfig.brand
    const c = publishedConfig.content ?? {}
    const calColor = b.calendarColor ?? b.primaryColor

    const radiusMap: Record<string, string> = {
      rounded: 'rounded-lg', pill: 'rounded-full', sharp: 'rounded-none', outline: 'rounded-lg',
    }
    const btnRadius = radiusMap[b.buttonStyle] ?? 'rounded-lg'
    const hasHeroImage = !!c.heroImage
    const overlayOpacity = (c.heroImageOverlayOpacity ?? 40) / 100

    return (
      <>
        {b.font && b.font !== 'Inter' && (
          // eslint-disable-next-line @next/next/no-page-custom-font
          <link
            rel="stylesheet"
            href={`https://fonts.googleapis.com/css2?family=${b.font.replace(/ /g, '+')}:wght@300;400;500;600;700&display=swap`}
          />
        )}

        <div
          style={{
            fontFamily: `'${b.font}', system-ui, sans-serif`,
            background: b.backgroundColor,
            color: b.textColor,
            minHeight: '100vh',
          }}
        >
          {/* Nav — grows for safe-area inset in native mode; env() = 0 in browser so no visual change */}
          <header
            className="sticky top-0 z-40 flex items-center border-b"
            style={{
              background: b.backgroundColor,
              borderColor: `${b.textColor}12`,
              minHeight: '4rem',
              paddingTop: isNative ? 'env(safe-area-inset-top)' : undefined,
            }}
          >
            <div className="max-w-5xl mx-auto px-6 w-full flex items-center justify-between">
              <div className="flex items-center gap-3">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt={business.name} className="h-8 w-auto object-contain" />
                ) : (
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: b.primaryColor }}
                  >
                    <Calendar className="w-4 h-4 text-white" />
                  </div>
                )}
                <span
                  className="font-bold text-sm tracking-tight"
                  style={{ color: b.textColor, fontFamily: `'${b.font}', serif` }}
                >
                  {business.name}
                </span>
              </div>
              <a
                href="#booking"
                className={`${btnRadius} px-5 py-2 text-xs font-bold text-white tracking-wide transition-opacity hover:opacity-85`}
                style={{ background: b.primaryColor }}
              >
                Book Now
              </a>
            </div>
          </header>

          {/* Hero */}
          <section
            className="relative overflow-hidden"
            style={{ minHeight: hasHeroImage ? '65vh' : '40vh' }}
          >
            {hasHeroImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={c.heroImage!}
                alt={business.name}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div
                className="absolute inset-0"
                style={{ background: `linear-gradient(135deg, ${b.backgroundColor} 0%, ${b.accentColor} 100%)` }}
              />
            )}

            {hasHeroImage && c.showHeroText && (
              <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${overlayOpacity})` }} />
            )}

            {(!hasHeroImage || c.showHeroText) && (
              <div className="relative z-10 flex items-center justify-center h-full min-h-[40vh] p-8 text-center">
                <div className="max-w-2xl">
                  <p
                    className="text-xs font-bold uppercase tracking-[0.22em] mb-5"
                    style={{ color: hasHeroImage ? 'rgba(255,255,255,0.7)' : b.primaryColor }}
                  >
                    {business.category}
                  </p>
                  <h1
                    className="text-[clamp(2.5rem,7vw,5.5rem)] font-bold leading-[0.92] tracking-tight mb-5 whitespace-pre-line"
                    style={{ color: hasHeroImage ? '#ffffff' : b.textColor, fontFamily: `'${b.font}', serif` }}
                  >
                    {c.heroTitle || business.name}
                  </h1>
                  {c.heroSubtitle && (
                    <p
                      className="text-lg mb-8 leading-relaxed max-w-md mx-auto"
                      style={{ color: hasHeroImage ? 'rgba(255,255,255,0.75)' : b.mutedColor }}
                    >
                      {c.heroSubtitle}
                    </p>
                  )}
                  <a
                    href="#booking"
                    className={`${btnRadius} inline-flex items-center gap-2 px-8 py-3.5 text-sm font-bold text-white transition-opacity hover:opacity-85`}
                    style={{ background: b.primaryColor }}
                  >
                    {c.heroCtaText || 'Book Appointment'}
                  </a>
                </div>
              </div>
            )}
          </section>

          {/* Booking */}
          <section id="booking" className="py-20 px-6" style={{ background: b.surfaceColor }}>
            <div className="max-w-4xl mx-auto">
              <p
                className="text-xs font-bold uppercase tracking-[0.22em] mb-3"
                style={{ color: b.primaryColor }}
              >
                Book an appointment
              </p>
              <h2
                className="text-3xl font-bold tracking-tight mb-10"
                style={{ color: b.textColor, fontFamily: `'${b.font}', serif` }}
              >
                {c.heroCtaText ? `${c.heroCtaText} at ${business.name}` : `Book at ${business.name}`}
              </h2>
              <BookingFlow
                business={business}
                services={services}
                categories={categories}
                staff={staff}
                staffServices={staffServices}
                workingHours={workingHours}
                brandColor={calColor}
                brandRadius={b.radius}
                initialExistingBookings={initialExistingBookings}
                currentCustomerUser={currentCustomerUser}
                authUrl={authUrl}
              />
            </div>
          </section>

          {/* Footer — id="contact" lets NativeBottomNav scroll here */}
          <footer
            id="contact"
            className="py-8 px-6 border-t text-center"
            style={{ borderColor: `${b.textColor}10`, background: b.backgroundColor }}
          >
            <p className="text-xs" style={{ color: b.mutedColor }}>
              {business.name}
              {business.address && ` · ${business.address}`}
              {business.phone && ` · ${business.phone}`}
            </p>
          </footer>

          {/* Spacer so content clears the native bottom nav */}
          {isNative && <div className="h-20" />}
        </div>
        {isNative ? nativeBottomNav : <PwaInstallCard appName={appName} iconUrl={appIconUrl} />}
      </>
    )
  }

  // ── Path 3: fallback — no published config ──────────────────────────────────
  const categoryLabel =
    BUSINESS_CATEGORIES.find((c) => c.value === business.category)?.label ?? business.category

  return (
    <>
      <div className="min-h-screen bg-white">
        {/* Header grows for safe-area inset in native mode; env() = 0 in browser */}
        <header
          className="bg-white border-b border-zinc-100 sticky top-0 z-40"
          style={isNative ? { paddingTop: 'env(safe-area-inset-top)' } : undefined}
        >
          <div className="max-w-5xl mx-auto px-5 min-h-[56px] flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center shrink-0">
              <Calendar className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <p className="font-bold text-[14px] leading-tight tracking-tight">{business.name}</p>
              <p className="text-[11px] text-zinc-400">{categoryLabel}</p>
            </div>
          </div>
        </header>

        <div className="max-w-5xl mx-auto px-5 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Business info sidebar — id="contact" for NativeBottomNav scroll */}
            <div id="contact" className="lg:col-span-1">
              <div className="bg-white rounded-2xl border border-zinc-100 p-6 sticky top-24 shadow-[0_2px_16px_rgba(0,0,0,0.04)]">
                <div className="mb-5">
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={logoUrl}
                      alt={business.name}
                      className="w-14 h-14 rounded-xl object-cover mb-4"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-violet-600 flex items-center justify-center mb-4">
                      <Calendar className="w-7 h-7 text-white" />
                    </div>
                  )}
                  <h1 className="text-[18px] font-bold tracking-tight">{business.name}</h1>
                  <p className="text-xs text-violet-600 font-medium mt-0.5">{categoryLabel}</p>
                </div>

                {business.description && (
                  <p className="text-sm text-zinc-500 leading-relaxed mb-5">{business.description}</p>
                )}

                <div className="space-y-2.5">
                  {business.phone && (
                    <div className="flex items-center gap-2.5 text-[13px] text-zinc-600">
                      <Phone className="w-3.5 h-3.5 text-zinc-300 shrink-0" />
                      {business.phone}
                    </div>
                  )}
                  {business.address && (
                    <div className="flex items-start gap-2.5 text-[13px] text-zinc-600">
                      <MapPin className="w-3.5 h-3.5 text-zinc-300 shrink-0 mt-0.5" />
                      {business.address}
                    </div>
                  )}
                </div>

                {workingHours.length > 0 && (
                  <div className="mt-5 pt-5 border-t border-zinc-100">
                    <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-[0.15em] mb-3">
                      Hours
                    </p>
                    <div className="space-y-1.5">
                      {workingHours.map((wh) => {
                        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
                        return (
                          <div key={wh.id} className="flex justify-between text-xs">
                            <span className="text-zinc-400">{dayNames[wh.day_of_week]}</span>
                            {wh.is_open ? (
                              <span className="text-zinc-700 font-medium tabular-nums">
                                {formatTime(wh.open_time)} – {formatTime(wh.close_time)}
                              </span>
                            ) : (
                              <span className="text-zinc-300">Closed</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Booking flow — id="booking" for NativeBottomNav scroll */}
            <div id="booking" className="lg:col-span-2">
              <BookingFlow
                business={business}
                services={services}
                categories={categories}
                staff={staff}
                staffServices={staffServices}
                workingHours={workingHours}
                initialExistingBookings={initialExistingBookings}
                currentCustomerUser={currentCustomerUser}
                authUrl={authUrl}
              />
            </div>
          </div>
        </div>

        {/* Spacer so content clears the native bottom nav */}
        {isNative && <div className="h-20" />}
      </div>
      {isNative ? nativeBottomNav : <PwaInstallCard appName={appName} iconUrl={appIconUrl} />}
    </>
  )
}
