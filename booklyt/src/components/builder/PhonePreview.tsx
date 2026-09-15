'use client'

/**
 * Realistic iPhone-style phone mockup shell.
 * Renders children inside the scrollable screen area.
 * The Dynamic Island + status bar live inside the screen so content
 * starts below them — no content is ever hidden behind the notch.
 */

import { useRef, forwardRef, useImperativeHandle } from 'react'

export interface PhonePreviewHandle {
  scrollToTop: () => void
}

interface Props {
  children: React.ReactNode
  /** Width of the phone shell in CSS (default: min(360px, calc(100vw - 32px))) */
  width?: string
  /** Max height of the phone shell in CSS (default: min(780px, calc(100vh - 160px))) */
  maxHeight?: string
  className?: string
}

export const PhonePreview = forwardRef<PhonePreviewHandle, Props>(function PhonePreview(
  { children, width = 'min(360px, calc(100vw - 32px))', maxHeight = 'min(780px, calc(100vh - 160px))', className = '' },
  ref,
) {
  const screenRef = useRef<HTMLDivElement>(null)

  useImperativeHandle(ref, () => ({
    scrollToTop: () => screenRef.current?.scrollTo({ top: 0, behavior: 'smooth' }),
  }))

  const FRAME_BG = '#18181b'

  return (
    <div className={`relative flex-shrink-0 ${className}`} style={{ width }}>
      {/* ── Outer phone body ── */}
      <div
        className="relative shadow-[0_40px_100px_rgba(0,0,0,0.55),0_0_0_1px_rgba(255,255,255,0.07)]"
        style={{
          background: FRAME_BG,
          borderRadius: 48,
          padding: 12,
          width: '100%',
          aspectRatio: '9 / 19.5',
          maxHeight,
        }}
      >
        {/* Silent switch */}
        <div className="absolute left-[-3px] rounded-l-full"
          style={{ top: 88, width: 3, height: 22, background: 'rgba(255,255,255,0.10)' }} />
        {/* Volume up */}
        <div className="absolute left-[-3px] rounded-l-full"
          style={{ top: 120, width: 3, height: 34, background: 'rgba(255,255,255,0.13)' }} />
        {/* Volume down */}
        <div className="absolute left-[-3px] rounded-l-full"
          style={{ top: 164, width: 3, height: 48, background: 'rgba(255,255,255,0.13)' }} />
        {/* Power / side button */}
        <div className="absolute right-[-3px] rounded-r-full"
          style={{ top: 136, width: 3, height: 62, background: 'rgba(255,255,255,0.15)' }} />

        {/* ── Screen ── */}
        <div
          ref={screenRef}
          className="w-full h-full overflow-y-auto overflow-x-hidden bg-white"
          style={{
            borderRadius: 36,
            scrollbarWidth: 'none',
          } as React.CSSProperties}
        >
          {/* ── Status bar (sticky, overlays hero image on scroll) ── */}
          <div
            className="sticky top-0 z-50 flex items-center justify-between select-none pointer-events-none"
            style={{
              height: 54,
              paddingLeft: 20,
              paddingRight: 16,
              // Gradient so text stays readable over any hero image
              background: 'linear-gradient(180deg, rgba(0,0,0,0.38) 0%, rgba(0,0,0,0) 100%)',
            }}
          >
            {/* Dynamic Island — same color as frame, creates illusion of physical cutout */}
            <div
              className="absolute left-1/2 -translate-x-1/2 top-0"
              style={{
                width: 124,
                height: 34,
                background: FRAME_BG,
                borderRadius: '0 0 22px 22px',
              }}
            />

            {/* Time — left of Dynamic Island */}
            <span
              className="relative z-10 font-semibold text-white"
              style={{ fontSize: 13, letterSpacing: -0.3 }}
            >
              9:41
            </span>

            {/* Status icons — right of Dynamic Island */}
            <div className="relative z-10 flex items-center gap-1.5">
              {/* Cellular signal */}
              <svg width="18" height="12" viewBox="0 0 18 12" fill="white">
                <rect x="0"   y="8"   width="3.5" height="4"   rx="0.6" opacity="0.4" />
                <rect x="4.5" y="6"   width="3.5" height="6"   rx="0.6" opacity="0.6" />
                <rect x="9"   y="3.5" width="3.5" height="8.5" rx="0.6" opacity="0.8" />
                <rect x="13.5" y="0"  width="3.5" height="12"  rx="0.6" />
              </svg>

              {/* WiFi */}
              <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
                <circle cx="8" cy="11" r="1.4" fill="white" />
                <path d="M4.8 7.8 Q8 5.5 11.2 7.8" stroke="white" strokeWidth="1.4" strokeLinecap="round" fill="none" />
                <path d="M2.2 5.2 Q8 1.5 13.8 5.2" stroke="white" strokeWidth="1.4" strokeLinecap="round" fill="none" />
              </svg>

              {/* Battery */}
              <div className="flex items-center">
                <div
                  className="relative overflow-hidden"
                  style={{ width: 24, height: 12, borderRadius: 3.5, border: '1.5px solid rgba(255,255,255,0.75)' }}
                >
                  <div className="absolute inset-0 bg-white" style={{ width: '72%' }} />
                </div>
                <div style={{ width: 2, height: 5, background: 'rgba(255,255,255,0.5)', borderRadius: '0 1px 1px 0', marginLeft: 1 }} />
              </div>
            </div>
          </div>

          {/* ── Page content — rendered flush, scrolls under status bar ── */}
          <div style={{ marginTop: -54 }}>
            {children}
          </div>
        </div>

        {/* Home indicator */}
        <div
          className="absolute left-1/2 -translate-x-1/2"
          style={{
            bottom: 7,
            width: 120,
            height: 4,
            background: 'rgba(255,255,255,0.3)',
            borderRadius: 4,
          }}
        />
      </div>
    </div>
  )
})
