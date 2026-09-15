import type { ReactNode } from 'react'
import { NativeBridge } from '@/components/native/NativeBridge'

/**
 * Shared layout for the whole /app segment (customer marketplace + business
 * mini-apps). Mounts the Capacitor native bridge — a no-op on the plain web,
 * active inside the Booklyt Android/iOS apps.
 */
export default function AppSegmentLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <NativeBridge />
      {children}
    </>
  )
}
