'use client'

/**
 * Native bridge for the Booklyt Capacitor apps.
 *
 * The Android/iOS apps load this Next.js app remotely (capacitor.config.ts
 * server.url), and Capacitor injects its runtime into the WebView — so this
 * component talks to native plugins via window.Capacitor. On the plain web
 * it renders nothing and does nothing.
 *
 * Responsibilities:
 *  - Android hardware back button (history back, exit at the root)
 *  - Deep links (booklyt://… and https://booklyt.net/…) → client navigation
 *  - Push notifications: permission flow, token registration against
 *    /api/customer/push-token (only once signed in), tap → navigate
 *  - Offline banner via the Network plugin
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { WifiOff } from 'lucide-react'

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    Capacitor?: any
  }
}

function getCapacitor(): any | null {
  if (typeof window === 'undefined') return null
  const cap = window.Capacitor
  if (!cap?.isNativePlatform?.()) return null
  return cap
}

/** Map any Booklyt URL (deep link or universal link) to an in-app path. */
export function deepLinkToPath(url: string): string | null {
  try {
    if (url.startsWith('booklyt://')) {
      // booklyt://business/123456 → /app/business/123456
      const rest = url.replace('booklyt://', '').replace(/^\/+/, '')
      return rest ? `/app/${rest.replace(/^app\//, '')}` : '/app'
    }
    const parsed = new URL(url)
    if (parsed.pathname.startsWith('/app') || parsed.pathname.startsWith('/book')) {
      return parsed.pathname + parsed.search
    }
    return null
  } catch {
    return null
  }
}

export function NativeBridge() {
  const router = useRouter()
  const pathname = usePathname()
  const [offline, setOffline] = useState(false)
  const pushRegistered = useRef(false)

  // ── Back button + deep links + network (once) ────────────────────────────
  useEffect(() => {
    const cap = getCapacitor()
    if (!cap) return

    const handles: any[] = []

    const app = cap.Plugins?.App
    if (app) {
      app.addListener('backButton', ({ canGoBack }: { canGoBack: boolean }) => {
        const atRoot = window.location.pathname === '/app' || window.location.pathname === '/app/'
        if (atRoot || !(canGoBack || window.history.length > 1)) {
          app.exitApp()
        } else {
          window.history.back()
        }
      }).then((h: any) => handles.push(h))

      app.addListener('appUrlOpen', ({ url }: { url: string }) => {
        const path = deepLinkToPath(url)
        if (path) router.push(path)
      }).then((h: any) => handles.push(h))
    }

    const network = cap.Plugins?.Network
    if (network) {
      network.getStatus?.().then((s: any) => setOffline(!s.connected)).catch(() => {})
      network.addListener('networkStatusChange', (s: any) => {
        setOffline(!s.connected)
      }).then((h: any) => handles.push(h))
    }

    // Hide the native splash once the web app is interactive
    cap.Plugins?.SplashScreen?.hide?.().catch(() => {})

    return () => {
      handles.forEach((h) => h?.remove?.())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Push registration (after sign-in) ────────────────────────────────────
  const setupPush = useCallback(async () => {
    const cap = getCapacitor()
    const push = cap?.Plugins?.PushNotifications
    if (!push || pushRegistered.current) return

    try {
      // Only register devices for signed-in customers
      const me = await fetch('/api/customer/auth/me').then((r) => r.json()).catch(() => null)
      if (!me?.user) return

      let { receive } = await push.checkPermissions()
      if (receive === 'prompt' || receive === 'prompt-with-rationale') {
        ({ receive } = await push.requestPermissions())
      }
      if (receive !== 'granted') return

      pushRegistered.current = true

      await push.addListener('registration', async ({ value }: { value: string }) => {
        await fetch('/api/customer/push-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: value,
            platform: cap.getPlatform?.() === 'ios' ? 'ios' : 'android',
            permission: 'granted',
          }),
        }).catch(() => {})
      })

      await push.addListener('pushNotificationActionPerformed', (action: any) => {
        const url = action?.notification?.data?.url
        if (typeof url === 'string' && url.startsWith('/')) router.push(url)
      })

      await push.register()
    } catch (err) {
      console.error('[native] push setup failed:', err)
      pushRegistered.current = false
    }
  }, [router])

  // Try after each navigation — cheap when already registered or logged out,
  // and picks up the moment the customer signs in.
  useEffect(() => {
    setupPush()
  }, [pathname, setupPush])

  if (!offline) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-zinc-900 text-white text-xs font-semibold flex items-center justify-center gap-2 py-2 px-4"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 8px)' }}
    >
      <WifiOff className="w-3.5 h-3.5" />
      No internet connection
    </div>
  )
}
