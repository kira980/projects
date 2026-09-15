"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isSameDay,
  parseISO,
  startOfMonth,
  subDays,
  subMonths,
} from "date-fns"
import { arSA } from "date-fns/locale"
import {
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  History,
  LayoutList,
  LayoutTemplate,
  Loader2,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Settings,
  Share,
  Smartphone,
  Trash2,
  Users,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/components/ui/use-toast"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn, formatCurrency } from "@/lib/utils"
import { getDictionary, statusLabel, normalizeLocale, type Dictionary } from "@/lib/i18n"

// ── Types ─────────────────────────────────────────────────────────────────────

type TabKey = "overview" | "appointments" | "services" | "staff" | "hours" | "history" | "builder" | "settings"

type PortalAppointment = {
  id: string
  appointment_date: string
  start_time: string
  end_time: string
  participants_count: number
  status: "pending" | "booked" | "confirmed" | "cancelled" | "completed"
  manage_token?: string | null
  customer_name: string
  customer_email: string | null
  customer_phone: string | null
  services?: { id?: string; name?: string; price?: number; duration_minutes?: number } | null
  staff_members?: { id?: string; name?: string; role?: string } | null
}

type PortalWaitlistEntry = {
  id: string
  preferred_date: string
  participants_count: number
  status: "active" | "notified" | "booked" | "cancelled"
  customer_name: string
  customer_email: string | null
  customer_phone: string | null
  services?: { name?: string } | null
}

type PortalService = {
  id: string
  name: string
  description: string | null
  duration_minutes: number
  price: number
  active: boolean
}

type PortalStaff = {
  id: string
  name: string
  role: string | null
  bio: string | null
  active: boolean
}

type PortalWorkingHour = {
  id: string
  day_of_week: number
  is_open: boolean
  open_time: string | null
  close_time: string | null
}

type PortalBreak = {
  id: string
  day_of_week: number
  start_time: string
  end_time: string
}

type AppointmentEvent = {
  id: string
  event_type: string
  title: string
  description: string | null
  created_at: string
}

type PortalData = {
  business: {
    id: string
    name: string
    slug: string
    language: string
    currency: string
    country_code: string | null
    app_icon_url: string | null
    logo_url: string | null
  }
  appointments: PortalAppointment[]
  waitlist: PortalWaitlistEntry[]
  services: PortalService[]
  staff: PortalStaff[]
  workingHours: PortalWorkingHour[]
  breaks: PortalBreak[]
  history: AppointmentEvent[]
}

type SelectedItem =
  | { kind: "appt"; item: PortalAppointment }
  | { kind: "wait"; item: PortalWaitlistEntry }

const APPT_SC = {
  pending:   { dot: "bg-amber-400",  bar: "bg-amber-400",  bg: "bg-amber-50",   text: "text-amber-800",  ring: "border-amber-200"  },
  booked:    { dot: "bg-blue-400",   bar: "bg-blue-400",   bg: "bg-blue-50",    text: "text-blue-800",   ring: "border-blue-200"   },
  confirmed: { dot: "bg-green-500",  bar: "bg-green-500",  bg: "bg-green-50",   text: "text-green-800",  ring: "border-green-200"  },
  completed: { dot: "bg-red-500",    bar: "bg-red-500",    bg: "bg-red-50",     text: "text-red-800",    ring: "border-red-200"    },
  cancelled: { dot: "bg-zinc-300",   bar: "bg-zinc-300",   bg: "bg-zinc-50",    text: "text-zinc-500",   ring: "border-zinc-200"   },
} as const

const WAIT_SC = {
  active:    { dot: "bg-amber-400",  bar: "bg-amber-400",  bg: "bg-amber-50",   text: "text-amber-800",  ring: "border-amber-200"  },
  notified:  { dot: "bg-blue-400",   bar: "bg-blue-400",   bg: "bg-blue-50",    text: "text-blue-800",   ring: "border-blue-200"   },
  booked:    { dot: "bg-green-500",  bar: "bg-green-500",  bg: "bg-green-50",   text: "text-green-800",  ring: "border-green-200"  },
  cancelled: { dot: "bg-zinc-300",   bar: "bg-zinc-300",   bg: "bg-zinc-50",    text: "text-zinc-500",   ring: "border-zinc-200"   },
} as const

// ── iOS helpers ───────────────────────────────────────────────────────────────

function isIos() { return /iPad|iPhone|iPod/.test(navigator.userAgent) }
function isStandalone() {
  return (navigator as unknown as Record<string, boolean>).standalone === true
    || window.matchMedia("(display-mode: standalone)").matches
}
function getNotificationSupportProblem() {
  if (!window.isSecureContext) return "Notifications require HTTPS."
  if (!("serviceWorker" in navigator)) return "Service workers not supported."
  if (!("Notification" in window)) return "Notification API unavailable."
  if (!("PushManager" in window)) {
    if (isIos() && !isStandalone()) return "ios-install"
    if (isIos() && isStandalone()) return "__ios_reload__"
    return "PushManager unavailable. Use Chrome on Android or Safari Home Screen on iOS 16.4+."
  }
  return null
}

// ── Main component ────────────────────────────────────────────────────────────

export function AdminPortalClient({ slug }: { slug: string }) {
  const searchParams = useSearchParams()
  const activeTab = (searchParams.get("tab") as TabKey) ?? "overview"

  const [data, setData] = useState<PortalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [subscribing, setSubscribing] = useState(false)
  const [testingNotification, setTestingNotification] = useState(false)
  const [showIosInstall, setShowIosInstall] = useState(false)

  const loadData = async () => {
    setLoading(true)
    const res = await fetch(`/api/admin/portal/${slug}/appointments`)
    const result = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast({ variant: "destructive", title: "Could not load data", description: result.error ?? "Please sign in again." })
    } else {
      setData(result)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  const updateStatus = async (id: string, status: PortalAppointment["status"]) => {
    setSavingId(id)
    const res = await fetch(`/api/admin/portal/${slug}/appointments`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    })
    const result = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast({ variant: "destructive", title: getDictionary(normalizeLocale(data?.business.language)).admin.updateError, description: result.error })
    } else {
      toast({ title: getDictionary(normalizeLocale(data?.business.language)).admin.appointmentStatus })
      await loadData()
    }
    setSavingId(null)
  }

  const enableNotifications = async () => {
    if (!data) return
    const prob = getNotificationSupportProblem()
    if (prob) {
      if (prob === "ios-install") { setShowIosInstall(true); return }
      if (prob === "__ios_reload__") { window.location.reload(); return }
      toast({ variant: "destructive", title: "Not supported", description: prob })
      return
    }
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!publicKey) { toast({ variant: "destructive", title: "Push keys missing", description: "Add NEXT_PUBLIC_VAPID_PUBLIC_KEY." }); return }
    setSubscribing(true)
    try {
      if (await Notification.requestPermission() !== "granted") throw new Error("Permission denied.")
      const reg = await navigator.serviceWorker.ready
      await reg.update().catch(() => {})
      if (!reg.pushManager) {
        if (isIos() && isStandalone()) { window.location.reload(); return }
        throw new Error("PushManager unavailable.")
      }
      await reg.showNotification(`${data.business.name} Admin`, {
        body: "Saving device for booking alerts…", icon: data.business.app_icon_url || data.business.logo_url || undefined, requireInteraction: true,
      })
      const ex = await reg.pushManager.getSubscription()
      if (ex) await ex.unsubscribe().catch(() => {})
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) })
      const res = await fetch("/api/push/subscribe", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ business_id: data.business.id, admin_slug: slug, endpoint: sub.endpoint, keys: sub.toJSON().keys }),
      })
      const result = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(result.error)
      toast({ title: "Notifications enabled" })
    } catch (e) {
      toast({ variant: "destructive", title: "Failed", description: e instanceof Error ? e.message : "Try again." })
    } finally { setSubscribing(false) }
  }

  const sendTestNotification = async () => {
    setTestingNotification(true)
    const res = await fetch(`/api/admin/portal/${slug}/notifications/test`, { method: "POST" })
    const result = await res.json().catch(() => ({}))
    if (!res.ok || result.result?.skipped === "missing_vapid_keys") {
      toast({ variant: "destructive", title: "Test failed", description: result.error ?? "VAPID keys missing." })
    } else if (!result.result?.attempted) {
      toast({ variant: "destructive", title: "No device subscribed", description: "Enable notifications first." })
    } else if (result.result?.sent > 0) {
      toast({ title: "Test sent", description: "If no popup appeared, check OS notification settings." })
    } else {
      toast({ variant: "destructive", title: "Not delivered", description: "Re-enable notifications." })
    }
    setTestingNotification(false)
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-300" />
      </div>
    )
  }
  if (!data) return null

  const lang = normalizeLocale(data.business.language)
  const t = getDictionary(lang)
  const isRtl = lang === "ar"

  const pending = data.appointments.filter(a => a.status === "pending").length
  const todayKey = new Date().toISOString().slice(0, 10)
  const todayCount = data.appointments.filter(a => a.appointment_date === todayKey).length
  const activeWaitlist = data.waitlist.filter(w => w.status === "active").length
  const showIosBanner = typeof window !== "undefined" && isIos() && !isStandalone()

  return (
    <div className="space-y-4" dir={isRtl ? "rtl" : "ltr"}>
      {showIosBanner && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <Smartphone className="h-5 w-5 shrink-0 text-amber-600" />
          <p className="flex-1 text-sm text-amber-800">{t.admin.addHomeScreen}</p>
          <button type="button" onClick={() => setShowIosInstall(true)} className="shrink-0 text-xs font-semibold text-amber-800 underline">{t.admin.howQuestion}</button>
        </div>
      )}
      <IosInstallDialog open={showIosInstall} onClose={() => setShowIosInstall(false)} />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard label={t.common.pending} value={pending} accent="amber" />
        <StatCard label={t.common.today} value={todayCount} accent="violet" />
        <StatCard label={t.common.waitlist} value={activeWaitlist} accent="sky" />
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={enableNotifications} disabled={subscribing}>
          {subscribing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
          {t.common.notifications}
        </Button>
        <Button size="sm" variant="outline" onClick={sendTestNotification} disabled={testingNotification}>
          {testingNotification ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
          {t.admin.testPush}
        </Button>
        <Button size="sm" variant="outline" onClick={loadData} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          {t.common.refresh}
        </Button>
        <Link href={`/book/${data.business.slug}`} target="_blank" className="ml-auto">
          <Button size="sm" variant="outline">
            <ExternalLink className="h-4 w-4" /> {t.admin.publicPage}
          </Button>
        </Link>
      </div>

      {activeTab === "overview" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <OverviewCard title={t.admin.appointments} value={data.appointments.length} detail={`${pending} ${t.admin.pendingDetail}`} href={`/admin/${slug}?tab=appointments`} />
          <OverviewCard title={t.common.services} value={data.services.length} detail={`${data.services.filter(s => s.active).length} ${t.admin.activeDetail}`} href={`/admin/${slug}?tab=services`} />
          <OverviewCard title={t.common.staff} value={data.staff.length} detail={`${data.staff.filter(s => s.active).length} ${t.admin.activeDetail}`} href={`/admin/${slug}?tab=staff`} />
          <OverviewCard title={t.common.waitlist} value={activeWaitlist} detail={t.admin.activeRequests} href={`/admin/${slug}?tab=appointments`} />
        </div>
      )}

      {activeTab === "appointments" && (
        <AppointmentsTab
          appointments={data.appointments}
          waitlist={data.waitlist}
          savingId={savingId}
          updateStatus={updateStatus}
          slug={slug}
          language={lang}
          countryCode={data.business.country_code ?? "972"}
          businessName={data.business.name}
          t={t}
        />
      )}

      {activeTab === "services" && <ServicesEditor slug={slug} services={data.services} onRefresh={loadData} currency={data.business.currency ?? "USD"} t={t} />}
      {activeTab === "staff" && <StaffEditor slug={slug} staff={data.staff} onRefresh={loadData} t={t} />}
      {activeTab === "hours" && <HoursEditor slug={slug} workingHours={data.workingHours} breaks={data.breaks} onRefresh={loadData} t={t} />}
      {activeTab === "history" && <HistoryList events={data.history} t={t} />}

      {activeTab === "builder" && (
        <ActionPanel title={t.admin.websiteBuilder} description={t.admin.builderDescription}
          href={`/admin/${data.business.slug}/builder`} buttonLabel={t.admin.openBuilder} icon={<LayoutTemplate className="h-4 w-4" />} />
      )}
      {activeTab === "settings" && (
        <ActionPanel title={t.admin.businessSettings} description={t.admin.settingsDescription}
          href={`/admin/${data.business.slug}/settings`} buttonLabel={t.admin.openSettings} icon={<Settings className="h-4 w-4" />} />
      )}
    </div>
  )
}

