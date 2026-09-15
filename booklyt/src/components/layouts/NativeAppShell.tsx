import { Phone, MapPin } from 'lucide-react'
import { NativeBottomNav } from './NativeBottomNav'
import type { BrandConfig, MobileNavStyle } from '@/types/builder'

interface NativeAppShellProps {
  appName: string
  iconUrl?: string | null
  slogan?: string
  language: 'en' | 'ar'
  brand?: BrandConfig | null
  mobileNavStyle?: MobileNavStyle
  initialExistingBookings?: { manage_url: string; appointment_date: string; start_time: string }[]
  contactInfo?: { phone?: string | null; address?: string | null }
  businessId: string
  children: React.ReactNode
}

export function NativeAppShell({
  appName,
  iconUrl,
  slogan,
  language,
  brand,
  mobileNavStyle = 'bottom-tabs',
  initialExistingBookings,
  contactInfo,
  businessId,
  children,
}: NativeAppShellProps) {
  const isRtl = language === 'ar'
  const primaryColor = brand?.primaryColor ?? '#7c3aed'
  const bgColor = brand?.backgroundColor ?? '#ffffff'
  const textColor = brand?.textColor ?? '#0f0f14'
  const surfaceColor = brand?.surfaceColor ?? '#f4f4f5'
  const hasContact = !!(contactInfo?.phone || contactInfo?.address)
  const showBottomNav = mobileNavStyle !== 'minimal'

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="flex flex-col overflow-x-hidden"
      style={{ background: bgColor, color: textColor, minHeight: '100dvh' }}
    >
      {/* Top bar */}
      <header
        className="sticky top-0 z-40 flex items-center gap-3 px-4 border-b"
        style={{
          background: bgColor,
          borderColor: `${textColor}10`,
          paddingTop: `max(12px, env(safe-area-inset-top))`,
          paddingBottom: '12px',
        }}
      >
        {iconUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={iconUrl}
            alt={appName}
            className="h-9 w-9 rounded-xl object-cover shrink-0"
          />
        ) : (
          <div
            className="h-9 w-9 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0"
            style={{ background: primaryColor }}
          >
            {appName.slice(0, 1).toUpperCase()}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p
            className="text-sm font-semibold leading-tight truncate"
            style={{ color: textColor, fontFamily: brand?.font ? `'${brand.font}', system-ui, sans-serif` : undefined }}
          >
            {appName}
          </p>
          {slogan && (
            <p
              className="text-[11px] leading-tight truncate"
              style={{ color: `${textColor}60` }}
            >
              {slogan}
            </p>
          )}
        </div>
      </header>

      {/* Main scrollable content */}
      <main
        className="flex-1 overflow-x-hidden"
        style={{ fontFamily: brand?.font ? `'${brand.font}', system-ui, sans-serif` : undefined }}
      >
        {/* Booking section — id used by NativeBottomNav scroll target */}
        <div id="booking" className="px-4 py-6">
          {children}
        </div>

        {/* Contact section — id used by NativeBottomNav scroll target */}
        {hasContact && (
          <div
            id="contact"
            className="mx-4 mb-6 rounded-2xl p-5 space-y-3"
            style={{ background: surfaceColor }}
          >
            {contactInfo?.phone && (
              <a
                href={`tel:${contactInfo.phone}`}
                className="flex items-center gap-3 text-sm active:opacity-70 transition-opacity"
                style={{ color: textColor }}
              >
                <span
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: `${primaryColor}18` }}
                >
                  <Phone className="w-4 h-4" style={{ color: primaryColor }} />
                </span>
                {contactInfo.phone}
              </a>
            )}
            {contactInfo?.address && (
              <div
                className="flex items-start gap-3 text-sm"
                style={{ color: textColor }}
              >
                <span
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: `${primaryColor}18` }}
                >
                  <MapPin className="w-4 h-4" style={{ color: primaryColor }} />
                </span>
                {contactInfo.address}
              </div>
            )}
          </div>
        )}

        {showBottomNav && <div className="h-4" />}
      </main>

      {showBottomNav && (
        <NativeBottomNav
          language={language}
          primaryColor={primaryColor}
          bgColor={bgColor}
          textColor={textColor}
          existingBookingUrl={initialExistingBookings?.[0]?.manage_url ?? null}
          hasContact={hasContact}
          businessId={businessId}
        />
      )}
    </div>
  )
}
