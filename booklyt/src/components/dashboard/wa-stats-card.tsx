"use client"

import { useEffect, useState } from "react"
import { MessageSquare } from "lucide-react"

type WaStats = {
  auth: number
  booking_confirmation: number
  reminder: number
  waitlist: number
  verification_link: number
  total: number
  failed: number
}

export function WaStatsCard() {
  const [stats, setStats] = useState<WaStats | null>(null)

  useEffect(() => {
    fetch("/api/dashboard/wa-stats")
      .then(r => r.ok ? r.json() : null)
      .then(setStats)
      .catch(() => {})
  }, [])

  if (!stats || stats.total === 0) return null

  const rows = [
    { label: "Verification (OTP/Link)", value: stats.auth + stats.verification_link },
    { label: "Booking confirmations", value: stats.booking_confirmation },
    { label: "Reminders", value: stats.reminder },
    { label: "Waitlist", value: stats.waitlist },
  ]

  return (
    <div className="rounded-xl border border-zinc-100 bg-white p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center">
          <MessageSquare className="w-3.5 h-3.5 text-green-600" />
        </div>
        <h3 className="text-sm font-semibold tracking-tight text-zinc-900">WhatsApp messages</h3>
      </div>

      <div className="flex items-baseline gap-1 mb-4">
        <span className="text-3xl font-bold tracking-tight tabular-nums">{stats.total}</span>
        <span className="text-xs text-zinc-400">total sent</span>
        {stats.failed > 0 && (
          <span className="ml-auto text-xs text-red-500 font-medium">{stats.failed} failed</span>
        )}
      </div>

      <div className="space-y-2">
        {rows.map(row => (
          <div key={row.label} className="flex items-center justify-between text-[13px]">
            <span className="text-zinc-500">{row.label}</span>
            <span className="font-medium text-zinc-800 tabular-nums">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
