"use client"

import { useEffect, useState } from "react"
import { Calendar } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { AppointmentWithRelations } from "@/types/database"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/use-toast"
import { AppointmentCalendar, type CalendarAppointment, type CalendarWaitlistEntry } from "@/components/appointments/appointment-calendar"

function toCalendar(appt: AppointmentWithRelations): CalendarAppointment {
  const svc = appt.services as { name?: string; price?: number } | undefined
  const stf = appt.staff_members as { name?: string } | undefined
  return {
    id: appt.id,
    appointment_date: appt.appointment_date,
    start_time: appt.start_time,
    end_time: appt.end_time,
    status: appt.status,
    customer_name: appt.customer_name,
    customer_phone: appt.customer_phone,
    customer_email: appt.customer_email,
    participants_count: appt.participants_count,
    service_name: svc?.name ?? null,
    staff_name: stf?.name ?? null,
    service_price: svc?.price ?? null,
    customer_confirmed_at: (appt as AppointmentWithRelations & { customer_confirmed_at?: string | null }).customer_confirmed_at ?? null,
  }
}

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<AppointmentWithRelations[]>([])
  const [waitlist, setWaitlist] = useState<CalendarWaitlistEntry[]>([])
  const [businessName, setBusinessName] = useState<string | undefined>()
  const [timeFormat, setTimeFormat] = useState<'12h' | '24h'>('12h')
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient() as any
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: bizData } = await supabase
      .from("businesses")
      .select("id, name, time_format")
      .eq("owner_id", user.id)
      .single()

    const biz = bizData as { id: string; name: string; time_format?: string } | null
    if (!biz) return

    setBusinessName(biz.name)
    setTimeFormat((biz.time_format === '24h' ? '24h' : '12h'))

    const [{ data }, { data: wlData }] = await Promise.all([
      supabase
        .from("appointments")
        .select("*, services(id,name,duration_minutes,price), staff_members(id,name,role,avatar_url)")
        .eq("business_id", biz.id)
        .order("appointment_date", { ascending: false })
        .order("start_time", { ascending: false })
        .limit(200),
      supabase
        .from("waitlist_entries")
        .select("id, preferred_date, status, customer_name, customer_phone, customer_email, preferred_eras, services(name)")
        .eq("business_id", biz.id)
        .order("preferred_date", { ascending: false })
        .limit(100),
    ])

    setAppointments((data as AppointmentWithRelations[]) ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setWaitlist((wlData ?? []).map((e: any) => ({
      id: e.id,
      preferred_date: e.preferred_date,
      status: e.status,
      customer_name: e.customer_name,
      customer_phone: e.customer_phone ?? null,
      customer_email: e.customer_email ?? null,
      service_name: e.services?.name ?? null,
      preferred_eras: e.preferred_eras ?? [],
    })))
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const updateStatus = async (id: string, status: CalendarAppointment["status"]) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient() as any
    const { error } = await supabase
      .from("appointments")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)

    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message })
    } else {
      toast({ title: `Appointment ${status}` })
      await loadData()
    }
  }

  const mapped = appointments.map(toCalendar)

  // Stats
  const stats = [
    { label: "Pending",   count: appointments.filter(a => a.status === "pending").length,   color: "bg-amber-50 text-amber-700" },
    { label: "Confirmed", count: appointments.filter(a => a.status === "confirmed").length,  color: "bg-violet-50 text-violet-700" },
    { label: "Completed", count: appointments.filter(a => a.status === "completed").length,  color: "bg-emerald-50 text-emerald-700" },
    { label: "Cancelled", count: appointments.filter(a => a.status === "cancelled").length,  color: "bg-zinc-100 text-zinc-600" },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Appointments</h1>
        <p className="text-zinc-500 mt-1">Manage and track all your bookings</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map(s => (
          <div key={s.label} className={`rounded-xl px-4 py-3 ${s.color}`}>
            <p className="text-2xl font-bold">{s.count}</p>
            <p className="text-xs font-medium opacity-80">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Calendar / List view */}
      {loading && !appointments.length ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : appointments.length === 0 && waitlist.length === 0 ? (
        <div className="text-center py-20 border border-dashed rounded-xl bg-white">
          <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-6 h-6 text-zinc-400" />
          </div>
          <h3 className="font-semibold text-zinc-700 mb-1">No appointments yet</h3>
          <p className="text-sm text-zinc-400">Share your booking page to start receiving bookings</p>
        </div>
      ) : (
        <AppointmentCalendar
          appointments={mapped}
          waitlistEntries={waitlist}
          loading={loading}
          businessName={businessName}
          timeFormat={timeFormat}
          onUpdateStatus={updateStatus}
        />
      )}
    </div>
  )
}
