'use client'

import { useEffect } from 'react'

/**
 * Records a business visit for the signed-in customer (no-op when logged out).
 * Fires once per business per browser session.
 */
export function TrackVisit({ slug }: { slug: string }) {
  useEffect(() => {
    const key = `bf_visit_${slug}`
    try {
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, '1')
    } catch {
      // sessionStorage unavailable — still track, just without dedupe
    }
    fetch('/api/customer/businesses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug }),
    }).catch(() => {})
  }, [slug])

  return null
}
