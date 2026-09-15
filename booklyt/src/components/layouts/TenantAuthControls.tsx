'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

interface Props {
  customerName?: string | null
  authUrl?: string
  language?: 'en' | 'ar'
}

/**
 * Sign in / sign out for the customer, rendered in the tenant site header so it
 * carries the website's own brand instead of the generic app chrome.
 */
export function TenantAuthControls({ customerName, language = 'en' }: Props) {
  const arabic = language === 'ar'
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  // Showcase build: booking needs no account, so anonymous visitors are shown no
  // sign-in affordance at all. Customers who *are* signed in (via the customer
  // app) keep their identity chip and sign-out control.
  if (!customerName) return null

  async function signOut() {
    setLoading(true)
    try {
      await fetch('/api/customer/auth/logout', { method: 'POST' })
    } finally {
      setLoading(false)
      router.refresh()
    }
  }

  return (
    <span className="tenant-auth-signout">
      <strong>{customerName.trim().split(' ')[0]}</strong>
      <button type="button" onClick={signOut} disabled={loading}>
        {loading && <Loader2 className="inline h-3 w-3 animate-spin" />}
        {arabic ? 'تسجيل الخروج' : 'Sign out'}
      </button>
    </span>
  )
}