// ── Appointments tab ──────────────────────────────────────────────────────────

function AppointmentsTab({
  appointments, waitlist, savingId, updateStatus, slug, language = "en", countryCode = "972", businessName = "", t,
}: {
  appointments: PortalAppointment[]
  waitlist: PortalWaitlistEntry[]
  savingId: string | null
  updateStatus: (id: string, status: PortalAppointment["status"]) => void
  slug: string
  language?: string
  countryCode?: string
  businessName?: string
  t: Dictionary
}) {
  const [source, setSource] = useState<"appointments" | "waitlist">("appointments")
  const [view, setView] = useState<"calendar" | "list">("calendar")
  const [selected, setSelected] = useState<SelectedItem | null>(null)

  const items = source === "appointments" ? appointments : waitlist

  return (
    <div className="space-y-3">
      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Source toggle */}
        <div className="flex gap-px rounded-xl border border-zinc-200 bg-zinc-100 p-1">
          <ToggleBtn active={source === "appointments"} onClick={() => setSource("appointments")}>
            <CalendarDays className="h-3.5 w-3.5" /> {t.admin.appointments}
            {appointments.filter(a => a.status === "pending").length > 0 && (
              <span className="ml-1 rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">
                {appointments.filter(a => a.status === "pending").length}
              </span>
            )}
          </ToggleBtn>
          <ToggleBtn active={source === "waitlist"} onClick={() => setSource("waitlist")}>
            <Clock className="h-3.5 w-3.5" /> {t.common.waitlist}
            {waitlist.filter(w => w.status === "active").length > 0 && (
              <span className="ml-1 rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">
                {waitlist.filter(w => w.status === "active").length}
              </span>
            )}
          </ToggleBtn>
        </div>

        {/* View toggle */}
        <div className="ml-auto flex gap-px rounded-xl border border-zinc-200 bg-zinc-100 p-1">
          <ToggleBtn active={view === "calendar"} onClick={() => setView("calendar")}>
            <CalendarDays className="h-3.5 w-3.5" /> {t.admin.calendar}
          </ToggleBtn>
          <ToggleBtn active={view === "list"} onClick={() => setView("list")}>
            <LayoutList className="h-3.5 w-3.5" /> {t.admin.list}
          </ToggleBtn>
        </div>
      </div>

      {view === "calendar" ? (
        <BigCalendar
          items={items}
          source={source}
          savingId={savingId}
          updateStatus={updateStatus}
          onSelect={setSelected}
          language={language}
          t={t}
        />
      ) : (
        <DayListView
          items={items}
          source={source}
          savingId={savingId}
          updateStatus={updateStatus}
          onSelect={setSelected}
          language={language}
          t={t}
        />
      )}

      <ItemDetailDialog selected={selected} savingId={savingId} updateStatus={updateStatus} onClose={() => setSelected(null)} slug={slug ?? ""} language={language} countryCode={countryCode} businessName={businessName} t={t} />
    </div>
  )
}

function ToggleBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
        active ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
      )}
    >
      {children}
    </button>
  )
}

// ── Big Calendar ──────────────────────────────────────────────────────────────

function BigCalendar({
  items, source, savingId, updateStatus, onSelect, language = "en", t,
}: {
  items: PortalAppointment[] | PortalWaitlistEntry[]
  source: "appointments" | "waitlist"
  savingId: string | null
  updateStatus: (id: string, status: PortalAppointment["status"]) => void
  onSelect: (item: SelectedItem) => void
  language?: string
  t: Dictionary
}) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [timelineDay, setTimelineDay] = useState<Date | null>(null)

  const monthStart = startOfMonth(currentMonth)
  const days = eachDayOfInterval({ start: monthStart, end: endOfMonth(currentMonth) })
  const startPadding = getDay(monthStart)

  const dateMap = useMemo(() => {
    const map = new Map<string, (PortalAppointment | PortalWaitlistEntry)[]>()
    for (const item of items) {
      // Skip cancelled appointments in the calendar view
      if (source === "appointments" && (item as PortalAppointment).status === "cancelled") continue
      const key = source === "appointments"
        ? (item as PortalAppointment).appointment_date
        : (item as PortalWaitlistEntry).preferred_date
      const arr = map.get(key) ?? []
      arr.push(item)
      map.set(key, arr)
    }
    return map
  }, [items, source])

  const timelineDayKey = timelineDay ? format(timelineDay, "yyyy-MM-dd") : null
  const timelineDayItems = timelineDayKey ? (dateMap.get(timelineDayKey) ?? []) : []

  return (
    <div className="space-y-3">
      {/* Month nav */}
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-zinc-900 text-base">{format(currentMonth, "MMMM yyyy")}</h3>
        <div className="flex gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(m => subMonths(m, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(m => addMonths(m, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar */}
      <div className="overflow-x-auto -mx-1 px-1">
        <div className="min-w-[520px]">
          {/* Headers */}
          <div className="grid grid-cols-7 mb-1">
            {t.days.map(d => (
              <div key={d} className="py-2 text-center text-[11px] font-bold uppercase tracking-widest text-zinc-400">{d.slice(0, 3)}</div>
            ))}
          </div>

          {/* Cells */}
          <div className="grid grid-cols-7 gap-px rounded-2xl border border-zinc-200 bg-zinc-200 overflow-hidden shadow-sm">
            {Array.from({ length: startPadding }).map((_, i) => (
              <div key={`p${i}`} className="min-h-[140px] bg-zinc-50/80" />
            ))}

            {days.map(day => {
              const key = format(day, "yyyy-MM-dd")
              const dayItems = dateMap.get(key) ?? []
              const isToday = isSameDay(day, new Date())
              const visible = dayItems.slice(0, 3)
              const overflow = dayItems.length - 3

              return (
                <div
                  key={key}
                  className={cn(
                    "min-h-[140px] bg-white flex flex-col p-1.5 transition-colors",
                    isToday && "bg-violet-50/40"
                  )}
                >
                  {/* Date number — click opens full-day timeline */}
                  <div className="flex items-center justify-between mb-1.5">
                    <button
                      type="button"
                      onClick={() => setTimelineDay(day)}
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors",
                        isToday ? "bg-violet-600 text-white shadow" : "text-zinc-600 hover:bg-violet-100 hover:text-violet-700"
                      )}
                    >
                      {format(day, "d")}
                    </button>
                    {dayItems.length > 0 && (
                      <span className="text-[10px] font-bold text-zinc-400">{dayItems.length}</span>
                    )}
                  </div>

                  {/* Appointment pills — click opens item detail */}
                  <div className="flex flex-col gap-1 flex-1">
                    {visible.map((item, idx) => {
                      const isAppt = source === "appointments"
                      const appt = item as PortalAppointment
                      const wl = item as PortalWaitlistEntry
                      const sc = isAppt ? APPT_SC[appt.status] : WAIT_SC[wl.status]
                      const timeLabel = isAppt ? appt.start_time.slice(0, 5) : null
                      const name = item.customer_name.split(" ")[0]
                      const service = item.services?.name

                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => onSelect(isAppt
                            ? { kind: "appt", item: appt }
                            : { kind: "wait", item: wl }
                          )}
                          className={cn(
                            "group flex gap-1.5 rounded-lg px-1.5 py-1 text-left transition-opacity hover:opacity-80 w-full",
                            sc.bg
                          )}
                        >
                          <div className={cn("mt-0.5 w-1 shrink-0 self-stretch rounded-full", sc.bar)} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-1">
                              {timeLabel && (
                                <span className={cn("shrink-0 text-[10px] font-bold tabular-nums", sc.text)}>{timeLabel}</span>
                              )}
                              <span className={cn("truncate text-[10px] font-semibold", sc.text)}>{name}</span>
                            </div>
                            {service && (
                              <span className="block truncate text-[9px] text-zinc-400 leading-none mt-0.5">{service}</span>
                            )}
                          </div>
                        </button>
                      )
                    })}
                    {overflow > 0 && (
                      <button
                        type="button"
                        onClick={() => setTimelineDay(day)}
                        className="rounded-lg px-1.5 py-0.5 text-left text-[10px] font-bold text-violet-500 hover:bg-violet-50"
                      >
                        +{overflow} more
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {source === "appointments"
          ? (["pending", "booked", "confirmed", "completed", "cancelled"] as const).map(s => (
            <span key={s} className="flex items-center gap-1.5 text-xs text-zinc-500">
              <span className={cn("h-2 w-2 rounded-full", APPT_SC[s].dot)} />{statusLabel(s, language)}
            </span>
          ))
          : (["active", "notified", "booked", "cancelled"] as const).map(s => (
            <span key={s} className="flex items-center gap-1.5 text-xs text-zinc-500">
              <span className={cn("h-2 w-2 rounded-full", WAIT_SC[s].dot)} />{s.charAt(0).toUpperCase() + s.slice(1)}
            </span>
          ))
        }
      </div>

      {/* Full-day timeline dialog */}
      {timelineDay && (
        <DayTimelineDialog
          day={timelineDay}
          items={timelineDayItems}
          source={source}
          savingId={savingId}
          updateStatus={updateStatus}
          onSelect={onSelect}
          onClose={() => setTimelineDay(null)}
          t={t}
        />
      )}
    </div>
  )
}

// ── Day timeline dialog ───────────────────────────────────────────────────────

const TIMELINE_CELL_H = 72 // px per hour

function timeToMins(t: string) {
  const [h, m] = t.slice(0, 5).split(":").map(Number)
  return h * 60 + m
}

function DayTimelineDialog({
  day, items, source, savingId, updateStatus, onSelect, onClose, t,
}: {
  day: Date
  items: (PortalAppointment | PortalWaitlistEntry)[]
  source: "appointments" | "waitlist"
  savingId: string | null
  updateStatus: (id: string, status: PortalAppointment["status"]) => void
  onSelect: (item: SelectedItem) => void
  onClose: () => void
  t: Dictionary
}) {
  const isApptSource = source === "appointments"
  const appts = isApptSource
    ? (items as PortalAppointment[]).slice().sort((a, b) => a.start_time.localeCompare(b.start_time))
    : []
  const waitlists = !isApptSource ? (items as PortalWaitlistEntry[]) : []

  // Calculate hour range from appointment times (minimum 8–18)
  let rangeStart = 8
  let rangeEnd = 18
  if (isApptSource && appts.length > 0) {
    const minMins = Math.min(...appts.map(a => timeToMins(a.start_time)))
    const maxMins = Math.max(...appts.map(a => timeToMins(a.end_time)))
    rangeStart = Math.min(rangeStart, Math.floor(minMins / 60))
    rangeEnd = Math.max(rangeEnd, Math.ceil(maxMins / 60))
  }
  // +1 so the closing-hour line (e.g. 18:00) appears as the last boundary row
  const hours = Array.from({ length: rangeEnd - rangeStart + 1 }, (_, i) => rangeStart + i)
  const totalH = (rangeEnd - rangeStart + 1) * TIMELINE_CELL_H

  // Current-time indicator (if today)
  const isToday = isSameDay(day, new Date())
  const nowMins = isToday ? new Date().getHours() * 60 + new Date().getMinutes() : -1
  const nowTop = nowMins >= rangeStart * 60 && nowMins <= rangeEnd * 60
    ? (nowMins - rangeStart * 60) / 60 * TIMELINE_CELL_H
    : null

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="flex max-h-[90vh] w-full max-w-lg flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 bg-gradient-to-r from-violet-50 to-white px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 flex-col items-center justify-center rounded-xl bg-violet-600 text-white shadow">
              <span className="text-[10px] font-bold uppercase leading-none opacity-80">{format(day, "MMM")}</span>
              <span className="text-lg font-black leading-none">{format(day, "d")}</span>
            </div>
            <div>
              <p className="font-bold text-zinc-950">{format(day, "EEEE")}</p>
              <p className="text-xs text-zinc-400">
                {items.length > 0
                  ? `${items.length} ${source === "appointments" ? "appointment" + (items.length !== 1 ? "s" : "") : "waitlist request" + (items.length !== 1 ? "s" : "")}`
                  : `No ${source} today`}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Waitlist entries (no time) */}
        {!isApptSource && waitlists.length > 0 && (
          <div className="border-b border-zinc-100 px-5 py-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-zinc-400">Waitlist requests</p>
            <div className="space-y-1.5">
              {waitlists.map((wl, idx) => {
                const sc = WAIT_SC[wl.status]
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onSelect({ kind: "wait", item: wl })}
                    className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:opacity-90 transition-opacity", sc.bg)}
                  >
                    <div className={cn("h-8 w-1 shrink-0 rounded-full", sc.bar)} />
                    <div className="min-w-0 flex-1">
                      <p className={cn("truncate text-sm font-semibold", sc.text)}>{wl.customer_name}</p>
                      <p className="truncate text-xs text-zinc-500">{wl.services?.name ?? "—"}</p>
                    </div>
                    <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize", sc.ring, sc.bg, sc.text)}>
                      {wl.status}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto">
          {isApptSource && appts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <CalendarDays className="mb-3 h-8 w-8 text-zinc-200" />
              <p className="text-sm text-zinc-400">No appointments on this day.</p>
            </div>
          ) : isApptSource ? (
            <div className="relative mx-5 my-4" style={{ height: totalH }}>
              {/* Hour grid */}
              {hours.map(hour => (
                <div
                  key={hour}
                  className="absolute inset-x-0 flex items-start gap-3 border-t border-zinc-100"
                  style={{ top: (hour - rangeStart) * TIMELINE_CELL_H }}
                >
                  <span className="w-12 shrink-0 pt-1 text-right text-[11px] font-medium tabular-nums text-zinc-400">
                    {hour.toString().padStart(2, "0")}:00
                  </span>
                  <div className="flex-1" />
                </div>
              ))}

              {/* Current time indicator */}
              {nowTop !== null && (
                <div
                  className="pointer-events-none absolute inset-x-0 z-10 flex items-center gap-2"
                  style={{ top: nowTop }}
                >
                  <span className="w-12 shrink-0 text-right text-[10px] font-bold text-rose-500 tabular-nums">
                    {format(new Date(), "HH:mm")}
                  </span>
                  <div className="h-0.5 flex-1 bg-rose-400" />
                  <div className="h-2 w-2 shrink-0 rounded-full bg-rose-500" />
                </div>
              )}

              {/* Appointment blocks */}
              {appts.map((appt, idx) => {
                const sc = APPT_SC[appt.status]
                const startMins = timeToMins(appt.start_time)
                const endMins = timeToMins(appt.end_time)
                const durationMins = endMins - startMins
                const top = (startMins - rangeStart * 60) / 60 * TIMELINE_CELL_H
                const height = Math.max(durationMins / 60 * TIMELINE_CELL_H, 44)
                const isBusy = savingId === appt.id

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onSelect({ kind: "appt", item: appt })}
                    className={cn(
                      "absolute left-16 right-0 z-20 overflow-hidden rounded-xl border px-3 py-2 text-left transition-all hover:opacity-90 hover:shadow-md",
                      sc.bg, sc.ring
                    )}
                    style={{ top, height }}
                  >
                    <div className="flex items-start gap-2">
                      <div className={cn("mt-1 w-1 shrink-0 self-stretch rounded-full", sc.bar)} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <p className={cn("truncate text-sm font-bold leading-tight", sc.text)}>{appt.customer_name}</p>
                          {isBusy && <Loader2 className="h-3 w-3 shrink-0 animate-spin text-zinc-400" />}
                        </div>
                        {height >= 52 && (
                          <p className="truncate text-xs text-zinc-500 mt-0.5">
                            {appt.services?.name ?? "—"}
                            {appt.staff_members?.name ? ` · ${appt.staff_members.name}` : ""}
                          </p>
                        )}
                        {height >= 68 && (
                          <p className={cn("mt-1 text-[10px] font-semibold tabular-nums", sc.text)}>
                            {appt.start_time.slice(0, 5)} – {appt.end_time.slice(0, 5)}
                          </p>
                        )}
                      </div>
                      <span className={cn("shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-bold capitalize", sc.ring, sc.bg, sc.text)}>
                        {appt.status}
                      </span>
                    </div>

                    {/* Quick action buttons */}
                    {height >= 60 && (appt.status === "pending" || appt.status === "booked" || appt.status === "confirmed") && (
                      <div className="mt-1.5 flex gap-1.5" onClick={e => e.stopPropagation()}>
                        {appt.status === "pending" && (
                          <button type="button" disabled={isBusy} onClick={() => updateStatus(appt.id, "booked")}
                            className="flex items-center gap-1 rounded-lg bg-blue-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-blue-700 disabled:opacity-50">
                            <Check className="h-3 w-3" /> {t.admin.book}
                          </button>
                        )}
                        {(appt.status === "booked" || appt.status === "confirmed") && (
                          <button type="button" disabled={isBusy} onClick={() => updateStatus(appt.id, "completed")}
                            className="flex items-center gap-1 rounded-lg bg-green-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-green-700 disabled:opacity-50">
                            <Check className="h-3 w-3" /> {t.admin.done}
                          </button>
                        )}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Day list view ─────────────────────────────────────────────────────────────

function DayListView({
  items, source, savingId, updateStatus, onSelect, language, t,
}: {
  items: PortalAppointment[] | PortalWaitlistEntry[]
  source: "appointments" | "waitlist"
  savingId: string | null
  updateStatus: (id: string, status: PortalAppointment["status"]) => void
  onSelect: (item: SelectedItem) => void
  language: string
  t: Dictionary
}) {
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date())
  const todayRef = useRef<HTMLButtonElement>(null)
  const stripRef = useRef<HTMLDivElement>(null)

  // 14 days back, today, 30 days forward
  const dates = useMemo(() => eachDayOfInterval({ start: subDays(new Date(), 14), end: addDays(new Date(), 30) }), [])

  useEffect(() => {
    if (todayRef.current && stripRef.current) {
      const strip = stripRef.current
      const btn = todayRef.current
      strip.scrollLeft = btn.offsetLeft - strip.clientWidth / 2 + btn.offsetWidth / 2
    }
  }, [])

  const selectedKey = format(selectedDay, "yyyy-MM-dd")

  const countsByDate = useMemo(() => {
    const map = new Map<string, number>()
    for (const item of items) {
      const key = source === "appointments"
        ? (item as PortalAppointment).appointment_date
        : (item as PortalWaitlistEntry).preferred_date
      map.set(key, (map.get(key) ?? 0) + 1)
    }
    return map
  }, [items, source])

  const dayItems = useMemo(() => {
    return (items as (PortalAppointment | PortalWaitlistEntry)[])
      .filter(item => {
        const k = source === "appointments"
          ? (item as PortalAppointment).appointment_date
          : (item as PortalWaitlistEntry).preferred_date
        return k === selectedKey
      })
      .sort((a, b) => {
        if (source !== "appointments") return 0
        return (a as PortalAppointment).start_time.localeCompare((b as PortalAppointment).start_time)
      })
  }, [items, source, selectedKey])

  return (
    <div className="space-y-3">
      {/* Date strip */}
      <div ref={stripRef} className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
        {dates.map(date => {
          const key = format(date, "yyyy-MM-dd")
          const count = countsByDate.get(key) ?? 0
          const isToday = isSameDay(date, new Date())
          const isSelected = isSameDay(date, selectedDay)

          return (
            <button
              key={key}
              ref={isToday ? todayRef : undefined}
              type="button"
              onClick={() => setSelectedDay(date)}
              className={cn(
                "flex shrink-0 flex-col items-center gap-1 rounded-xl px-3 py-2.5 transition-all",
                isSelected
                  ? "bg-violet-600 text-white shadow-sm"
                  : isToday
                  ? "border border-violet-200 bg-violet-50 text-violet-700"
                  : "border border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50"
              )}
            >
              <span className={cn("text-xs font-semibold", language === "ar" ? "" : "uppercase", isSelected ? "text-violet-200" : "text-zinc-400")}>
                {language === "ar" ? format(date, "EEEE", { locale: arSA }) : format(date, "EEE")}
              </span>
              <span className="text-sm font-bold leading-none">{format(date, "d")}</span>
              <span className={cn(
                "mt-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold",
                isSelected ? "bg-white/20 text-white" : count > 0 ? "bg-amber-100 text-amber-700" : "invisible"
              )}>
                {count > 0 ? count : "·"}
              </span>
            </button>
          )
        })}
      </div>

      {/* Selected day header */}
      <div className="flex items-center gap-2">
        <h3 className="font-bold text-zinc-900">{format(selectedDay, "EEEE, MMMM d")}</h3>
        {dayItems.length > 0 && <Badge variant="outline" className="text-xs">{dayItems.length}</Badge>}
      </div>

      {/* Items list */}
      {dayItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 py-12 text-center">
          <CalendarDays className="mx-auto mb-2 h-6 w-6 text-zinc-300" />
          <p className="text-sm text-zinc-400">{source === "appointments" ? t.admin.noAppointmentsDay : t.admin.noWaitlistDay}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm divide-y divide-zinc-100">
          {dayItems.map((item, idx) => {
            const isAppt = source === "appointments"
            const appt = item as PortalAppointment
            const wl = item as PortalWaitlistEntry
            const sc = isAppt ? APPT_SC[appt.status] : WAIT_SC[wl.status]
            const isBusy = isAppt && savingId === appt.id

            return (
              <div key={idx} className="flex items-center gap-3 px-4 py-3.5 hover:bg-zinc-50 transition-colors">
                {/* Time / status */}
                <div className="w-14 shrink-0 text-center">
                  {isAppt ? (
                    <>
                      <p className="text-sm font-bold text-zinc-900">{appt.start_time.slice(0, 5)}</p>
                      <p className="text-[10px] text-zinc-400">{appt.end_time.slice(0, 5)}</p>
                    </>
                  ) : (
                    <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold", sc.bg, sc.text)}>{wl.status}</span>
                  )}
                </div>

                {/* Colored bar */}
                <div className={cn("h-12 w-1 shrink-0 rounded-full", sc.bar)} />

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-zinc-950">{item.customer_name}</p>
                  <p className="truncate text-xs text-zinc-500">
                    {item.services?.name ?? "—"}
                    {isAppt && appt.staff_members?.name ? ` · ${appt.staff_members.name}` : ""}
                  </p>
                  {(item.customer_phone || item.customer_email) && (
                    <p className="truncate text-xs text-zinc-400">{item.customer_phone || item.customer_email}</p>
                  )}
                </div>

                {/* Status badge */}
                {isAppt && (
                  <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold", sc.ring, sc.bg, sc.text)}>
                    {statusLabel(appt.status, language)}
                  </span>
                )}

                {/* Actions */}
                <div className="flex shrink-0 gap-1">
                  {isAppt && appt.status === "pending" && (
                    <Button size="icon" title={t.admin.book} className="h-8 w-8 bg-blue-600 hover:bg-blue-700" disabled={isBusy} onClick={() => updateStatus(appt.id, "booked")}>
                      {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    </Button>
                  )}
                  {isAppt && (appt.status === "booked" || appt.status === "confirmed") && (
                    <Button size="icon" variant="outline" title={t.admin.done} className="h-8 w-8" disabled={isBusy} onClick={() => updateStatus(appt.id, "completed")}>
                      {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onSelect(
                    isAppt ? { kind: "appt", item: appt } : { kind: "wait", item: wl }
                  )}>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Item detail dialog ────────────────────────────────────────────────────────

function ItemDetailDialog({
  selected, savingId, updateStatus, onClose, slug, language, countryCode = "972", businessName = "", t,
}: {
  selected: SelectedItem | null
  savingId: string | null
  updateStatus: (id: string, status: PortalAppointment["status"]) => void
  onClose: () => void
  slug: string
  language: string
  countryCode?: string
  businessName?: string
  t: Dictionary
}) {
  if (!selected) return null

  const isAppt = selected.kind === "appt"
  const item = selected.item
  const appt = isAppt ? (item as PortalAppointment) : null
  const wl = !isAppt ? (item as PortalWaitlistEntry) : null
  const sc = isAppt && appt ? APPT_SC[appt.status] : wl ? WAIT_SC[wl.status] : APPT_SC.pending
  const rawPhone = item.customer_phone?.replace(/\D/g, "") ?? ""
  // Replace leading 0 with country code for international WhatsApp format
  const phone = rawPhone
    ? rawPhone.startsWith("0")
      ? countryCode + rawPhone.slice(1)
      : rawPhone.startsWith(countryCode)
        ? rawPhone
        : countryCode + rawPhone
    : ""

  const hasPhone = phone.length > 0
  const origin = typeof window !== "undefined" ? window.location.origin : ""
  // WhatsApp button: bare chat link (no pre-filled message)
  // Waitlist: pre-fill spot-opened message since there's no reminder button there
  const waUrl = hasPhone
    ? isAppt
      ? `https://wa.me/${phone}`
      : `https://wa.me/${phone}?text=${encodeURIComponent(`Hi ${item.customer_name}, a spot has opened for ${item.services?.name ?? "your requested service"}! Book now: ${origin}/book/${slug}`)}`
    : null
  const telUrl = item.customer_phone ? `tel:${item.customer_phone}` : null
  // Reminder button: WhatsApp message with manage booking link
  const isAr = language === "ar"
  const reminderWaText = appt
    ? isAr
      ? `مرحباً ${item.customer_name}، هذا تذكير بموعدك لـ${item.services?.name ?? "الخدمة"}${businessName ? ` في ${businessName}` : ""} بتاريخ ${format(parseISO(appt.appointment_date), "EEEE، d MMMM", { locale: arSA })} الساعة ${appt.start_time.slice(0, 5)}.\nيرجى تأكيد حضورك: ${origin}/manage-booking/${appt.manage_token ?? ""}`
      : `Hi ${item.customer_name}, this is a reminder for your ${item.services?.name ?? "appointment"}${businessName ? ` at ${businessName}` : ""} on ${format(parseISO(appt.appointment_date), "EEEE, MMMM d")} at ${appt.start_time.slice(0, 5)}.\nPlease confirm your attendance: ${origin}/manage-booking/${appt.manage_token ?? ""}`
    : ""
  const reminderWaUrl = hasPhone && reminderWaText ? `https://wa.me/${phone}?text=${encodeURIComponent(reminderWaText)}` : null
  const isBusy = appt ? savingId === appt.id : false

  const handleStatus = (status: PortalAppointment["status"]) => {
    if (appt) updateStatus(appt.id, status)
  }


  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogTitle className="text-lg leading-tight">{item.customer_name}</DialogTitle>
              <p className="mt-0.5 text-sm text-zinc-500">{item.customer_phone || item.customer_email || t.admin.noContact}</p>
            </div>
            <span className={cn("mt-0.5 shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold", sc.ring, sc.bg, sc.text)}>
              {isAppt && appt ? statusLabel(appt.status, language) : wl?.status}
            </span>
          </div>
        </DialogHeader>

        {/* Info grid */}
        <div className="space-y-2 rounded-xl border border-zinc-100 bg-zinc-50 p-3.5">
          {item.services?.name && (
            <InfoRow icon={<BriefcaseBusiness className="h-4 w-4 text-zinc-400" />} label={item.services.name}
              detail={appt?.services?.duration_minutes ? `${appt.services.duration_minutes} min` : undefined} />
          )}
          {isAppt && appt && (
            <>
              <InfoRow icon={<CalendarDays className="h-4 w-4 text-zinc-400" />}
                label={format(parseISO(appt.appointment_date), "EEEE, MMMM d")}
                detail={`${appt.start_time.slice(0, 5)} – ${appt.end_time.slice(0, 5)}`} />
              {appt.staff_members?.name && (
                <InfoRow icon={<Users className="h-4 w-4 text-zinc-400" />}
                  label={appt.staff_members.name} detail={appt.staff_members.role ?? undefined} />
              )}
            </>
          )}
          {!isAppt && wl && (
            <InfoRow icon={<Clock className="h-4 w-4 text-zinc-400" />}
              label={`Wants ${format(parseISO(wl.preferred_date), "MMMM d")}`} />
          )}
          {item.participants_count > 1 && (
            <InfoRow icon={<Users className="h-4 w-4 text-zinc-400" />} label={`${item.participants_count} participants`} />
          )}
        </div>

        {/* Contact buttons */}
        {(telUrl || waUrl || reminderWaUrl) && (
          <div className="flex flex-wrap gap-2">
            {telUrl && (
              <Button asChild variant="outline" className="flex-1 gap-2">
                <a href={telUrl}>
                  <Phone className="h-4 w-4" /> {t.common.call}
                </a>
              </Button>
            )}
            {waUrl && (
              <Button asChild variant="outline" className="flex-1 gap-2 border-green-200 text-green-700 hover:bg-green-50">
                <a href={waUrl} target="_blank" rel="noreferrer">
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </a>
              </Button>
            )}
            {isAppt && appt && appt.status !== "cancelled" && appt.status !== "completed" && reminderWaUrl && (
              <Button asChild variant="outline" className="flex-1 gap-2 border-blue-200 text-blue-700 hover:bg-blue-50">
                <a href={reminderWaUrl} target="_blank" rel="noreferrer">
                  <Bell className="h-4 w-4" /> {t.admin.sendReminder}
                </a>
              </Button>
            )}
          </div>
        )}

        {/* Status actions — appointments only */}
        {isAppt && appt && (appt.status === "pending" || appt.status === "booked" || appt.status === "confirmed") && (
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            {appt.status === "pending" && (
              <>
                <Button disabled={isBusy} className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={() => handleStatus("booked")}>
                  {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {t.admin.confirmBooking}
                </Button>
                <Button disabled={isBusy} variant="outline" className="flex-1 text-red-600 hover:bg-red-50" onClick={() => handleStatus("cancelled")}>
                  <X className="h-4 w-4" /> {t.common.cancel}
                </Button>
              </>
            )}
            {(appt.status === "booked" || appt.status === "confirmed") && (
              <>
                <Button disabled={isBusy} className="flex-1" onClick={() => handleStatus("completed")}>
                  {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {t.admin.markDone}
                </Button>
                <Button disabled={isBusy} variant="outline" className="flex-1 text-red-600 hover:bg-red-50" onClick={() => handleStatus("cancelled")}>
                  <X className="h-4 w-4" /> {t.common.cancel}
                </Button>
              </>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

function InfoRow({ icon, label, detail }: { icon: React.ReactNode; label: string; detail?: string }) {
  return (
    <div className="flex items-center gap-2.5 text-sm">
      {icon}
      <span className="flex-1 font-medium text-zinc-900">{label}</span>
      {detail && <span className="text-zinc-500">{detail}</span>}
    </div>
  )
}

// ── Services editor ───────────────────────────────────────────────────────────

type ServiceDraft = { id?: string; name: string; description: string; price: string; duration_minutes: string; active: boolean }

function ServicesEditor({ slug, services, onRefresh, currency = "USD", t }: { slug: string; services: PortalService[]; onRefresh: () => void; currency?: string; t: Dictionary }) {
  const [dialog, setDialog] = useState<ServiceDraft | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const openAdd = () => setDialog({ name: "", description: "", price: "0", duration_minutes: "30", active: true })
  const openEdit = (s: PortalService) => setDialog({ id: s.id, name: s.name, description: s.description ?? "", price: String(s.price), duration_minutes: String(s.duration_minutes), active: s.active })

  const save = async () => {
    if (!dialog) return
    setSaving(true)
    const res = await fetch(`/api/admin/portal/${slug}/services`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...(dialog.id ? { id: dialog.id } : {}), name: dialog.name, description: dialog.description || null, price: parseFloat(dialog.price) || 0, duration_minutes: parseInt(dialog.duration_minutes) || 30, active: dialog.active }),
    })
    const result = await res.json().catch(() => ({}))
    if (!res.ok) { toast({ variant: "destructive", title: t.admin.saveServiceError, description: result.error }) }
    else { toast({ title: t.admin.serviceSaved }); setDialog(null); onRefresh() }
    setSaving(false)
  }

  const remove = async (id: string) => {
    setDeleting(id)
    const res = await fetch(`/api/admin/portal/${slug}/services?id=${id}`, { method: "DELETE" })
    const result = await res.json().catch(() => ({}))
    if (!res.ok) { toast({ variant: "destructive", title: t.admin.deleteServiceError, description: result.error }) }
    else { toast({ title: t.admin.serviceDeleted }); onRefresh() }
    setDeleting(null)
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <SectionTitle>{t.common.services}</SectionTitle>
        <Button size="sm" onClick={openAdd}><Plus className="h-4 w-4" /> {t.common.addService}</Button>
      </div>
      {services.length === 0 ? (
        <EmptyState icon={<BriefcaseBusiness className="mx-auto mb-2 h-5 w-5" />} text={t.admin.noServices} />
      ) : (
        <div className="divide-y divide-zinc-100 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          {services.map(s => (
            <div key={s.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-semibold text-zinc-950">{s.name}</p>
                  {!s.active && <Badge variant="outline" className="shrink-0 text-zinc-400">{t.common.hidden}</Badge>}
                </div>
                <p className="text-xs text-zinc-500">{s.duration_minutes} min · {formatCurrency(s.price, currency)}</p>
                {s.description && <p className="mt-0.5 line-clamp-1 text-xs text-zinc-400">{s.description}</p>}
              </div>
              <div className="flex shrink-0 gap-1">
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(s)}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:bg-red-50" disabled={deleting === s.id} onClick={() => remove(s.id)}>
                  {deleting === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      <Dialog open={!!dialog} onOpenChange={v => !v && setDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{dialog?.id ? `${t.common.edit} ${t.common.service}` : t.common.addService}</DialogTitle></DialogHeader>
          {dialog && (
            <div className="space-y-3">
              <Field label={t.admin.serviceName}><Input value={dialog.name} onChange={e => setDialog(d => d && { ...d, name: e.target.value })} /></Field>
              <Field label={t.common.description}><Input value={dialog.description} onChange={e => setDialog(d => d && { ...d, description: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t.common.price}><Input type="number" min="0" step="0.01" value={dialog.price} onChange={e => setDialog(d => d && { ...d, price: e.target.value })} /></Field>
                <Field label={`${t.common.duration} (min)`}><Input type="number" min="5" step="5" value={dialog.duration_minutes} onChange={e => setDialog(d => d && { ...d, duration_minutes: e.target.value })} /></Field>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-zinc-200 p-3">
                <Label>{t.common.active}</Label>
                <Switch checked={dialog.active} onCheckedChange={v => setDialog(d => d && { ...d, active: v })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>{t.common.cancel}</Button>
            <Button disabled={saving || !dialog?.name} onClick={save}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} {t.common.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

// ── Staff editor ──────────────────────────────────────────────────────────────

type StaffDraft = { id?: string; name: string; role: string; bio: string; active: boolean }

function StaffEditor({ slug, staff, onRefresh, t }: { slug: string; staff: PortalStaff[]; onRefresh: () => void; t: Dictionary }) {
  const [dialog, setDialog] = useState<StaffDraft | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const openAdd = () => setDialog({ name: "", role: "", bio: "", active: true })
  const openEdit = (s: PortalStaff) => setDialog({ id: s.id, name: s.name, role: s.role ?? "", bio: s.bio ?? "", active: s.active })

  const save = async () => {
    if (!dialog) return
    setSaving(true)
    const res = await fetch(`/api/admin/portal/${slug}/staff`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...(dialog.id ? { id: dialog.id } : {}), name: dialog.name, role: dialog.role || null, bio: dialog.bio || null, active: dialog.active }),
    })
    const result = await res.json().catch(() => ({}))
    if (!res.ok) { toast({ variant: "destructive", title: t.admin.saveStaffError, description: result.error }) }
    else { toast({ title: t.admin.staffSaved }); setDialog(null); onRefresh() }
    setSaving(false)
  }

  const remove = async (id: string) => {
    setDeleting(id)
    const res = await fetch(`/api/admin/portal/${slug}/staff?id=${id}`, { method: "DELETE" })
    const result = await res.json().catch(() => ({}))
    if (!res.ok) { toast({ variant: "destructive", title: t.admin.deleteStaffError, description: result.error }) }
    else { toast({ title: t.admin.staffDeleted }); onRefresh() }
    setDeleting(null)
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <SectionTitle>{t.common.staff}</SectionTitle>
        <Button size="sm" onClick={openAdd}><Plus className="h-4 w-4" /> {t.common.addMember}</Button>
      </div>
      {staff.length === 0 ? (
        <EmptyState icon={<Users className="mx-auto mb-2 h-5 w-5" />} text={t.admin.noStaff} />
      ) : (
        <div className="divide-y divide-zinc-100 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          {staff.map(s => (
            <div key={s.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-violet-700">
                {s.name.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-semibold text-zinc-950">{s.name}</p>
                  {!s.active && <Badge variant="outline" className="shrink-0 text-zinc-400">{t.common.hidden}</Badge>}
                </div>
                {s.role && <p className="text-xs text-zinc-500">{s.role}</p>}
              </div>
              <div className="flex shrink-0 gap-1">
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(s)}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:bg-red-50" disabled={deleting === s.id} onClick={() => remove(s.id)}>
                  {deleting === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      <Dialog open={!!dialog} onOpenChange={v => !v && setDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{dialog?.id ? `${t.common.edit} ${t.common.staff}` : t.common.addStaff}</DialogTitle></DialogHeader>
          {dialog && (
            <div className="space-y-3">
              <Field label={t.common.name}><Input value={dialog.name} onChange={e => setDialog(d => d && { ...d, name: e.target.value })} /></Field>
              <Field label={t.common.role}><Input value={dialog.role} onChange={e => setDialog(d => d && { ...d, role: e.target.value })} /></Field>
              <Field label={t.common.bio}><Input value={dialog.bio} onChange={e => setDialog(d => d && { ...d, bio: e.target.value })} /></Field>
              <div className="flex items-center justify-between rounded-lg border border-zinc-200 p-3">
                <Label>{t.common.active}</Label>
                <Switch checked={dialog.active} onCheckedChange={v => setDialog(d => d && { ...d, active: v })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>{t.common.cancel}</Button>
            <Button disabled={saving || !dialog?.name} onClick={save}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} {t.common.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

// ── Working hours editor ──────────────────────────────────────────────────────

type DayDraft = { is_open: boolean; open_time: string; close_time: string; breaks: { start_time: string; end_time: string }[] }

function initDraft(wh: PortalWorkingHour[], breaks: PortalBreak[]): Record<number, DayDraft> {
  const d: Record<number, DayDraft> = {}
  for (let i = 0; i < 7; i++) {
    const h = wh.find(x => x.day_of_week === i)
    d[i] = {
      is_open: h?.is_open ?? false,
      open_time: h?.open_time?.slice(0, 5) ?? "09:00",
      close_time: h?.close_time?.slice(0, 5) ?? "18:00",
      breaks: breaks.filter(b => b.day_of_week === i).map(b => ({ start_time: b.start_time.slice(0, 5), end_time: b.end_time.slice(0, 5) })),
    }
  }
  return d
}

function HoursEditor({ slug, workingHours, breaks, onRefresh, t }: { slug: string; workingHours: PortalWorkingHour[]; breaks: PortalBreak[]; onRefresh: () => void; t: Dictionary }) {
  const [draft, setDraft] = useState<Record<number, DayDraft>>(() => initDraft(workingHours, breaks))
  const [saving, setSaving] = useState(false)

  useEffect(() => { setDraft(initDraft(workingHours, breaks)) }, [workingHours, breaks])

  const updDay = (i: number, p: Partial<DayDraft>) => setDraft(d => ({ ...d, [i]: { ...d[i], ...p } }))
  const addBreak = (i: number) => setDraft(d => ({ ...d, [i]: { ...d[i], breaks: [...d[i].breaks, { start_time: "12:00", end_time: "13:00" }] } }))
  const updBreak = (i: number, bi: number, p: Partial<{ start_time: string; end_time: string }>) =>
    setDraft(d => ({ ...d, [i]: { ...d[i], breaks: d[i].breaks.map((b, j) => j === bi ? { ...b, ...p } : b) } }))
  const rmBreak = (i: number, bi: number) =>
    setDraft(d => ({ ...d, [i]: { ...d[i], breaks: d[i].breaks.filter((_, j) => j !== bi) } }))

  const save = async () => {
    setSaving(true)
    const days = Array.from({ length: 7 }, (_, i) => ({ day_of_week: i, ...draft[i] }))
    const res = await fetch(`/api/admin/portal/${slug}/hours`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ days }) })
    const result = await res.json().catch(() => ({}))
    if (!res.ok) { toast({ variant: "destructive", title: t.admin.saveHoursError, description: result.error }) }
    else { toast({ title: t.admin.hoursSaved }); onRefresh() }
    setSaving(false)
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <SectionTitle>{t.common.workingHours}</SectionTitle>
        <Button size="sm" disabled={saving} onClick={save}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {t.admin.saveHours}
        </Button>
      </div>
      <div className="space-y-2">
        {t.days.map((day, i) => {
          const d = draft[i]
          return (
            <div key={day} className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Switch checked={d.is_open} onCheckedChange={v => updDay(i, { is_open: v })} />
                <span className={cn("w-24 shrink-0 text-sm font-semibold", !d.is_open && "text-zinc-400")}>{day}</span>
                {d.is_open ? (
                  <div className="flex items-center gap-2">
                    <Input type="time" value={d.open_time} className="h-8 w-[100px] text-sm" onChange={e => updDay(i, { open_time: e.target.value })} />
                    <span className="text-xs text-zinc-400">–</span>
                    <Input type="time" value={d.close_time} className="h-8 w-[100px] text-sm" onChange={e => updDay(i, { close_time: e.target.value })} />
                  </div>
                ) : (
                  <span className="text-xs text-zinc-400">{t.common.closed}</span>
                )}
              </div>
              {d.is_open && (
                <div className="border-t border-zinc-100 px-4 pb-3 pt-2">
                  <div className="space-y-1.5">
                    {d.breaks.map((b, bi) => (
                      <div key={bi} className="flex items-center gap-2">
                        <span className="w-14 shrink-0 text-xs text-zinc-400">{t.common.break}</span>
                        <Input type="time" value={b.start_time} className="h-7 w-[88px] text-xs" onChange={e => updBreak(i, bi, { start_time: e.target.value })} />
                        <span className="text-xs text-zinc-400">–</span>
                        <Input type="time" value={b.end_time} className="h-7 w-[88px] text-xs" onChange={e => updBreak(i, bi, { end_time: e.target.value })} />
                        <button type="button" onClick={() => rmBreak(i, bi)} className="text-red-400 hover:text-red-600"><X className="h-3.5 w-3.5" /></button>
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={() => addBreak(i)} className="mt-2 flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-800">
                    <Plus className="h-3 w-3" /> {t.common.addBreak}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ── History ───────────────────────────────────────────────────────────────────

function HistoryList({ events, t }: { events: AppointmentEvent[]; t: Dictionary }) {
  return (
    <section>
      <SectionTitle>{t.common.history}</SectionTitle>
      {events.length === 0 ? (
        <EmptyState icon={<History className="mx-auto mb-2 h-5 w-5" />} text={t.admin.noActivity} />
      ) : (
        <div className="divide-y divide-zinc-100 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          {events.map(e => (
            <div key={e.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-zinc-950">{e.title}</p>
                {e.description && <p className="mt-0.5 text-xs text-zinc-500">{e.description}</p>}
              </div>
              <p className="shrink-0 text-xs text-zinc-400">{format(parseISO(e.created_at), "MMM d, HH:mm")}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

// ── iOS install dialog ────────────────────────────────────────────────────────

function IosInstallDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Add to Home Screen</DialogTitle></DialogHeader>
        <ol className="mt-2 space-y-3 text-sm text-zinc-700">
          {[
            <>In Safari tap the <Share className="inline h-4 w-4 text-zinc-500" /> <strong>Share</strong> button at the bottom.</>,
            <>Tap <strong>Add to Home Screen</strong>.</>,
            <>Tap <strong>Add</strong> in the top-right.</>,
            <>Open the app from your home screen, then tap <strong>Enable notifications</strong>.</>,
          ].map((s, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
        <Button className="mt-2 w-full" onClick={onClose}>Got it</Button>
      </DialogContent>
    </Dialog>
  )
}

// ── Shared primitives ─────────────────────────────────────────────────────────

function StatCard({ label, value, accent }: { label: string; value: number; accent: "amber" | "violet" | "sky" }) {
  const cls = {
    amber:  "bg-amber-50  border-amber-100  text-amber-600",
    violet: "bg-violet-50 border-violet-100 text-violet-600",
    sky:    "bg-sky-50    border-sky-100    text-sky-600",
  }
  return (
    <div className={cn("rounded-2xl border p-3 text-center shadow-sm", cls[accent])}>
      <p className="text-2xl font-black">{value}</p>
      <p className="mt-0.5 text-xs font-semibold opacity-75">{label}</p>
    </div>
  )
}

function OverviewCard({ title, value, detail, href }: { title: string; value: number; detail: string; href: string }) {
  return (
    <Link href={href} className="block rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm hover:bg-zinc-50 transition-colors">
      <p className="text-sm font-medium text-zinc-500">{title}</p>
      <p className="mt-2 text-3xl font-black text-zinc-950">{value}</p>
      <p className="mt-1 text-xs text-zinc-400">{detail}</p>
    </Link>
  )
}

function ActionPanel({ title, description, href, buttonLabel, icon }: { title: string; description: string; href: string; buttonLabel: string; icon: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-zinc-950">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-zinc-500">{description}</p>
      <Link href={href} className="mt-4 inline-block">
        <Button>{icon}{buttonLabel}</Button>
      </Link>
    </section>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 text-base font-bold text-zinc-950">{children}</h2>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label>{label}</Label>{children}</div>
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 py-12 text-center text-sm text-zinc-400">
      {icon}{text}
    </div>
  )
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = window.atob(base64)
  const out = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) out[i] = rawData.charCodeAt(i)
  return out
}
