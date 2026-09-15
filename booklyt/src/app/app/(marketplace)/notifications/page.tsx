'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  Bell, CalendarCheck2, CalendarX2, CalendarClock, Clock3, Megaphone,
  RotateCcw, Sparkles, CheckCheck,
} from 'lucide-react'
import { CustomerLogin } from '@/components/marketplace/CustomerLogin'

interface NotificationRow {
  id: string
  business_id: string | null
  type: string
  title: string
  body: string
  url: string | null
  read_at: string | null
  created_at: string
  businesses: { name: string; slug: string; logo_url: string | null } | null
}

const TYPE_ICONS: Record<string, typeof Bell> = {
  booking_confirmed: CalendarCheck2,
  booking_reminder: Clock3,
  booking_cancelled: CalendarX2,
  booking_changed: CalendarClock,
  waitlist: Sparkles,
  announcement: Megaphone,
  rebooking: RotateCcw,
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationRow[] | null>(null)
  const [needsLogin, setNeedsLogin] = useState(false)
  const [marking, setMarking] = useState(false)

  useEffect(() => {
    fetch('/api/customer/notifications')
      .then(async (res) => {
        if (res.status === 401) { setNeedsLogin(true); return }
        const data = await res.json()
        setNotifications(data.notifications ?? [])
      })
      .catch(() => setNotifications([]))
  }, [])

  async function markAllRead() {
    if (!notifications?.some((n) => !n.read_at)) return
    setMarking(true)
    try {
      await fetch('/api/customer/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      })
      setNotifications((prev) =>
        prev?.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })) ?? null
      )
    } finally {
      setMarking(false)
    }
  }

  if (needsLogin) {
    return (
      <div className="px-5 pt-14 pb-8">
        <h1 className="text-2xl font-extrabold text-zinc-900 mb-6">Notifications</h1>
        <CustomerLogin title="Sign in to see notifications" />
      </div>
    )
  }

  return (
    <div className="px-5 pt-14 pb-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-extrabold text-zinc-900">Notifications</h1>
        {notifications?.some((n) => !n.read_at) && (
          <button
            onClick={markAllRead}
            disabled={marking}
            className="flex items-center gap-1 text-xs font-semibold text-violet-600"
          >
            <CheckCheck className="w-3.5 h-3.5" /> Mark all read
          </button>
        )}
      </div>

      {notifications === null ? (
        <div className="space-y-3">
          {Array(4).fill(0).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-zinc-100 shadow-sm h-20 animate-pulse" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-16 text-zinc-400">
          <Bell className="w-12 h-12 mx-auto mb-3 opacity-25" />
          <p className="text-sm font-medium">No notifications yet</p>
          <p className="text-xs mt-1">Booking updates and business news show up here</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const Icon = TYPE_ICONS[n.type] ?? Bell
            const inner = (
              <div className={`flex items-start gap-3 rounded-2xl border px-4 py-3.5 shadow-sm ${n.read_at ? 'bg-white border-zinc-100' : 'bg-violet-50/60 border-violet-100'}`}>
                {n.businesses?.logo_url ? (
                  <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0 mt-0.5">
                    <Image src={n.businesses.logo_url} alt={n.businesses.name} width={36} height={36} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Icon className="w-4 h-4 text-violet-600" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm leading-snug ${n.read_at ? 'font-medium text-zinc-700' : 'font-bold text-zinc-900'}`}>{n.title}</p>
                    <span className="text-[10px] text-zinc-400 flex-shrink-0 mt-0.5">{timeAgo(n.created_at)}</span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{n.body}</p>
                </div>
                {!n.read_at && <span className="w-2 h-2 rounded-full bg-violet-600 flex-shrink-0 mt-2" />}
              </div>
            )
            return n.url
              ? <Link key={n.id} href={n.url}>{inner}</Link>
              : <div key={n.id}>{inner}</div>
          })}
        </div>
      )}
    </div>
  )
}
