import Link from 'next/link'
import Image from 'next/image'
import {
  User, Heart, Settings, HelpCircle, ChevronRight, Building2,
  CalendarDays, Bell, FileText, ShieldCheck,
} from 'lucide-react'
import { getCurrentCustomerUser } from '@/lib/customer-auth'
import { getSavedBusinesses } from '@/lib/customer/businesses'
import { CustomerLogin } from '@/components/marketplace/CustomerLogin'
import { LogoutButton } from '@/components/marketplace/LogoutButton'
import { FavoriteButton } from '@/components/marketplace/FavoriteButton'
import { MuteButton } from '@/components/marketplace/MuteButton'

export const dynamic = 'force-dynamic'

const MENU_ITEMS = [
  { label: 'Your bookings', icon: CalendarDays, href: '/app/bookings', badge: null },
  { label: 'Notifications', icon: Bell, href: '/app/notifications', badge: null },
  { label: 'List your business', icon: Building2, href: '/onboarding', badge: 'Free' },
  { label: 'Business dashboard', icon: Settings, href: '/dashboard', badge: null },
  { label: 'Help & support', icon: HelpCircle, href: '#', badge: null },
]

const LEGAL_ITEMS = [
  { label: 'Privacy policy', icon: ShieldCheck, href: '/privacy' },
  { label: 'Terms of service', icon: FileText, href: '/terms' },
]

export default async function ProfilePage() {
  const user = await getCurrentCustomerUser()

  if (!user) {
    return (
      <div className="px-5 pt-14 pb-8">
        <div className="flex flex-col items-center py-8">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center mb-3 shadow-lg shadow-violet-200">
            <User className="w-9 h-9 text-white" strokeWidth={1.8} />
          </div>
          <h1 className="text-lg font-bold text-zinc-900">Welcome to Booklyt</h1>
          <p className="text-zinc-400 text-sm mt-0.5">Sign in to see your businesses and bookings</p>
        </div>
        <CustomerLogin />
        <div className="space-y-2 mt-6">
          {LEGAL_ITEMS.map(({ label, icon: Icon, href }) => (
            <Link key={label} href={href} className="flex items-center gap-3 bg-white border border-zinc-100 rounded-2xl px-4 py-3.5 shadow-sm">
              <div className="w-9 h-9 rounded-xl bg-zinc-50 flex items-center justify-center flex-shrink-0">
                <Icon className="w-4.5 h-4.5 text-zinc-500" />
              </div>
              <span className="flex-1 font-medium text-zinc-800 text-sm">{label}</span>
              <ChevronRight className="w-4 h-4 text-zinc-300 flex-shrink-0" />
            </Link>
          ))}
        </div>
      </div>
    )
  }

  const saved = await getSavedBusinesses(user.id)
  const favorites = saved.filter((b) => b.favorite)

  return (
    <div className="px-5 pt-14 pb-8">
      {/* Account header */}
      <div className="flex flex-col items-center py-8">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center mb-3 shadow-lg shadow-violet-200">
          <User className="w-9 h-9 text-white" strokeWidth={1.8} />
        </div>
        <h1 className="text-lg font-bold text-zinc-900">{user.full_name || 'Welcome'}</h1>
        <p className="text-zinc-400 text-sm mt-0.5" dir="ltr">{user.phone}</p>
      </div>

      {/* Favorites */}
      {favorites.length > 0 && (
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Heart className="w-4 h-4 text-rose-500" />
            <h2 className="font-bold text-zinc-900 text-sm">Favorites</h2>
          </div>
          <div className="space-y-2">
            {favorites.map((b) => (
              <SavedBusinessRow key={b.businessId} b={b} />
            ))}
          </div>
        </section>
      )}

      {/* My Businesses */}
      {saved.length > 0 && (
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="w-4 h-4 text-violet-600" />
            <h2 className="font-bold text-zinc-900 text-sm">My Businesses</h2>
          </div>
          <div className="space-y-2">
            {saved.map((b) => (
              <SavedBusinessRow key={b.businessId} b={b} />
            ))}
          </div>
        </section>
      )}

      {/* Menu list */}
      <div className="space-y-2">
        {MENU_ITEMS.map(({ label, icon: Icon, href, badge }) => (
          <Link
            key={label}
            href={href}
            className="flex items-center gap-3 bg-white border border-zinc-100 rounded-2xl px-4 py-3.5 shadow-sm hover:shadow-md transition-shadow active:scale-[0.98]"
          >
            <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0">
              <Icon className="w-4.5 h-4.5 text-violet-600" />
            </div>
            <span className="flex-1 font-medium text-zinc-800 text-sm">{label}</span>
            {badge && (
              <span className="text-[10px] font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">{badge}</span>
            )}
            <ChevronRight className="w-4 h-4 text-zinc-300 flex-shrink-0" />
          </Link>
        ))}
        {LEGAL_ITEMS.map(({ label, icon: Icon, href }) => (
          <Link key={label} href={href} className="flex items-center gap-3 bg-white border border-zinc-100 rounded-2xl px-4 py-3.5 shadow-sm hover:shadow-md transition-shadow active:scale-[0.98]">
            <div className="w-9 h-9 rounded-xl bg-zinc-50 flex items-center justify-center flex-shrink-0">
              <Icon className="w-4.5 h-4.5 text-zinc-500" />
            </div>
            <span className="flex-1 font-medium text-zinc-800 text-sm">{label}</span>
            <ChevronRight className="w-4 h-4 text-zinc-300 flex-shrink-0" />
          </Link>
        ))}
        <LogoutButton />
      </div>

      <p className="text-center text-xs text-zinc-300 mt-8">Booklyt · v1.0</p>
    </div>
  )
}

function SavedBusinessRow({ b }: { b: Awaited<ReturnType<typeof getSavedBusinesses>>[number] }) {
  return (
    <div className="flex items-center gap-3 bg-white border border-zinc-100 rounded-2xl px-4 py-3 shadow-sm">
      <Link href={`/app/${b.slug}`} className="flex items-center gap-3 flex-1 min-w-0">
        {b.logoUrl ? (
          <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0">
            <Image src={b.logoUrl} alt={b.name} width={40} height={40} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0 text-violet-700 font-bold text-sm">
            {b.name.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-zinc-900 text-sm truncate">{b.name}</p>
          <p className="text-xs text-zinc-400 capitalize truncate">
            {b.category ?? 'general'} · {b.visitCount} {b.visitCount === 1 ? 'visit' : 'visits'}
          </p>
        </div>
      </Link>
      <MuteButton businessId={b.businessId} initialEnabled={b.notificationsEnabled} />
      <FavoriteButton businessId={b.businessId} initialFavorite={b.favorite} />
    </div>
  )
}
