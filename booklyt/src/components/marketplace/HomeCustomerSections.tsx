/**
 * Logged-in sections of the Booklyt customer home:
 * Upcoming Bookings · My Businesses (recently used) · Favorites · Book Again.
 * Server component — rendered only when a bf_user session exists.
 */
import Link from 'next/link'
import Image from 'next/image'
import { CalendarDays, Clock, Heart, History, ChevronRight, RotateCcw } from 'lucide-react'
import { getSavedBusinesses, type SavedBusiness } from '@/lib/customer/businesses'
import { getCustomerBookingsByUserId, type CustomerAppointment } from '@/lib/marketplace/queries'

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function BusinessBubble({ b }: { b: SavedBusiness }) {
  return (
    <Link href={`/app/${b.slug}`} className="flex flex-col items-center gap-1.5 w-16 flex-shrink-0">
      {b.logoUrl ? (
        <div className="w-14 h-14 rounded-2xl overflow-hidden shadow-sm border border-zinc-100">
          <Image src={b.logoUrl} alt={b.name} width={56} height={56} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="w-14 h-14 rounded-2xl bg-violet-100 flex items-center justify-center text-violet-700 font-bold text-sm shadow-sm">
          {b.name.slice(0, 2).toUpperCase()}
        </div>
      )}
      <span className="text-[10px] font-medium text-zinc-600 truncate w-full text-center">{b.name}</span>
    </Link>
  )
}

function UpcomingCard({ appt }: { appt: CustomerAppointment }) {
  const biz = appt.business
  const inner = (
    <div className="flex items-center gap-3 bg-white border border-zinc-100 rounded-2xl px-4 py-3 shadow-sm">
      <div
        className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center text-white font-bold text-xs overflow-hidden"
        style={{ background: biz?.primaryColor ?? '#7c3aed' }}
      >
        {biz?.logoUrl
          ? <Image src={biz.logoUrl} alt={biz.name} width={40} height={40} className="w-full h-full object-cover" />
          : biz?.name.slice(0, 2).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-zinc-900 text-sm truncate">{biz?.name ?? 'Business'}</p>
        <p className="text-xs text-zinc-400 truncate">{appt.service?.name ?? 'Appointment'}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-xs font-bold text-zinc-800 flex items-center gap-1 justify-end">
          <CalendarDays className="w-3 h-3 text-violet-500" /> {formatDate(appt.appointmentDate)}
        </p>
        <p className="text-[11px] text-zinc-400 flex items-center gap-1 justify-end mt-0.5">
          <Clock className="w-3 h-3" /> {appt.startTime.slice(0, 5)}
        </p>
      </div>
    </div>
  )
  return appt.manageToken
    ? <Link href={`/manage-booking/${appt.manageToken}`}>{inner}</Link>
    : inner
}

export async function HomeCustomerSections({ customerUserId }: { customerUserId: string }) {
  const [saved, bookings] = await Promise.all([
    getSavedBusinesses(customerUserId),
    getCustomerBookingsByUserId(customerUserId),
  ])

  const today = new Date().toISOString().slice(0, 10)
  const upcoming = bookings
    .filter((a) => (a.status === 'confirmed' || a.status === 'pending') && a.appointmentDate >= today)
    .sort((a, b) => (a.appointmentDate + a.startTime).localeCompare(b.appointmentDate + b.startTime))
    .slice(0, 3)

  const favorites = saved.filter((b) => b.favorite)

  // Book Again: most recent past bookings, one per business
  const seen = new Set<string>()
  const bookAgain = bookings.filter((a) => {
    if (!a.business || a.appointmentDate >= today || a.status === 'cancelled') return false
    if (seen.has(a.business.slug)) return false
    seen.add(a.business.slug)
    return true
  }).slice(0, 4)

  if (!saved.length && !bookings.length) return null

  return (
    <div className="space-y-6 px-5 pb-6">
      {upcoming.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-zinc-900 text-base">Upcoming bookings</h2>
            <Link href="/app/bookings" className="text-violet-600 text-xs font-medium flex items-center gap-0.5">
              All <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {upcoming.map((a) => <UpcomingCard key={a.id} appt={a} />)}
          </div>
        </section>
      )}

      {saved.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <History className="w-4 h-4 text-violet-600" />
            <h2 className="font-bold text-zinc-900 text-base">My businesses</h2>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1 -mx-5 px-5 scrollbar-none">
            {saved.slice(0, 12).map((b) => <BusinessBubble key={b.businessId} b={b} />)}
          </div>
        </section>
      )}

      {favorites.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Heart className="w-4 h-4 text-rose-500" />
            <h2 className="font-bold text-zinc-900 text-base">Favorites</h2>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1 -mx-5 px-5 scrollbar-none">
            {favorites.slice(0, 12).map((b) => <BusinessBubble key={b.businessId} b={b} />)}
          </div>
        </section>
      )}

      {bookAgain.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <RotateCcw className="w-4 h-4 text-violet-600" />
            <h2 className="font-bold text-zinc-900 text-base">Book again</h2>
          </div>
          <div className="space-y-2">
            {bookAgain.map((a) => (
              <Link
                key={a.id}
                href={`/app/${a.business!.slug}`}
                className="flex items-center gap-3 bg-white border border-zinc-100 rounded-2xl px-4 py-3 shadow-sm"
              >
                <div
                  className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center text-white font-bold text-xs overflow-hidden"
                  style={{ background: a.business?.primaryColor ?? '#7c3aed' }}
                >
                  {a.business?.logoUrl
                    ? <Image src={a.business.logoUrl} alt={a.business.name} width={40} height={40} className="w-full h-full object-cover" />
                    : a.business?.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-zinc-900 text-sm truncate">{a.business?.name}</p>
                  <p className="text-xs text-zinc-400 truncate">
                    {a.service?.name ?? 'Service'} · last {formatDate(a.appointmentDate)}
                  </p>
                </div>
                <span className="text-xs font-bold text-violet-600 bg-violet-50 px-3 py-1.5 rounded-xl flex-shrink-0">Book</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
