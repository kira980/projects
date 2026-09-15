'use client'

import { useEffect, useState } from 'react'

interface Props {
  businessSlug: string
  businessName: string
}

export function OpenInAppBanner({ businessSlug, businessName }: Props) {
  const [show, setShow] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Don't show if already inside the Capacitor native app
    if (typeof window === 'undefined') return
    if ((window as unknown as Record<string, unknown>).Capacitor) return

    // Only show on mobile devices
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    if (!isMobile) return

    // Don't show if user already dismissed this session
    try {
      if (sessionStorage.getItem('bf_app_banner_dismissed')) return
    } catch {}

    setShow(true)
  }, [])

  if (!show || dismissed) return null

  const deepLink = `noma://business/${businessSlug}`
  const appStoreUrl = process.env.NEXT_PUBLIC_APP_STORE_URL
  const playStoreUrl = process.env.NEXT_PUBLIC_PLAY_STORE_URL

  const isAndroid = /Android/i.test(typeof navigator !== 'undefined' ? navigator.userAgent : '')
  const storeUrl = isAndroid ? playStoreUrl : appStoreUrl

  const handleOpen = () => {
    // Try deep link first; fall back to store if app isn't installed
    const fallback = storeUrl ? setTimeout(() => { window.location.href = storeUrl }, 1500) : null
    window.location.href = deepLink
    if (fallback) {
      // Cancel fallback if page hides (app opened)
      window.addEventListener('blur', () => clearTimeout(fallback), { once: true })
    }
  }

  const handleDismiss = () => {
    setDismissed(true)
    try { sessionStorage.setItem('bf_app_banner_dismissed', '1') } catch {}
  }

  return (
    <div className="flex items-center gap-3 bg-zinc-900 text-white px-4 py-3 text-sm">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-base">
        📅
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-xs leading-tight truncate">{businessName}</p>
        <p className="text-zinc-400 text-[11px] leading-tight">Open in the Noma app</p>
      </div>
      <button
        onClick={handleOpen}
        className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-zinc-900 hover:bg-zinc-100"
      >
        Open
      </button>
      {storeUrl && (
        <a
          href={storeUrl}
          className="shrink-0 rounded-lg border border-white/20 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-white"
        >
          Get app
        </a>
      )}
      <button
        onClick={handleDismiss}
        aria-label="Dismiss"
        className="shrink-0 text-zinc-500 hover:text-zinc-300 text-lg leading-none px-1"
      >
        ×
      </button>
    </div>
  )
}
