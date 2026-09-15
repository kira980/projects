'use client'

import { useState } from 'react'
import { Bell, BellOff } from 'lucide-react'

interface Props {
  businessId: string
  initialEnabled: boolean
}

/** Per-business notification mute toggle (anti-spam control for customers). */
export function MuteButton({ businessId, initialEnabled }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled)

  async function toggle(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const next = !enabled
    setEnabled(next)
    try {
      const res = await fetch('/api/customer/businesses', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_id: businessId, notifications_enabled: next }),
      })
      if (!res.ok) setEnabled(!next)
    } catch {
      setEnabled(!next)
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={enabled ? 'Mute notifications from this business' : 'Enable notifications from this business'}
      aria-pressed={enabled}
      className="p-2 rounded-xl hover:bg-zinc-100 active:scale-90 transition-transform"
    >
      {enabled
        ? <Bell className="w-4.5 h-4.5 text-violet-500" />
        : <BellOff className="w-4.5 h-4.5 text-zinc-300" />}
    </button>
  )
}
