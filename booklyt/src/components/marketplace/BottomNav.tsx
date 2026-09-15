'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Home, Search, CalendarDays, Bell, User } from 'lucide-react'
import { cn } from '@/lib/utils'

const TABS = [
  { href: '/app',       label: 'Home',     icon: Home },
  { href: '/app/search', label: 'Search',   icon: Search },
  { href: '/app/bookings', label: 'Bookings', icon: CalendarDays },
  { href: '/app/notifications', label: 'Alerts', icon: Bell },
  { href: '/app/profile',  label: 'Profile',  icon: User },
] as const

export function BottomNav() {
  const pathname = usePathname()
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    let cancelled = false
    fetch('/api/customer/notifications?unread_count=1')
      .then(async (res) => {
        if (!res.ok || cancelled) return
        const data = await res.json()
        if (!cancelled) setUnread(data.unread ?? 0)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [pathname])

  const isActive = (href: string) => {
    if (href === '/app') return pathname === '/app'
    return pathname.startsWith(href)
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-zinc-100 safe-area-pb">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = isActive(href)
          const showBadge = href === '/app/notifications' && unread > 0
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 flex-1 py-2 px-1 rounded-xl transition-all',
                active
                  ? 'text-violet-600'
                  : 'text-zinc-400 hover:text-zinc-600'
              )}
            >
              <div className={cn(
                'relative flex items-center justify-center w-6 h-6',
              )}>
                <Icon
                  className={cn(
                    'w-[22px] h-[22px] transition-all',
                    active ? 'stroke-[2.3px]' : 'stroke-[1.7px]'
                  )}
                />
                {showBadge && (
                  <span className="absolute -top-1 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
                {active && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-violet-600" />
                )}
              </div>
              <span className={cn(
                'text-[10px] font-medium tracking-wide leading-none mt-0.5',
                active ? 'text-violet-600' : 'text-zinc-400'
              )}>
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
