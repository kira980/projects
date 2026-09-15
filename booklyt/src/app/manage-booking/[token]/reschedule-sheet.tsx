"use client"

import { useCallback, useEffect, useState } from "react"
import { CalendarDays, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getDictionary, type Locale } from "@/lib/i18n"
import type { TimeSlot } from "@/lib/booking/slots"

interface Props {
  token: string
  businessId: string
  durationMinutes: number
  staffMemberId: string | null
  language?: Locale
}

/**
 * Slim self-service reschedule: pick a date → pick a free slot (via /api/slots)
 * → confirm (via /api/book/manage/reschedule). Deliberately independent of the
 * 2000-line booking wizard.
 */
export function RescheduleSheet({ token, businessId, durationMinutes, staffMemberId, language = "en" }: Props) {
  const t = getDictionary(language)
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState("")
  const [slots, setSlots] = useState<TimeSlot[] | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const today = new Date().toISOString().slice(0, 10)

  const loadSlots = useCallback(async (d: string) => {
    setLoadingSlots(true)
    setSlots(null)
    setSelected(null)
    setError(null)
    try {
      const params = new URLSearchParams({
        business_id: businessId,
        date: d,
        duration: String(durationMinutes),
      })
      if (staffMemberId) params.set("staff_id", staffMemberId)
      const res = await fetch(`/api/slots?${params}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error)
      setSlots((data.slots ?? []).filter((s: TimeSlot) => s.available))
    } catch {
      setError(t.manageBooking.rescheduleError)
    } finally {
      setLoadingSlots(false)
    }
  }, [businessId, durationMinutes, staffMemberId, t.manageBooking.rescheduleError])

  useEffect(() => {
    if (date) loadSlots(date)
  }, [date, loadSlots])

  async function confirm() {
    if (!date || !selected) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch("/api/book/manage/reschedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, date, start_time: selected }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error)
      setDone(true)
      // Refresh the server-rendered booking details
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t.manageBooking.rescheduleError)
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
        {t.manageBooking.rescheduledDone}
      </div>
    )
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" className="w-full" onClick={() => setOpen(true)}>
        <CalendarDays className="h-4 w-4" />
        {t.manageBooking.rescheduleButton}
      </Button>
    )
  }

  return (
    <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
      <p className="text-sm font-semibold text-zinc-800">{t.manageBooking.rescheduleTitle}</p>

      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-500">{t.manageBooking.chooseDate}</label>
        <input
          type="date"
          min={today}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
        />
      </div>

      {loadingSlots && (
        <div className="flex items-center justify-center py-4 text-zinc-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {!loadingSlots && slots !== null && (
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-500">{t.manageBooking.chooseTime}</label>
          {slots.length === 0 ? (
            <p className="py-2 text-sm text-zinc-400">{t.manageBooking.noSlots}</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {slots.map((s) => (
                <button
                  key={s.time}
                  type="button"
                  onClick={() => setSelected(s.time)}
                  className={`rounded-xl border px-2 py-2 text-xs font-semibold transition-colors ${
                    selected === s.time
                      ? "border-violet-600 bg-violet-600 text-white"
                      : "border-zinc-200 bg-white text-zinc-700 hover:border-violet-300"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          className="flex-1"
          disabled={!selected || submitting}
          onClick={confirm}
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : t.manageBooking.rescheduleConfirm}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
          {t.common.back}
        </Button>
      </div>
    </div>
  )
}
