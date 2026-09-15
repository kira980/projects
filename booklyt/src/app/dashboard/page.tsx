import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { format, isToday, isTomorrow, parseISO } from "date-fns"
import {
  Calendar,
  TrendingUp,
  Users,
  Scissors,
  ArrowRight,
  ExternalLink,
} from "lucide-react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { APPOINTMENT_STATUS_COLORS, getInitials } from "@/lib/utils"
import type { Business, AppointmentWithRelations } from "@/types/database"
import { WaStatsCard } from "@/components/dashboard/wa-stats-card"

export default async function DashboardPage() {
  const supabase = await createClient()

  /*const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle() as { data: Business | null; error: unknown }

  if (!business) redirect("/onboarding")*/
  //
const { data: { user } } = await supabase.auth.getUser()
if (!user) redirect("/auth/login")

const { data: business } = await supabase
  .from("businesses")
  .select("*")
  .eq("owner_id", user.id)
  .maybeSingle() as { data: Business | null; error: unknown }

if (!business) redirect("/onboarding")

  //

  const today = format(new Date(), "yyyy-MM-dd")

  const [
    { count: totalAppointments },
    { count: todayAppointments },
    { count: totalServices },
    { count: totalStaff },
    { data: upcomingRaw },
  ] = await Promise.all([
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id)
      .neq("status", "cancelled"),

    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id)
      .eq("appointment_date", today)
      .neq("status", "cancelled"),

    supabase
      .from("services")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id)
      .eq("active", true),

    supabase
      .from("staff_members")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id)
      .eq("active", true),

    supabase
      .from("appointments")
      .select("*, services(name, price, duration_minutes), staff_members(name, avatar_url)")
      .eq("business_id", business.id)
      .gte("appointment_date", today)
      .neq("status", "cancelled")
      .order("appointment_date", { ascending: true })
      .order("start_time", { ascending: true })
      .limit(8),
  ])

  const upcoming = (upcomingRaw ?? []) as unknown as AppointmentWithRelations[]

  const stats = [
    {
      label: "Today",
      value: todayAppointments ?? 0,
      icon: Calendar,
      sub: "Appointments today",
    },
    {
      label: "All time",
      value: totalAppointments ?? 0,
      icon: TrendingUp,
      sub: "Total appointments",
    },
    {
      label: "Services",
      value: totalServices ?? 0,
      icon: Scissors,
      sub: "Available to book",
    },
    {
      label: "Staff",
      value: totalStaff ?? 0,
      icon: Users,
      sub: "Active members",
    },
  ]

  const formatDateLabel = (dateStr: string) => {
    const date = parseISO(dateStr)
    if (isToday(date)) return "Today"
    if (isTomorrow(date)) return "Tomorrow"
    return format(date, "EEE, MMM d")
  }

  const formatTime = (time: string) => {
    const [h, m] = time.split(":").map(Number)
    const period = h < 12 ? "AM" : "PM"
    const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h
    return `${displayH}:${m.toString().padStart(2, "0")} ${period}`
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{getGreeting()}</h1>
          <p className="text-zinc-500 mt-0.5 text-sm">
            {business.name}
          </p>
        </div>
        <Link href={`/book/${business.slug}`} target="_blank">
          <Button variant="outline" size="sm" className="gap-2 text-xs border-zinc-200 text-zinc-600 hover:text-zinc-900">
            <ExternalLink className="w-3.5 h-3.5" />
            Booking page
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-zinc-100 shadow-none">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">{stat.label}</p>
                <div className="w-7 h-7 rounded-lg bg-zinc-100 flex items-center justify-center">
                  <stat.icon className="w-3.5 h-3.5 text-zinc-400" />
                </div>
              </div>
              <p className="text-3xl font-bold tracking-tight tabular-nums">{stat.value}</p>
              <p className="text-xs text-zinc-400 mt-1">{stat.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* WhatsApp stats */}
      <WaStatsCard />

      {/* Upcoming appointments */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold tracking-tight text-zinc-900">Upcoming appointments</h2>
          <Link href="/dashboard/appointments">
            <Button variant="ghost" size="sm" className="gap-1 text-[13px] text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 h-8 px-2.5">
              View all
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>

        {upcoming.length === 0 ? (
          <EmptyAppointments businessSlug={business.slug} />
        ) : (
          <div className="space-y-2">
            {upcoming.map((appt) => (
              <div key={appt.id} className="flex items-center gap-4 py-3.5 px-4 bg-white border border-zinc-100 rounded-xl hover:border-zinc-200 transition-colors">
                <Avatar className="w-9 h-9 shrink-0">
                  <AvatarFallback className="text-[11px] bg-zinc-100 text-zinc-500 font-semibold">{getInitials(appt.customer_name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-[13px] text-zinc-900">{appt.customer_name}</p>
                    <Badge
                      className={`text-[10px] border px-1.5 py-0 h-4 ${APPOINTMENT_STATUS_COLORS[appt.status]}`}
                      variant="outline"
                    >
                      {appt.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-zinc-500 truncate mt-0.5">
                    {appt.services?.name ?? "Service"}
                    {appt.staff_members && (
                      <span className="text-zinc-400"> · {appt.staff_members.name}</span>
                    )}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[13px] font-medium text-zinc-700">{formatDateLabel(appt.appointment_date)}</p>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    {formatTime(appt.start_time)} – {formatTime(appt.end_time)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-sm font-semibold tracking-tight text-zinc-900 mb-3">Quick actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { href: "/dashboard/services", label: "Add a service", description: "List a new offering", icon: Scissors },
            { href: "/dashboard/staff", label: "Add staff", description: "Grow your team", icon: Users },
            { href: "/dashboard/hours", label: "Working hours", description: "Update your schedule", icon: Calendar },
          ].map((item) => (
            <Link key={item.href} href={item.href}>
              <div className="flex items-center gap-3.5 px-4 py-3.5 bg-white border border-zinc-100 rounded-xl hover:border-zinc-200 hover:shadow-[0_2px_12px_rgba(0,0,0,0.04)] transition-all cursor-pointer group">
                <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center shrink-0 group-hover:bg-violet-50 transition-colors">
                  <item.icon className="w-4 h-4 text-zinc-400 group-hover:text-violet-600 transition-colors" />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-zinc-800 tracking-tight">{item.label}</p>
                  <p className="text-[11px] text-zinc-400 mt-0.5">{item.description}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return "Good morning"
  if (h < 18) return "Good afternoon"
  return "Good evening"
}

function EmptyAppointments({ businessSlug }: { businessSlug: string }) {
  return (
    <div className="border border-dashed border-zinc-200 rounded-xl py-12 text-center">
      <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center mx-auto mb-3">
        <Calendar className="w-5 h-5 text-zinc-300" />
      </div>
      <p className="text-sm font-medium text-zinc-500 mb-0.5">No upcoming appointments</p>
      <p className="text-xs text-zinc-400 mb-5">Share your booking page to start receiving appointments</p>
      <Link href={`/book/${businessSlug}`} target="_blank">
        <Button variant="outline" size="sm" className="text-xs border-zinc-200">
          <ExternalLink className="w-3.5 h-3.5" />
          View booking page
        </Button>
      </Link>
    </div>
  )
}
