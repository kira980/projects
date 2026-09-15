'use client'

import { useState, useMemo } from 'react'
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isToday, parseISO, addMonths, subMonths,
} from 'date-fns'
import {
  CalendarDays, ChevronLeft, ChevronRight, Check, X, Phone,
  MessageCircle, Clock, User, Users, LayoutList, DollarSign,
  ClipboardList,
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { getInitials, formatCurrency } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────────

export type CalendarAppointment = {
  id: string
  appointment_date: string
  start_time: string
  end_time: string
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed'
  customer_name: string
  customer_phone?: string | null
  customer_email?: string | null
  participants_count?: number
  service_name?: string | null
  staff_name?: string | null
  service_price?: number | null
  customer_confirmed_at?: string | null
}

export type CalendarWaitlistEntry = {
  id: string
  preferred_date: string
  status: 'active' | 'notified' | 'booked' | 'cancelled'
  customer_name: string
  customer_phone?: string | null
  customer_email?: string | null
  service_name?: string | null
  preferred_eras?: string[]
}

type Status = CalendarAppointment['status']

interface Props {
  appointments: CalendarAppointment[]
  waitlistEntries?: CalendarWaitlistEntry[]
  loading?: boolean
  businessName?: string
  timeFormat?: '12h' | '24h'
  onUpdateStatus: (id: string, status: Status) => void | Promise<void>
}

// ── Status color maps ──────────────────────────────────────────────────────────

const STATUS_PILL: Record<Status, string> = {
  pending:   'bg-amber-50 text-amber-700 border border-amber-100',
  confirmed: 'bg-violet-50 text-violet-700 border border-violet-100',
  completed: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
  cancelled: 'bg-zinc-100 text-zinc-400 border border-zinc-200',
}

const STATUS_BADGE: Record<Status, string> = {
  pending:   'bg-amber-50 text-amber-700 border-amber-200',
  confirmed: 'bg-violet-50 text-violet-700 border-violet-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-zinc-100 text-zinc-500 border-zinc-200',
}

const STATUS_LABEL: Record<Status, string> = {
  pending:   'Pending',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

const WAITLIST_PILL: Record<string, string> = {
  active:   'bg-red-50 text-red-700 border border-red-100',
  notified: 'bg-amber-50 text-amber-700 border border-amber-100',
  booked:   'bg-emerald-50 text-emerald-700 border border-emerald-100',
}

const WAITLIST_BADGE: Record<string, string> = {
  active:   'bg-red-50 text-red-700 border-red-200',
  notified: 'bg-amber-50 text-amber-700 border-amber-200',
  booked:   'bg-emerald-50 text-emerald-700 border-emerald-200',
}

const WAITLIST_STATUS_LABEL: Record<string, string> = {
  active:   'Waiting',
  notified: 'Notified',
  booked:   'Booked',
}

const ERA_LABEL: Record<string, string> = {
  morning: 'Morning (6–12)',
  noon:    'Noon (12–5)',
  evening: 'Evening (5–10)',
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtTime(time: string, format: '12h' | '24h' = '12h') {
  const [h, m] = time.split(':').map(Number)
  if (format === '24h') return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
  const p = h < 12 ? 'AM' : 'PM'
  const dh = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${dh}:${m.toString().padStart(2, '0')} ${p}`
}

// ── Main component ─────────────────────────────────────────────────────────────

export function AppointmentCalendar({ appointments, waitlistEntries, loading, businessName, timeFormat = '12h', onUpdateStatus }: Props) {
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar')
  const [dataMode, setDataMode] = useState<'appointments' | 'waitlist'>('appointments')
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selected, setSelected] = useState<CalendarAppointment | null>(null)
  const [selectedWl, setSelectedWl] = useState<CalendarWaitlistEntry | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [dayView, setDayView] = useState<string | null>(null) // 'yyyy-MM-dd' when day panel is open

  const today = new Date().toISOString().slice(0, 10)

  // ── Calendar grid ────────────────────────────────────────────────────────────
  const weeks = useMemo(() => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    const days = eachDayOfInterval({ start: startOfWeek(monthStart), end: endOfWeek(monthEnd) })
    const ws: Date[][] = []
    for (let i = 0; i < days.length; i += 7) ws.push(days.slice(i, i + 7))
    return ws
  }, [currentMonth])

  const appointmentsByDate = useMemo(() => {
    const map = new Map<string, CalendarAppointment[]>()
    appointments.forEach(a => {
      if (!map.has(a.appointment_date)) map.set(a.appointment_date, [])
      map.get(a.appointment_date)!.push(a)
    })
    return map
  }, [appointments])

  const waitlistByDate = useMemo(() => {
    const map = new Map<string, CalendarWaitlistEntry[]>()
    ;(waitlistEntries ?? []).forEach(e => {
      if (!map.has(e.preferred_date)) map.set(e.preferred_date, [])
      map.get(e.preferred_date)!.push(e)
    })
    return map
  }, [waitlistEntries])

  const upcoming = useMemo(() =>
    appointments
      .filter(a => a.appointment_date >= today && a.status !== 'cancelled')
      .sort((a, b) => `${a.appointment_date}${a.start_time}`.localeCompare(`${b.appointment_date}${b.start_time}`)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [appointments])

  const upcomingWaitlist = useMemo(() =>
    (waitlistEntries ?? [])
      .filter(e => e.preferred_date >= today && e.status !== 'cancelled')
      .sort((a, b) => a.preferred_date.localeCompare(b.preferred_date)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [waitlistEntries])

  const activeWaitlistCount = (waitlistEntries ?? []).filter(e => e.status !== 'cancelled').length

  // ── Actions ──────────────────────────────────────────────────────────────────

  const handleUpdate = async (id: string, status: Status) => {
    setSaving(id)
    await onUpdateStatus(id, status)
    setSaving(null)
    setSelected(prev => (prev?.id === id ? { ...prev, status } : prev))
  }

  // ── Appointment detail modal ──────────────────────────────────────────────────

  const appointmentModal = selected && (() => {
    const appt = selected
    const phone = appt.customer_phone
    const waMsg = `Hi ${appt.customer_name}, this is a reminder for your appointment${businessName ? ` at ${businessName}` : ''} on ${format(parseISO(`${appt.appointment_date}T00:00:00`), 'EEE MMM d')} at ${fmtTime(appt.start_time, timeFormat)}.`
    const waUrl = phone ? `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(waMsg)}` : null
    const isBusy = saving === appt.id

    return (
      <Dialog open onOpenChange={v => !v && setSelected(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 font-normal">
              <Avatar className="h-11 w-11 shrink-0">
                <AvatarFallback className="text-sm font-semibold">{getInitials(appt.customer_name)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-bold text-zinc-950">{appt.customer_name}</p>
                <p className="text-xs text-zinc-500 font-normal mt-0.5">
                  {format(parseISO(`${appt.appointment_date}T00:00:00`), 'EEEE, MMMM d yyyy')}
                </p>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className={`${STATUS_BADGE[appt.status]} text-xs`}>
                {STATUS_LABEL[appt.status]}
              </Badge>
              {appt.customer_confirmed_at && (
                <span className="text-xs text-emerald-600 flex items-center gap-1 font-medium">
                  <Check className="w-3 h-3" />
                  Customer confirmed attendance
                </span>
              )}
            </div>

            <div className="rounded-xl bg-zinc-50 p-4 space-y-2.5">
              <DetailRow icon={<Clock className="w-4 h-4 text-zinc-400 shrink-0" />}>
                {fmtTime(appt.start_time, timeFormat)} – {fmtTime(appt.end_time, timeFormat)}
              </DetailRow>
              {appt.service_name && (
                <DetailRow icon={<CalendarDays className="w-4 h-4 text-zinc-400 shrink-0" />}>
                  {appt.service_name}
                </DetailRow>
              )}
              {appt.staff_name && (
                <DetailRow icon={<User className="w-4 h-4 text-zinc-400 shrink-0" />}>
                  with {appt.staff_name}
                </DetailRow>
              )}
              {(appt.participants_count ?? 1) > 1 && (
                <DetailRow icon={<Users className="w-4 h-4 text-zinc-400 shrink-0" />}>
                  {appt.participants_count} participants
                </DetailRow>
              )}
              {appt.service_price != null && (
                <DetailRow icon={<DollarSign className="w-4 h-4 text-zinc-400 shrink-0" />}>
                  {formatCurrency(appt.service_price)}
                </DetailRow>
              )}
              {appt.customer_email && (
                <DetailRow icon={<span className="w-4 h-4 text-zinc-400 shrink-0 flex items-center justify-center text-[10px] font-bold">@</span>}>
                  {appt.customer_email}
                </DetailRow>
              )}
              {phone && (
                <DetailRow icon={<Phone className="w-4 h-4 text-zinc-400 shrink-0" />}>
                  {phone}
                </DetailRow>
              )}
            </div>

            {phone && (
              <div className="flex gap-2">
                <a href={`tel:${phone}`} className="flex-1">
                  <Button type="button" variant="outline" size="sm" className="w-full gap-1.5">
                    <Phone className="w-3.5 h-3.5" />
                    Call
                  </Button>
                </a>
                {waUrl && (
                  <a href={waUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
                    <Button type="button" variant="outline" size="sm" className="w-full gap-1.5 text-green-700 border-green-200 hover:bg-green-50">
                      <MessageCircle className="w-3.5 h-3.5" />
                      WhatsApp
                    </Button>
                  </a>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {appt.status === 'pending' && (
                <>
                  <Button size="sm" disabled={isBusy} onClick={() => handleUpdate(appt.id, 'confirmed')} className="gap-1.5">
                    {isBusy ? null : <Check className="w-3.5 h-3.5" />}
                    Confirm
                  </Button>
                  <Button size="sm" variant="outline" disabled={isBusy} onClick={() => handleUpdate(appt.id, 'cancelled')} className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50">
                    <X className="w-3.5 h-3.5" />
                    Cancel
                  </Button>
                </>
              )}
              {appt.status === 'confirmed' && (
                <>
                  <Button size="sm" variant="outline" disabled={isBusy} onClick={() => handleUpdate(appt.id, 'completed')} className="gap-1.5 text-emerald-700 border-emerald-200 hover:bg-emerald-50">
                    <Check className="w-3.5 h-3.5" />
                    Mark done
                  </Button>
                  <Button size="sm" variant="outline" disabled={isBusy} onClick={() => handleUpdate(appt.id, 'cancelled')} className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50">
                    <X className="w-3.5 h-3.5" />
                    Cancel
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  })()

  // ── Waitlist detail modal ─────────────────────────────────────────────────────

  const waitlistModal = selectedWl && (() => {
    const wl = selectedWl
    const phone = wl.customer_phone
    const waUrl = phone ? `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hi ${wl.customer_name}, a spot just opened up on ${wl.preferred_date}! Book now.`)}` : null

    return (
      <Dialog open onOpenChange={v => !v && setSelectedWl(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 font-normal">
              <Avatar className="h-11 w-11 shrink-0">
                <AvatarFallback className="text-sm font-semibold">{getInitials(wl.customer_name)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-bold text-zinc-950">{wl.customer_name}</p>
                <p className="text-xs text-zinc-500 font-normal mt-0.5">
                  Waitlist · {format(parseISO(`${wl.preferred_date}T00:00:00`), 'EEEE, MMMM d yyyy')}
                </p>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <Badge variant="outline" className={`text-xs ${WAITLIST_BADGE[wl.status] ?? 'bg-zinc-50 text-zinc-500 border-zinc-200'}`}>
              {WAITLIST_STATUS_LABEL[wl.status] ?? wl.status}
            </Badge>

            <div className="rounded-xl bg-zinc-50 p-4 space-y-2.5">
              {wl.service_name && (
                <DetailRow icon={<CalendarDays className="w-4 h-4 text-zinc-400 shrink-0" />}>
                  {wl.service_name}
                </DetailRow>
              )}
              {wl.customer_email && (
                <DetailRow icon={<span className="w-4 h-4 text-zinc-400 shrink-0 flex items-center justify-center text-[10px] font-bold">@</span>}>
                  {wl.customer_email}
                </DetailRow>
              )}
              {phone && (
                <DetailRow icon={<Phone className="w-4 h-4 text-zinc-400 shrink-0" />}>
                  {phone}
                </DetailRow>
              )}
              {(wl.preferred_eras ?? []).length > 0 && (
                <DetailRow icon={<Clock className="w-4 h-4 text-zinc-400 shrink-0" />}>
                  <div className="flex flex-wrap gap-1">
                    {(wl.preferred_eras ?? []).map(era => (
                      <span key={era} className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-medium text-zinc-600">
                        {ERA_LABEL[era] ?? era}
                      </span>
                    ))}
                  </div>
                </DetailRow>
              )}
            </div>

            {phone && (
              <div className="flex gap-2">
                <a href={`tel:${phone}`} className="flex-1">
                  <Button type="button" variant="outline" size="sm" className="w-full gap-1.5">
                    <Phone className="w-3.5 h-3.5" />
                    Call
                  </Button>
                </a>
                {waUrl && (
                  <a href={waUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
                    <Button type="button" variant="outline" size="sm" className="w-full gap-1.5 text-green-700 border-green-200 hover:bg-green-50">
                      <MessageCircle className="w-3.5 h-3.5" />
                      WhatsApp
                    </Button>
                  </a>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    )
  })()

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Toolbar: data mode + view mode toggles */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        {/* Data mode toggle (only show Waitlist tab when prop is provided) */}
        <div className="flex rounded-lg border bg-white overflow-hidden w-fit">
          <ViewToggleBtn active={dataMode === 'appointments'} onClick={() => setDataMode('appointments')}>
            <CalendarDays className="w-3.5 h-3.5" /> Appointments
          </ViewToggleBtn>
          {waitlistEntries !== undefined && (
            <ViewToggleBtn active={dataMode === 'waitlist'} onClick={() => setDataMode('waitlist')}>
              <ClipboardList className="w-3.5 h-3.5" /> Waitlist
              {activeWaitlistCount > 0 && (
                <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold leading-none ${
                  dataMode === 'waitlist' ? 'bg-white/20 text-white' : 'bg-red-100 text-red-600'
                }`}>
                  {activeWaitlistCount}
                </span>
              )}
            </ViewToggleBtn>
          )}
        </div>

        {/* View mode toggle */}
        <div className="flex rounded-lg border bg-white overflow-hidden w-fit">
          <ViewToggleBtn active={viewMode === 'calendar'} onClick={() => setViewMode('calendar')}>
            <CalendarDays className="w-3.5 h-3.5" /> Calendar
          </ViewToggleBtn>
          <ViewToggleBtn active={viewMode === 'list'} onClick={() => setViewMode('list')}>
            <LayoutList className="w-3.5 h-3.5" /> List
          </ViewToggleBtn>
        </div>
      </div>

      {/* ── Calendar view ── */}
      {viewMode === 'calendar' && (
        <div className="rounded-xl border bg-white overflow-hidden">
          {/* Month navigation */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-zinc-50">
            <button
              type="button"
              onClick={() => setCurrentMonth(m => subMonths(m, 1))}
              className="p-1.5 rounded-lg hover:bg-zinc-200 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h3 className="font-semibold text-sm">{format(currentMonth, 'MMMM yyyy')}</h3>
            <button
              type="button"
              onClick={() => setCurrentMonth(m => addMonths(m, 1))}
              className="p-1.5 rounded-lg hover:bg-zinc-200 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 border-b">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="py-2 text-center text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 border-b last:border-b-0 divide-x">
              {week.map((day, di) => {
                const key = format(day, 'yyyy-MM-dd')
                const isThisMonth = day.getMonth() === currentMonth.getMonth()
                const isThisDay = isToday(day)

                if (dataMode === 'appointments') {
                  const dayAppts = (appointmentsByDate.get(key) ?? [])
                    .sort((a, b) => a.start_time.localeCompare(b.start_time))
                  const activeAppts = dayAppts.filter(a => a.status !== 'cancelled')

                  return (
                    <div
                      key={di}
                      onClick={() => { if (isThisMonth) setDayView(key) }}
                      className={`min-h-[80px] sm:min-h-[100px] p-1 cursor-pointer transition-colors hover:bg-zinc-50 ${!isThisMonth ? 'bg-zinc-50/50 cursor-default' : ''}`}
                    >
                      <div className="flex justify-center mb-1">
                        <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-semibold select-none ${
                          isThisDay ? 'bg-zinc-900 text-white' : isThisMonth ? 'text-zinc-700' : 'text-zinc-300'
                        }`}>
                          {day.getDate()}
                        </span>
                      </div>
                      <div className="space-y-0.5" onClick={e => e.stopPropagation()}>
                        {activeAppts.slice(0, 3).map(appt => (
                          <button
                            key={appt.id}
                            type="button"
                            onClick={() => setSelected(appt)}
                            title={`${appt.customer_name} · ${fmtTime(appt.start_time, timeFormat)}`}
                            className={`w-full text-left px-1 py-0.5 rounded text-[10px] leading-snug font-medium truncate transition-opacity hover:opacity-75 ${STATUS_PILL[appt.status]}`}
                          >
                            <span className="hidden sm:inline">
                              {appt.customer_name.split(' ')[0]} · {appt.start_time.slice(0, 5)}
                            </span>
                            <span className="sm:hidden">●</span>
                          </button>
                        ))}
                        {activeAppts.length > 3 && (
                          <p className="w-full text-center text-[9px] text-zinc-400 leading-none pt-0.5">
                            +{activeAppts.length - 3} more
                          </p>
                        )}
                      </div>
                    </div>
                  )
                }

                // Waitlist mode
                const dayWl = (waitlistByDate.get(key) ?? []).filter(e => e.status !== 'cancelled')
                return (
                  <div
                    key={di}
                    onClick={() => { if (isThisMonth) setDayView(key) }}
                    className={`min-h-[80px] sm:min-h-[100px] p-1 cursor-pointer transition-colors hover:bg-zinc-50 ${!isThisMonth ? 'bg-zinc-50/50 cursor-default' : ''}`}
                  >
                    <div className="flex justify-center mb-1">
                      <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-semibold select-none ${
                        isThisDay ? 'bg-zinc-900 text-white' : isThisMonth ? 'text-zinc-700' : 'text-zinc-300'
                      }`}>
                        {day.getDate()}
                      </span>
                    </div>
                    <div className="space-y-0.5" onClick={e => e.stopPropagation()}>
                      {dayWl.slice(0, 3).map(entry => (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() => setSelectedWl(entry)}
                          title={`${entry.customer_name} · ${WAITLIST_STATUS_LABEL[entry.status] ?? entry.status}`}
                          className={`w-full text-left px-1 py-0.5 rounded text-[10px] leading-snug font-medium truncate transition-opacity hover:opacity-75 ${WAITLIST_PILL[entry.status] ?? 'bg-zinc-100 text-zinc-500 border border-zinc-200'}`}
                        >
                          <span className="hidden sm:inline">
                            {entry.customer_name.split(' ')[0]}
                          </span>
                          <span className="sm:hidden">●</span>
                        </button>
                      ))}
                      {dayWl.length > 3 && (
                        <p className="w-full text-center text-[9px] text-zinc-400 leading-none pt-0.5">
                          +{dayWl.length - 3} more
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}

      {/* ── List view ── */}
      {viewMode === 'list' && dataMode === 'appointments' && (
        <div className="space-y-2">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-[60px] rounded-xl bg-zinc-100 animate-pulse" />
            ))
          ) : upcoming.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 py-12 text-center text-sm text-zinc-400">
              <CalendarDays className="mx-auto mb-2 h-5 w-5 opacity-50" />
              No upcoming appointments
            </div>
          ) : (
            upcoming.map(appt => (
              <button
                key={appt.id}
                type="button"
                onClick={() => setSelected(appt)}
                className="w-full rounded-xl border bg-white p-3 sm:p-4 flex items-center gap-3 text-left hover:shadow-sm transition-all active:bg-zinc-50"
              >
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarFallback className="text-xs font-semibold">{getInitials(appt.customer_name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm text-zinc-950 truncate">{appt.customer_name}</p>
                    <Badge variant="outline" className={`text-[10px] border shrink-0 ${STATUS_BADGE[appt.status]}`}>
                      {STATUS_LABEL[appt.status]}
                    </Badge>
                    {appt.customer_confirmed_at && (
                      <span className="text-[10px] text-emerald-600 flex items-center gap-0.5 font-medium shrink-0">
                        <Check className="w-2.5 h-2.5" />
                        confirmed
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 truncate mt-0.5">
                    {appt.service_name ?? 'Service'}
                    {appt.staff_name && <span className="text-zinc-400"> · {appt.staff_name}</span>}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-semibold text-zinc-700">
                    {format(parseISO(`${appt.appointment_date}T00:00:00`), 'MMM d')}
                  </p>
                  <p className="text-[10px] text-zinc-400 mt-0.5">
                    {fmtTime(appt.start_time, timeFormat)}–{fmtTime(appt.end_time, timeFormat)}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {/* ── Waitlist list view ── */}
      {viewMode === 'list' && dataMode === 'waitlist' && (
        <div className="space-y-2">
          {upcomingWaitlist.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 py-12 text-center text-sm text-zinc-400">
              <ClipboardList className="mx-auto mb-2 h-5 w-5 opacity-50" />
              No waitlist entries
            </div>
          ) : (
            upcomingWaitlist.map(entry => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setSelectedWl(entry)}
                className="w-full rounded-xl border bg-white p-3 sm:p-4 flex items-center gap-3 text-left hover:shadow-sm transition-all active:bg-zinc-50"
              >
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarFallback className="text-xs font-semibold">{getInitials(entry.customer_name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm text-zinc-950 truncate">{entry.customer_name}</p>
                    <Badge variant="outline" className={`text-[10px] border shrink-0 ${WAITLIST_BADGE[entry.status] ?? 'bg-zinc-50 border-zinc-200 text-zinc-500'}`}>
                      {WAITLIST_STATUS_LABEL[entry.status] ?? entry.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                    <p className="text-xs text-zinc-500 truncate">
                      {entry.service_name ?? 'Service'}
                    </p>
                    {(entry.preferred_eras ?? []).map(era => (
                      <span key={era} className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500 font-medium">
                        {era}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-semibold text-zinc-700">
                    {format(parseISO(`${entry.preferred_date}T00:00:00`), 'MMM d')}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {appointmentModal}
      {waitlistModal}

      {/* ── Day view dialog ── */}
      <Dialog open={!!dayView} onOpenChange={open => { if (!open) setDayView(null) }}>
        <DialogContent className="max-w-md max-h-[80vh] flex flex-col gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-3 border-b">
            <DialogTitle className="text-base font-semibold">
              {dayView ? format(parseISO(`${dayView}T00:00:00`), 'EEEE, MMMM d') : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 p-4">
            {dayView && dataMode === 'appointments' && (() => {
              const dayAppts = (appointmentsByDate.get(dayView) ?? [])
                .sort((a, b) => a.start_time.localeCompare(b.start_time))
              if (dayAppts.length === 0) return (
                <div className="py-10 text-center text-sm text-zinc-400">
                  <CalendarDays className="mx-auto mb-2 h-5 w-5 opacity-40" />
                  No appointments on this day
                </div>
              )
              return (
                <div className="space-y-2">
                  {dayAppts.map(appt => (
                    <button
                      key={appt.id}
                      type="button"
                      onClick={() => { setDayView(null); setSelected(appt) }}
                      className="w-full rounded-xl border bg-white p-3 flex items-center gap-3 text-left hover:shadow-sm transition-all"
                    >
                      <div className="flex flex-col items-center justify-center w-12 shrink-0 text-center">
                        <span className="text-xs font-bold text-zinc-700">{fmtTime(appt.start_time, timeFormat)}</span>
                        <span className="text-[10px] text-zinc-400">–{fmtTime(appt.end_time, timeFormat)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm text-zinc-950 truncate">{appt.customer_name}</p>
                          <Badge variant="outline" className={`text-[10px] border shrink-0 ${STATUS_BADGE[appt.status]}`}>
                            {STATUS_LABEL[appt.status]}
                          </Badge>
                        </div>
                        <p className="text-xs text-zinc-500 truncate mt-0.5">
                          {appt.service_name ?? 'Service'}
                          {appt.staff_name && <span className="text-zinc-400"> · {appt.staff_name}</span>}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )
            })()}
            {dayView && dataMode === 'waitlist' && (() => {
              const dayWl = (waitlistByDate.get(dayView) ?? [])
                .sort((a, b) => a.status.localeCompare(b.status))
              if (dayWl.length === 0) return (
                <div className="py-10 text-center text-sm text-zinc-400">
                  <ClipboardList className="mx-auto mb-2 h-5 w-5 opacity-40" />
                  No waitlist entries on this day
                </div>
              )
              return (
                <div className="space-y-2">
                  {dayWl.map(entry => (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => { setDayView(null); setSelectedWl(entry) }}
                      className="w-full rounded-xl border bg-white p-3 flex items-center gap-3 text-left hover:shadow-sm transition-all"
                    >
                      <Avatar className="h-9 w-9 shrink-0">
                        <AvatarFallback className="text-xs font-semibold">{getInitials(entry.customer_name)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm text-zinc-950 truncate">{entry.customer_name}</p>
                          <Badge variant="outline" className={`text-[10px] border shrink-0 ${WAITLIST_BADGE[entry.status] ?? 'bg-zinc-50 border-zinc-200 text-zinc-500'}`}>
                            {WAITLIST_STATUS_LABEL[entry.status] ?? entry.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                          <p className="text-xs text-zinc-500 truncate">{entry.service_name ?? 'Service'}</p>
                          {(entry.preferred_eras ?? []).map(era => (
                            <span key={era} className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500 font-medium">
                              {ERA_LABEL[era] ?? era}
                            </span>
                          ))}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )
            })()}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ViewToggleBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
        active ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-50'
      }`}
    >
      {children}
    </button>
  )
}

function DetailRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 text-sm">
      {icon}
      <span className="text-zinc-700">{children}</span>
    </div>
  )
}
