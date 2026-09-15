'use client'

import Link from 'next/link'
import { Calendar, CalendarCheck, MapPin } from 'lucide-react'
import { useState, useEffect } from 'react'

interface NativeBottomNavProps {
  language: 'en' | 'ar'
  primaryColor: string
  bgColor: string
  textColor: string
  existingBookingUrl: string | null
  hasContact: boolean
  businessId: string
}

const labels = {
  en: { book: 'Book', myBooking: 'My Booking', contact: 'Contact' },
  ar: { book: 'حجز', myBooking: 'حجزي', contact: 'تواصل' },
}

export function NativeBottomNav({
  language,
  primaryColor,
  bgColor,
  textColor,
  existingBookingUrl,
  hasContact,
  businessId,
}: NativeBottomNavProps) {
  const t = labels[language] ?? labels.en

  // Server-side cookie lookup may miss cases where the page wasn't refreshed after
  // booking, or where cookies were cleared. Read the manage URL from localStorage
  // as a client-side fallback (written by BookingFlow on successful booking).
  const [resolvedBookingUrl, setResolvedBookingUrl] = useState(existingBookingUrl)
  useEffect(() => {
    if (!resolvedBookingUrl) {
      try {
        const stored = localStorage.getItem(`bf_manage_${businessId}`)
        if (stored) setResolvedBookingUrl(stored)
      } catch { /* storage unavailable */ }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <nav
      className="sticky bottom-0 z-40 flex border-t"
      style={{
        background: bgColor,
        borderColor: `${textColor}18`,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <button
        onClick={() => scrollTo('booking')}
        className="flex flex-1 flex-col items-center gap-1 py-3 text-[11px] font-semibold min-h-[52px] active:opacity-70 transition-opacity"
        style={{ color: primaryColor }}
      >
        <Calendar className="h-5 w-5" />
        {t.book}
      </button>

      {resolvedBookingUrl ? (
        <Link
          href={resolvedBookingUrl}
          className="flex flex-1 flex-col items-center gap-1 py-3 text-[11px] font-medium min-h-[52px] active:opacity-70 transition-opacity"
          style={{ color: `${textColor}70` }}
        >
          <CalendarCheck className="h-5 w-5" />
          {t.myBooking}
        </Link>
      ) : (
        <button
          disabled
          className="flex flex-1 flex-col items-center gap-1 py-3 text-[11px] font-medium min-h-[52px] opacity-35"
          style={{ color: textColor }}
        >
          <CalendarCheck className="h-5 w-5" />
          {t.myBooking}
        </button>
      )}

      {hasContact ? (
        <button
          onClick={() => scrollTo('contact')}
          className="flex flex-1 flex-col items-center gap-1 py-3 text-[11px] font-medium min-h-[52px] active:opacity-70 transition-opacity"
          style={{ color: `${textColor}70` }}
        >
          <MapPin className="h-5 w-5" />
          {t.contact}
        </button>
      ) : (
        <button
          disabled
          className="flex flex-1 flex-col items-center gap-1 py-3 text-[11px] font-medium min-h-[52px] opacity-35"
          style={{ color: textColor }}
        >
          <MapPin className="h-5 w-5" />
          {t.contact}
        </button>
      )}
    </nav>
  )
}
