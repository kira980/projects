'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { CalendarDays, Phone, Mail, Search, Clock, CheckCircle2, XCircle, AlertCircle, MapPin, CalendarPlus, MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { icsDataUrl } from '@/lib/ics'
import type { CustomerAppointment } from '@/lib/marketplace/queries'

type Tab = 'upcoming' | 'past' | 'cancelled'

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function StatusBadge({ status }: { status: CustomerAppointment['status'] }) {
  if (status === 'confirmed' || status === 'pending') {
    return (
      <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
        <CheckCircle2 className="w-2.5 h-2.5" />
        {status === 'confirmed' ? 'Confirmed' : 'Pending'}
      </span>
    )
  }
  if (status === 'completed') {
    return (
      <span className="flex items-center gap-1 text-[10px] font-semibold text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-full">
        <Clock className="w-2.5 h-2.5" />
        Completed
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1 text-[10px] font-semibold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
      <XCircle className="w-2.5 h-2.5" />
      Cancelled
    </span>
  )
}

function AppointmentCard({ appt }: { appt: CustomerAppointment }) {
  const biz = appt.business
  return (
    <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Business logo */}
          <div
            className="w-11 h-11 rounded-xl flex-shrink-0 flex items-center justify-center text-white font-bold text-sm overflow-hidden"
            style={{ background: biz?.primaryColor ?? '#7c3aed' }}
          >
            {biz?.logoUrl
              ? <Image src={biz.logoUrl} alt={biz.name} width={44} height={44} className="w-full h-full object-cover" />
              : biz?.name.slice(0, 2).toUpperCase()
            }
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-zinc-900 text-sm truncate">{biz?.name ?? 'Business'}</p>
                <p className="text-xs text-zinc-400 truncate">{appt.service?.name ?? 'Service'}</p>
              </div>
              <StatusBadge status={appt.status} />
            </div>

            <div className="flex items-center gap-3 mt-2">
              <div className="flex items-center gap-1 text-zinc-500">
                <CalendarDays className="w-3 h-3" />
                <span className="text-[11px]">{formatDate(appt.appointmentDate)}</span>
              </div>
              <div className="flex items-center gap-1 text-zinc-500">
                <Clock className="w-3 h-3" />
                <span className="text-[11px]">{appt.startTime.slice(0, 5)}</span>
              </div>
              {appt.service?.price != null && (
                <span className="text-[11px] font-semibold text-zinc-700 ml-auto">${appt.service.price}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {appt.manageToken && (appt.status === 'confirmed' || appt.status === 'pending') && (
        <div className="border-t border-zinc-50 px-4 py-2.5 flex gap-2">
          <Link
            href={`/manage-booking/${appt.manageToken}`}
            className="flex-1 text-center text-xs font-semibold text-violet-600 py-1.5 rounded-xl bg-violet-50"
          >
            Manage booking
          </Link>
          {biz?.slug && (
            <Link
              href={`/app/business/${biz.slug}`}
              className="flex-1 text-center text-xs font-semibold text-zinc-600 py-1.5 rounded-xl bg-zinc-50"
            >
              View business
            </Link>
          )}
        </div>
      )}

      {(appt.status === 'confirmed' || appt.status === 'pending') && (
        <div className="border-t border-zinc-50 px-4 py-2.5 grid grid-cols-3 gap-2">
          {biz?.address ? (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(biz.address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1 text-[11px] font-semibold text-zinc-600 py-1.5 rounded-xl bg-zinc-50"
            >
              <MapPin className="w-3 h-3" /> Directions
            </a>
          ) : <span />}
          {biz?.phone ? (
            <a
              href={`https://wa.me/${biz.phone.replace(/[^0-9]/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1 text-[11px] font-semibold text-zinc-600 py-1.5 rounded-xl bg-zinc-50"
            >
              <MessageCircle className="w-3 h-3" /> Contact
            </a>
          ) : <span />}
          <a
            href={icsDataUrl({
              title: `${appt.service?.name ?? 'Appointment'} · ${biz?.name ?? 'Booking'}`,
              date: appt.appointmentDate,
              startTime: appt.startTime,
              endTime: appt.endTime,
              location: biz?.address ?? undefined,
              description: biz?.name ? `Booking at ${biz.name}` : undefined,
            })}
            download={`booking-${appt.appointmentDate}.ics`}
            className="flex items-center justify-center gap-1 text-[11px] font-semibold text-zinc-600 py-1.5 rounded-xl bg-zinc-50"
          >
            <CalendarPlus className="w-3 h-3" /> Calendar
          </a>
        </div>
      )}
    </div>
  )
}

export default function BookingsPage() {
  const [tab, setTab] = useState<Tab>('upcoming')
  const [lookupMode, setLookupMode] = useState(false)
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [appointments, setAppointments] = useState<CustomerAppointment[] | null>(null)
  const [error, setError] = useState('')
  const [checkingSession, setCheckingSession] = useState(true)
  const [sessionUser, setSessionUser] = useState(false)

  // Signed-in customers see all their bookings automatically (across businesses);
  // the phone/email lookup below stays as the logged-out fallback.
  useEffect(() => {
    let cancelled = false
    fetch('/api/customer/bookings')
      .then(async (res) => {
        if (cancelled) return
        if (res.ok) {
          const data = await res.json()
          setAppointments(data.appointments ?? [])
          setSessionUser(true)
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setCheckingSession(false) })
    return () => { cancelled = true }
  }, [])

  const handleLookup = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!phone && !email) return
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (phone) params.set('phone', phone)
      if (email) params.set('email', email)
      const res = await fetch(`/api/marketplace/bookings?${params}`)
      if (!res.ok) throw new Error('Failed to fetch bookings')
      const data = await res.json()
      setAppointments(data.appointments ?? [])
    } catch {
      setError('Could not find bookings. Please check your details and try again.')
    } finally {
      setLoading(false)
    }
  }, [phone, email])

  const now = new Date().toISOString().slice(0, 10)

  const filtered = appointments
    ? appointments.filter(a => {
        if (tab === 'cancelled') return a.status === 'cancelled'
        if (tab === 'past') return a.status === 'completed' || (a.appointmentDate < now && a.status !== 'cancelled')
        return (a.status === 'confirmed' || a.status === 'pending') && a.appointmentDate >= now
      })
    : []

  if (checkingSession && appointments === null) {
    return (
      <div className="px-5 pt-14 pb-8">
        <h1 className="text-2xl font-extrabold text-zinc-900 mb-1">Your bookings</h1>
        <p className="text-zinc-400 text-sm mb-8">View and manage your appointments</p>
        <div className="space-y-3">
          {Array(3).fill(0).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-zinc-100 shadow-sm h-24 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (!lookupMode && appointments === null) {
    return (
      <div className="px-5 pt-14 pb-8">
        <h1 className="text-2xl font-extrabold text-zinc-900 mb-1">Your bookings</h1>
        <p className="text-zinc-400 text-sm mb-8">View and manage your appointments</p>

        <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm p-6 text-center">
          <CalendarDays className="w-12 h-12 text-violet-200 mx-auto mb-3" />
          <h2 className="font-bold text-zinc-900 mb-1">Find your bookings</h2>
          <p className="text-zinc-400 text-sm mb-5">Enter your phone or email to look up appointments</p>
          <button
            onClick={() => setLookupMode(true)}
            className="bg-violet-600 hover:bg-violet-700 text-white font-bold px-6 py-2.5 rounded-2xl text-sm"
          >
            Look up bookings
          </button>
        </div>
      </div>
    )
  }

  if (lookupMode && appointments === null) {
    return (
      <div className="px-5 pt-14 pb-8 max-w-sm mx-auto">
        <h1 className="text-2xl font-extrabold text-zinc-900 mb-1">Find your bookings</h1>
        <p className="text-zinc-400 text-sm mb-6">Enter your phone or email address</p>

        <form onSubmit={handleLookup} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-zinc-500 mb-1 block">Phone number</label>
            <div className="flex items-center gap-2 bg-zinc-100 rounded-2xl px-3.5 py-2.5">
              <Phone className="w-4 h-4 text-zinc-400" />
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
                className="flex-1 text-sm bg-transparent outline-none text-zinc-900 placeholder:text-zinc-400"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-zinc-200" />
            <span className="text-xs text-zinc-400">or</span>
            <div className="flex-1 h-px bg-zinc-200" />
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-500 mb-1 block">Email address</label>
            <div className="flex items-center gap-2 bg-zinc-100 rounded-2xl px-3.5 py-2.5">
              <Mail className="w-4 h-4 text-zinc-400" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="flex-1 text-sm bg-transparent outline-none text-zinc-900 placeholder:text-zinc-400"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-500 text-xs bg-red-50 px-3 py-2 rounded-xl">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={(!phone && !email) || loading}
            className="w-full bg-violet-600 disabled:opacity-50 text-white font-bold py-3 rounded-2xl text-sm flex items-center justify-center gap-2"
          >
            {loading ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Search className="w-4 h-4" />}
            {loading ? 'Searching...' : 'Find bookings'}
          </button>
          <button
            type="button"
            onClick={() => setLookupMode(false)}
            className="w-full text-zinc-400 text-sm py-2"
          >
            Cancel
          </button>
        </form>
      </div>
    )
  }

  return (
    <div>
      <div className="px-5 pt-12 pb-3">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl font-extrabold text-zinc-900">Your bookings</h1>
          {!sessionUser && (
            <button
              onClick={() => { setAppointments(null); setLookupMode(false); setPhone(''); setEmail('') }}
              className="text-xs text-violet-600 font-medium"
            >
              Change
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-5 mb-4">
        {(['upcoming', 'past', 'cancelled'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 py-2 text-xs font-semibold rounded-xl capitalize transition-colors',
              tab === t ? 'bg-violet-600 text-white' : 'bg-zinc-100 text-zinc-500'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="px-5 space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-zinc-400">
            <CalendarDays className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No {tab} bookings</p>
          </div>
        ) : (
          filtered.map(a => <AppointmentCard key={a.id} appt={a} />)
        )}
      </div>
    </div>
  )
}
