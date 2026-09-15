'use client'

/**
 * Native QR scan button — shown only inside the Booklyt apps (Capacitor),
 * where the CapacitorBarcodeScanner plugin is available. Scans a business QR
 * (or any Booklyt link) and navigates to the matching business.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ScanLine } from 'lucide-react'
import { deepLinkToPath } from '@/components/native/NativeBridge'

/* eslint-disable @typescript-eslint/no-explicit-any */

export function ScanQrButton() {
  const router = useRouter()
  const [available, setAvailable] = useState(false)

  useEffect(() => {
    const cap = (window as any).Capacitor
    setAvailable(Boolean(cap?.isNativePlatform?.() && cap?.Plugins?.CapacitorBarcodeScanner))
  }, [])

  if (!available) return null

  async function scan() {
    try {
      const scanner = (window as any).Capacitor.Plugins.CapacitorBarcodeScanner
      const result = await scanner.scanBarcode({ hint: 0 /* QR_CODE */ })
      const value: string | undefined = result?.ScanResult
      if (!value) return

      const path = deepLinkToPath(value)
      if (path) {
        router.push(path)
      } else if (/^\d{6}$/.test(value.trim())) {
        router.push(`/app/business/${value.trim()}`)
      }
    } catch {
      // user cancelled the scanner — nothing to do
    }
  }

  return (
    <button
      type="button"
      onClick={scan}
      aria-label="Scan business QR code"
      className="w-10 h-10 rounded-2xl bg-white border border-zinc-100 shadow-sm text-violet-600 flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform"
    >
      <ScanLine className="w-5 h-5" />
    </button>
  )
}
