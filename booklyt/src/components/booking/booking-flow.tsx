"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { format, addDays, isBefore, isAfter, parseISO, startOfDay } from "date-fns"
import { arSA } from "date-fns/locale"
import { DayPicker } from "react-day-picker"
import "react-day-picker/dist/style.css"
import {
  Scissors,
  Users,
  Calendar,
  Clock,
  User,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ArrowRight,
} from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Business, Service, ServiceCategory, StaffMember, StaffService, WorkingHours } from "@/types/database"
import type { CalendarView } from "@/types/builder"
import type { CustomerUser } from "@/lib/customer-auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { formatCurrency, formatDuration, getInitials } from "@/lib/utils"
import { type TimeSlot } from "@/lib/booking/slots"
import { resolveVerificationMethod } from "@/lib/booking-verification"

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

const STEPS = [
  { id: 1, label: "Service", icon: Scissors },
  { id: 2, label: "Staff", icon: Users },
  { id: 3, label: "Date & Time", icon: Calendar },
  { id: 4, label: "Your details", icon: User },
  { id: 5, label: "Confirmed", icon: CheckCircle2 },
]

const bookingText = {
  en: {
    service: "Service",
    staff: "Staff",
    dateTime: "Date & Time",
    details: "Your details",
    confirmed: "Confirmed",
    chooseService: "Choose a service",
    chooseServiceSub: "What would you like to book?",
    noServices: "No services available yet.",
    chooseStaff: "Choose a team member",
    chooseStaffSub: "Or skip to see all availability",
    anyAvailable: "Any available",
    allOpenSlots: "Show all open slots",
    pickDateTime: "Pick a date & time",
    chooseWhen: "Choose when you'd like to come in",
    sessionIs: "Session is",
    selectDateFirst: "Select a date first",
    noSlots: "No slots available on this date",
    waitlistHelp: "Join the waitlist and the business can contact you if a spot opens.",
    waitlistJoined: "You are on the waitlist for this date.",
    fullName: "Full name *",
    yourName: "Your name",
    phone: "Phone number *",
    participants: "Participants",
    participantsHelp: "participants can join this session.",
    notes: "Notes (optional)",
    notesPlaceholder: "Any special requests?",
    back: "Back",
    confirmBooking: "Confirm booking",
    bookingConfirmed: "Booking confirmed",
    confirmationCopy: "Your appointment is all set.",
    manageBooking: "Manage or cancel this booking",
    bookAnother: "Book another appointment",
    with: "With",
    date: "Date",
    time: "Time",
    availability: "Availability",
    total: "Total",
    left: "left",
    joinWaitlist: "Join waitlist",
    existingBookingTitle: "You already have an upcoming booking",
    existingBookingHelp: "Manage your current booking, or start a new one if you need another appointment.",
    manageExistingBooking: "Manage existing booking",
    startNewBooking: "Start new booking",
    reminderPushTitle: "Get appointment reminders",
    reminderPushHelp: "Receive a push notification 1 hour before your appointment.",
    enableReminders: "Enable reminders 🔔",
    remindersEnabled: "Reminders enabled!",
    remindersEnabledHelp: "You'll get a notification 1 hour before your appointment.",
    returnHome: "Return to homepage",
    chooseCategory: "Choose a category",
    chooseCategorySub: "Choose a category to see its services.",
    changeCategory: "Back to categories",
    otherServices: "Other services",
    noStaffForService: "No one is set up for this service yet.",
  },
  ar: {
    service: "الخدمة",
    staff: "الفريق",
    dateTime: "التاريخ والوقت",
    details: "بياناتك",
    confirmed: "تم التأكيد",
    chooseService: "اختر خدمة",
    chooseServiceSub: "ماذا تريد أن تحجز؟",
    noServices: "لا توجد خدمات متاحة حالياً.",
    chooseStaff: "اختر أحد أفراد الفريق",
    chooseStaffSub: "أو شاهد كل المواعيد المتاحة",
    anyAvailable: "أي شخص متاح",
    allOpenSlots: "عرض كل المواعيد المتاحة",
    pickDateTime: "اختر التاريخ والوقت",
    chooseWhen: "اختر الوقت المناسب لك",
    sessionIs: "مدة الجلسة",
    selectDateFirst: "اختر التاريخ أولاً",
    noSlots: "لا توجد مواعيد متاحة في هذا التاريخ",
    waitlistHelp: "انضم إلى قائمة الانتظار وسيتواصل معك العمل إذا توفر موعد.",
    waitlistJoined: "تمت إضافتك إلى قائمة الانتظار لهذا التاريخ.",
    fullName: "الاسم الكامل *",
    yourName: "اسمك",
    phone: "رقم الهاتف *",
    participants: "عدد المشاركين",
    participantsHelp: "مشاركين يمكنهم الانضمام لهذه الجلسة.",
    notes: "ملاحظات (اختياري)",
    notesPlaceholder: "أي طلبات خاصة؟",
    back: "رجوع",
    confirmBooking: "تأكيد الحجز",
    bookingConfirmed: "تم تأكيد الحجز",
    confirmationCopy: "تم حجز موعدك.",
    manageBooking: "إدارة أو إلغاء هذا الحجز",
    bookAnother: "حجز موعد آخر",
    with: "مع",
    date: "التاريخ",
    time: "الوقت",
    availability: "التوفر",
    total: "المجموع",
    left: "متبقي",
    joinWaitlist: "انضم لقائمة الانتظار",
    existingBookingTitle: "لديك حجز قادم بالفعل",
    existingBookingHelp: "يمكنك إدارة حجزك الحالي أو بدء حجز جديد إذا كنت تحتاج موعداً آخر.",
    manageExistingBooking: "إدارة الحجز الحالي",
    startNewBooking: "بدء حجز جديد",
    reminderPushTitle: "احصل على تذكيرات",
    reminderPushHelp: "سيصلك إشعار قبل موعدك بساعة.",
    enableReminders: "تفعيل التذكيرات 🔔",
    remindersEnabled: "تم تفعيل التذكيرات!",
    remindersEnabledHelp: "ستصلك إشعار قبل موعدك بساعة.",
    returnHome: "العودة إلى الصفحة الرئيسية",
    chooseCategory: "اختر فئة",
    chooseCategorySub: "اختر فئة لعرض خدماتها.",
    changeCategory: "العودة إلى الفئات",
    otherServices: "خدمات أخرى",
    noStaffForService: "لا يوجد موظف مخصص لهذه الخدمة بعد.",
  },
} as const

type BookingCopy = { [K in keyof typeof bookingText.en]: string }

const customerSchema = z.object({
  name: z.string().min(2, "Name is required"),
  phone: z.string().min(1, "Phone number is required"),
  notes: z.string().optional(),
  participants_count: z.coerce.number().int().positive().optional(),
})

type CustomerForm = z.infer<typeof customerSchema>

interface BookingFlowProps {
  business: Business
  services: Service[]
  categories?: ServiceCategory[]
  staff: StaffMember[]
  staffServices?: StaffService[]
  workingHours: WorkingHours[]
  calendarView?: CalendarView
  forceMobileLayout?: boolean
  previewSlots?: TimeSlot[]
  previewMode?: boolean
  initialExistingBookings?: { manage_url: string; appointment_date: string; start_time: string }[]
  brandColor?: string     // Tenant primary color — themes calendar + time slots + CTA
  brandRadius?: string    // Tenant border radius
  currentCustomerUser?: CustomerUser | null
  authUrl?: string
}

export function BookingFlow({
  business,
  services,
  categories = [],
  staff,
  staffServices = [],
  workingHours,
  brandColor,
  brandRadius,
  calendarView = "monthly",
  forceMobileLayout = false,
  previewSlots,
  previewMode = false,
  initialExistingBookings = [],
  currentCustomerUser,
}: BookingFlowProps) {
  const accent = brandColor ?? '#7c3aed'
  const radius = brandRadius ?? '12px'
  const language = business.language ?? "en"
  const isArabic = language === "ar"
  const t = bookingText[language] as BookingCopy
  const dateLocale = isArabic ? arSA : undefined
  const formatDate = (date: Date, pattern: string) => format(date, pattern, dateLocale ? { locale: dateLocale } : undefined)
  const durationLabel = (minutes: number) => (isArabic ? `${minutes} \u062f\u0642\u064a\u0642\u0629` : formatDuration(minutes))
  const [step, setStep] = useState(1)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [slots, setSlots] = useState<TimeSlot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [manageUrl, setManageUrl] = useState<string | null>(null)
  const [waitlistOpen, setWaitlistOpen] = useState(false)
  const [waitlistSubmitting, setWaitlistSubmitting] = useState(false)
  const [waitlistJoined, setWaitlistJoined] = useState(false)
  const [, setWaitlistEntryId] = useState<string | null>(null)
  const [waitlistError, setWaitlistError] = useState<string | null>(null)
  const [waitlistName, setWaitlistName] = useState(currentCustomerUser?.full_name ?? "")
  const [waitlistEmail, setWaitlistEmail] = useState("")
  const [waitlistPhone, setWaitlistPhone] = useState(currentCustomerUser?.phone ?? "")
  const [waitlistParticipants, setWaitlistParticipants] = useState(1)
  const [waitlistEras, setWaitlistEras] = useState<string[]>([])
  const [pushSubscribed, setPushSubscribed] = useState(false)
  const [appointmentId, setAppointmentId] = useState<string | null>(null)
  const [apptPushSubscribed, setApptPushSubscribed] = useState(false)
  const [apptPushSubscribing, setApptPushSubscribing] = useState(false)
  const [notifyModalDismissed, setNotifyModalDismissed] = useState(true) // start hidden, show after detect
  const [installBannerDismissed, setInstallBannerDismissed] = useState(true)
  const [installOS, setInstallOS] = useState<'ios' | 'android' | null>(null)
  const [installStep, setInstallStep] = useState(0)

  // ── OTP auth (inline, before step 4) ─────────────────────────────────────
  const verificationMethod = previewMode ? 'none' : resolveVerificationMethod(business.booking_verification_method)
  const [verifiedUser, setVerifiedUser] = useState(currentCustomerUser ?? null)
  const [otpPhase, setOtpPhase] = useState<null | 'phone' | 'verify'>(null)
  const [pendingLinkVerification, setPendingLinkVerification] = useState(false)
  const [otpPhone, setOtpPhone] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [otpLoading, setOtpLoading] = useState(false)
  const [otpError, setOtpError] = useState<string | null>(null)
  const [otpCountdown, setOtpCountdown] = useState(0)

  // Re-check session client-side (cookie may have been set after server render)
  useEffect(() => {
    if (previewMode || verifiedUser) return
    fetch('/api/customer/auth/me')
      .then(r => r.json())
      .then(data => {
        if (data.user) {
          setVerifiedUser(data.user)
          setValue('phone', data.user.phone)
          if (data.user.full_name) setValue('name', data.user.full_name)
          if (data.user.phone) setWaitlistPhone(data.user.phone)
          if (data.user.full_name) setWaitlistName(data.user.full_name)
        }
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (previewMode) return
    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as { standalone?: boolean }).standalone === true
    // Show install guide on mobile browsers (not PWA)
    if (!standalone) {
      const ua = navigator.userAgent
      const isIosDevice = /iPhone|iPad|iPod/i.test(ua)
      const isAndroidDevice = /Android/i.test(ua)
      if (isIosDevice || isAndroidDevice) {
        try {
          if (!localStorage.getItem(`pwa_install_dismissed_${business.id}`)) {
            setInstallOS(isIosDevice ? 'ios' : 'android')
            setInstallBannerDismissed(false)
          }
        } catch { /* storage unavailable */ }
      }
    }

    if (!standalone) return
    try {
      if (localStorage.getItem(`pwa_notify_dismissed_${business.id}`)) return
    } catch { /* storage unavailable */ }
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      setNotifyModalDismissed(false)
    }
  }, [business.id, previewMode])

  const dismissNotifyModal = (permanent = false) => {
    setNotifyModalDismissed(true)
    if (permanent) {
      try { localStorage.setItem(`pwa_notify_dismissed_${business.id}`, '1') } catch { /* storage unavailable */ }
    }
  }

  const dismissInstallBanner = () => {
    setInstallBannerDismissed(true)
    try { localStorage.setItem(`pwa_install_dismissed_${business.id}`, '1') } catch { /* storage unavailable */ }
  }

  type ExistingAppt = { manage_url: string; appointment_date: string; start_time: string }
  const [existingAppts, setExistingAppts] = useState<ExistingAppt[]>(() => initialExistingBookings)
  const [existingApptIdx, setExistingApptIdx] = useState(0)
  const [forceNewBooking, setForceNewBooking] = useState(false)
  const [bookingError, setBookingError] = useState<string | null>(null)
  const forceNewRef = useRef(false)
  const [managingToken, setManagingToken] = useState<string | null>(null)

  // On mount: merge localStorage bookings with server-provided ones
  useEffect(() => {
    if (previewMode) return
    try {
      const stored = localStorage.getItem(`bf_bookings_${business.id}`)
      if (!stored) return
      const storedBookings: ExistingAppt[] = JSON.parse(stored)
      const todayStr = new Date().toISOString().slice(0, 10)
      const future = storedBookings.filter(b => b?.manage_url && b.appointment_date >= todayStr)
      if (future.length === 0) return
      setExistingAppts(prev => {
        const merged = [...prev]
        for (const b of future) {
          if (!merged.some(e => e.manage_url === b.manage_url)) merged.push(b)
        }
        return merged.sort((a, b) =>
          a.appointment_date.localeCompare(b.appointment_date) || a.start_time.localeCompare(b.start_time)
        )
      })
    } catch { /* storage unavailable */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CustomerForm>({
    resolver: zodResolver(customerSchema),
    defaultValues: verifiedUser
      ? {
          name: verifiedUser.full_name ?? '',
          phone: verifiedUser.phone,
        }
      : undefined,
  })

  // Silent re-registration: if customer returns after closing the browser,
  // restore their push subscription using the token stored in localStorage.
  useEffect(() => {
    if (previewMode) return
    const token = typeof window !== 'undefined' ? localStorage.getItem('wl_notify_token') : null
    if (!token || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.ready.then(reg =>
      reg.pushManager.getSubscription().then(async sub => {
        if (!sub) return
        const j = sub.toJSON()
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notify_token: token, endpoint: j.endpoint, keys: j.keys }),
        }).catch(() => {})
      })
    ).catch(() => {})
  }, [previewMode])

  const today = startOfDay(new Date())
  const weekDates = Array.from({ length: 7 }, (_, index) => addDays(today, index))
  const isGroupBooking = business.booking_mode === "group"
  const maxParticipants = selectedSlot?.available_spots ?? business.group_capacity ?? 1
  // Staff who perform a given service. A member with no assignments at all is
  // treated as performing everything, so businesses that never assigned
  // services keep behaving exactly as before.
  const staffForService = (service: Service | null) => {
    if (!service) return staff
    return staff.filter(member => {
      const assigned = staffServices.filter(link => link.staff_member_id === member.id)
      return assigned.length === 0 || assigned.some(link => link.service_id === service.id)
    })
  }
  const eligibleStaff = staffForService(selectedService)
  const needsStaffChoice = eligibleStaff.length > 1

  const hasCategories = categories.length > 0
  const uncategorisedServices = services.filter(
    service => !service.category_id || !categories.some(category => category.id === service.category_id)
  )
  const serviceGroups = [
    ...categories.map(category => ({
      id: category.id,
      name: category.name,
      services: services.filter(service => service.category_id === category.id),
    })),
    ...(uncategorisedServices.length ? [{ id: "uncategorised", name: t.otherServices, services: uncategorisedServices }] : []),
  ]
  // A deleted category returns the customer to the category chooser. With no
  // categories at all, show the original flat service list, including orphans.
  const selectedCategory = hasCategories ? serviceGroups.find(group => group.id === categoryFilter) : undefined
  const choosingCategory = hasCategories && !selectedCategory
  const visibleServiceGroups = !hasCategories
    ? [{ id: "all", name: "", services }]
    : selectedCategory ? [selectedCategory] : []
  const currentAppt = existingAppts[existingApptIdx] ?? null
  const existingBookingNotice = existingAppts.length > 0 && !forceNewBooking && step < 5 ? (
    <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5">
          <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-semibold text-amber-950">{t.existingBookingTitle}</p>
            {currentAppt?.appointment_date ? (
              <p className="mt-0.5 text-xs font-medium text-amber-700">
                {formatDate(parseISO(currentAppt.appointment_date), "EEEE, MMMM d")}
                {" · "}
                {currentAppt.start_time.slice(0, 5)}
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-amber-700">{t.existingBookingHelp}</p>
            )}
          </div>
        </div>
        {/* Arrow navigation for multiple appointments */}
        {existingAppts.length > 1 && (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              disabled={existingApptIdx === 0}
              onClick={() => setExistingApptIdx(i => Math.max(0, i - 1))}
              className="flex h-6 w-6 items-center justify-center rounded-full border border-amber-300 bg-[var(--bf-card)] text-amber-700 disabled:opacity-30"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="min-w-[28px] text-center text-[11px] font-semibold text-amber-700">
              {existingApptIdx + 1}/{existingAppts.length}
            </span>
            <button
              type="button"
              disabled={existingApptIdx === existingAppts.length - 1}
              onClick={() => setExistingApptIdx(i => Math.min(existingAppts.length - 1, i + 1))}
              className="flex h-6 w-6 items-center justify-center rounded-full border border-amber-300 bg-[var(--bf-card)] text-amber-700 disabled:opacity-30"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        {currentAppt?.manage_url && (
          <button
            type="button"
            onClick={() => {
              const token = currentAppt.manage_url.split("/manage-booking/")[1]
              if (token) setManagingToken(token)
            }}
            className="inline-flex flex-1 items-center justify-center rounded-lg bg-amber-900 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-950"
          >
            {t.manageExistingBooking}
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            forceNewRef.current = true
            setForceNewBooking(true)
            setExistingAppts([])
            setBookingError(null)
          }}
          className="inline-flex flex-1 items-center justify-center rounded-lg border border-amber-300 bg-[var(--bf-card)] px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100"
        >
          {t.startNewBooking}
        </button>
      </div>
    </div>
  ) : null

  const bookingDaysAhead = business.booking_days_ahead ?? null
  const maxBookingDate = bookingDaysAhead != null ? addDays(today, bookingDaysAhead) : null

  const isDisabledDay = (date: Date) => {
    if (isBefore(date, today)) return true
    if (maxBookingDate && isAfter(date, maxBookingDate)) return true
    const dow = date.getDay()
    const wh = workingHours.find((h) => h.day_of_week === dow)
    return !wh || !wh.is_open
  }

  const handleDateSelect = async (date: Date | undefined) => {
    setSelectedDate(date)
    setSelectedSlot(null)
    setWaitlistOpen(false)
    setWaitlistJoined(false)
    setWaitlistError(null)
    if (!date || !selectedService) return

    if (previewSlots) {
      setSlots(previewSlots)
      return
    }

    setLoadingSlots(true)

    try {
      const dateStr = format(date, "yyyy-MM-dd")
      const params = new URLSearchParams({
        business_id: business.id,
        date: dateStr,
        duration: String(selectedService.duration_minutes),
        ...(selectedStaff ? { staff_id: selectedStaff.id } : {}),
      })
      const res = await fetch(`/api/slots?${params}`, { cache: "no-store" })
      const slotData = await res.json()
      let fetchedSlots: TimeSlot[] = slotData.slots ?? []

      // Drop past slots when the selected date is today
      const todayStr = format(new Date(), "yyyy-MM-dd")
      if (dateStr === todayStr) {
        const nowMins = new Date().getHours() * 60 + new Date().getMinutes()
        fetchedSlots = fetchedSlots.filter(s => {
          const [h, m] = s.time.split(":").map(Number)
          return h * 60 + m > nowMins
        })
      }

      setSlots(fetchedSlots)
    } catch {
      setSlots([])
    }

    setLoadingSlots(false)
  }

  const pushAvailable = !previewMode && typeof window !== 'undefined'
    && 'Notification' in window
    && 'serviceWorker' in navigator
    && 'PushManager' in navigator
    && window.isSecureContext

  // withPush=true: request permission + subscribe (mandatory for supported browsers)
  // withPush=false: skip push (fallback for unsupported/denied)
  const joinWaitlist = async (withPush = true) => {
    if (!selectedService || !selectedDate) return
    setWaitlistSubmitting(true)
    setWaitlistError(null)

    let pushSubJson: { endpoint?: string; keys?: Record<string, string> } | null = null

    // Step 1 — push permission (mandatory when supported)
    if (pushAvailable && withPush) {
      try {
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') {
          setWaitlistError(isArabic
            ? 'يجب السماح بالإشعارات لنتمكن من إعلامك. يرجى السماح بها من إعدادات المتصفح ثم حاول مجدداً.'
            : 'Notification permission is required so we can alert you instantly. Please allow notifications in your browser settings and try again.')
          setWaitlistSubmitting(false)
          return
        }
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
        if (vapidKey) {
          const reg = await navigator.serviceWorker.ready
          const sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey),
          })
          pushSubJson = sub.toJSON()
        }
      } catch {
        // push setup failed — still join, contact info is the fallback
      }
    }

    // Step 2 — create waitlist entry
    try {
      if (previewMode) {
        setWaitlistJoined(true)
        setPushSubscribed(!!pushSubJson)
        setWaitlistSubmitting(false)
        return
      }

      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_id: business.id,
          service_id: selectedService.id,
          staff_member_id: selectedStaff?.id ?? null,
          customer_name: waitlistName,
          customer_email: waitlistEmail || null,
          customer_phone: waitlistPhone || null,
          preferred_date: format(selectedDate, 'yyyy-MM-dd'),
          participants_count: isGroupBooking ? waitlistParticipants : 1,
          preferred_eras: waitlistEras,
        }),
      })
      const result = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(result.error ?? 'Could not join the waitlist.')

      if (result.entry_id) setWaitlistEntryId(result.entry_id)

      // Step 3 — save push subscription linked via notify_token + persist token
      if (pushSubJson && result.notify_token) {
        try { localStorage.setItem('wl_notify_token', result.notify_token) } catch {}
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            notify_token: result.notify_token,
            endpoint: pushSubJson.endpoint,
            keys: pushSubJson.keys,
          }),
        }).catch(() => {})
        setPushSubscribed(true)
        // Bridge: tell native app shell so it can link FCM token to this waitlist entry
        try { window.parent?.postMessage({ type: 'bf_notify_token', token: result.notify_token }, '*') } catch {}
      }

      setWaitlistJoined(true)
    } catch (err) {
      setWaitlistError(err instanceof Error ? err.message : 'Could not join the waitlist.')
    }
    setWaitlistSubmitting(false)
  }

  // ── OTP helpers ──────────────────────────────────────────────────────────────
  function startOtpCountdown(seconds: number) {
    setOtpCountdown(seconds)
    const iv = setInterval(() => {
      setOtpCountdown(prev => {
        if (prev <= 1) { clearInterval(iv); return 0 }
        return prev - 1
      })
    }, 1000)
  }

  async function sendBookingOtp() {
    if (previewMode) return
    setOtpLoading(true)
    setOtpError(null)
    try {
      const res = await fetch('/api/customer/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: otpPhone, purpose: 'booking', business_id: business.id }),
      })
      const data = await res.json()
      if (!res.ok) { setOtpError(data.error ?? 'Failed to send code'); return }
      setOtpPhase('verify')
      startOtpCountdown(data.expires_in ?? 600)
    } finally {
      setOtpLoading(false)
    }
  }

  async function verifyBookingOtp() {
    if (previewMode) return
    setOtpLoading(true)
    setOtpError(null)
    try {
      const res = await fetch('/api/customer/auth/otp/verify-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: otpPhone, code: otpCode }),
      })
      const data = await res.json()
      if (!res.ok) { setOtpError(data.error ?? 'Verification failed'); return }
      const user = data.user as { id: string; phone: string; full_name: string | null }
      setVerifiedUser(user)
      setValue('phone', user.phone)
      if (user.full_name) setValue('name', user.full_name)
      setOtpPhase(null)
      setOtpCode('')
    } finally {
      setOtpLoading(false)
    }
  }

  const subscribeApptPush = async (apptId: string, sendConfirmation = false) => {
    if (!pushAvailable) return false
    setApptPushSubscribing(true)
    try {
      const permission = Notification.permission === 'granted'
        ? 'granted'
        : await Notification.requestPermission()
      if (permission !== 'granted') { setApptPushSubscribing(false); return false }
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) { setApptPushSubscribing(false); return false }
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey) })
      const j = sub.toJSON()
      const subRes = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointment_id: apptId, endpoint: j.endpoint, keys: j.keys }),
      })
      if (sendConfirmation && subRes.ok) {
        fetch('/api/push/send-confirmation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appointment_id: apptId }),
        }).catch(() => {})
      }
      setApptPushSubscribed(true)
      setApptPushSubscribing(false)
      return true
    } catch { /* push setup failed */ }
    setApptPushSubscribing(false)
    return false
  }

  const onSubmit = async (data: CustomerForm) => {
    if (!selectedService || !selectedDate || !selectedSlot) return
    setSubmitting(true)
    setBookingError(null)

    // If user changed phone from their verified phone, clear the session link
    const phoneChanged = verifiedUser && data.phone.replace(/\D/g, '') !== verifiedUser.phone.replace(/\D/g, '')
    const effectiveUserId = phoneChanged ? null : (verifiedUser?.id ?? null)

    try {
      if (previewMode) {
        setManageUrl(null)
        setStep(5)
        setSubmitting(false)
        return
      }

      const res = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_id: business.id,
          service_id: selectedService.id,
          staff_member_id: selectedStaff?.id ?? null,
          customer_name: data.name,
          customer_email: null,
          customer_phone: data.phone,
          appointment_date: format(selectedDate, "yyyy-MM-dd"),
          start_time: selectedSlot.time,
          notes: data.notes ?? null,
          duration_minutes: selectedService.duration_minutes,
          participants_count: isGroupBooking ? data.participants_count ?? 1 : 1,
          force_new: true,
          customer_user_id: effectiveUserId,
        }),
      })

      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.error ?? "Booking failed")
      }

      if (result.manage_url && selectedDate && selectedSlot) {
        const newBooking: ExistingAppt = {
          manage_url: result.manage_url,
          appointment_date: format(selectedDate, "yyyy-MM-dd"),
          start_time: selectedSlot.time,
        }
        try {
          const raw = localStorage.getItem(`bf_bookings_${business.id}`)
          const arr: ExistingAppt[] = raw ? JSON.parse(raw) : []
          const todayStr = new Date().toISOString().slice(0, 10)
          const kept = arr.filter(b => b?.manage_url && b.appointment_date >= todayStr && b.manage_url !== newBooking.manage_url)
          kept.push(newBooking)
          kept.sort((a, b) => a.appointment_date.localeCompare(b.appointment_date) || a.start_time.localeCompare(b.start_time))
          localStorage.setItem(`bf_bookings_${business.id}`, JSON.stringify(kept))
          localStorage.setItem(`bf_manage_${business.id}`, result.manage_url)
        } catch { /* storage unavailable */ }
        setExistingAppts(prev => {
          const updated = prev.filter(b => b.manage_url !== newBooking.manage_url)
          updated.push(newBooking)
          updated.sort((a, b) => a.appointment_date.localeCompare(b.appointment_date) || a.start_time.localeCompare(b.start_time))
          return updated
        })
        setExistingApptIdx(0)
      }
      setManageUrl(result.manage_url ?? null)
      setAppointmentId(result.id ?? null)
      setPendingLinkVerification(result.verification_method === 'link' && !verifiedUser)
      setStep(5)
      // If permission already granted (PWA or browser) → silently subscribe + send confirmation
      // If not yet asked → request permission now (works in any browser, not just PWA)
      if (result.id && pushAvailable && typeof Notification !== 'undefined') {
        if (Notification.permission === 'granted') {
          subscribeApptPush(result.id, true)
        } else if (Notification.permission === 'default') {
          // Non-blocking: request in background after booking completes
          setTimeout(() => subscribeApptPush(result.id!, true), 800)
        }
      }

      // Bridge: tell native app shell about the notify_token so it can link
      // the device's FCM token to this customer for future push reminders.
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('wl_notify_token') : null
        if (token) {
          window.parent?.postMessage({ type: 'bf_notify_token', token }, '*')
        }
      } catch { /* storage unavailable */ }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An error occurred"
      setBookingError(msg)
    }

    setSubmitting(false)
  }

  if (managingToken) {
    return (
      <InlineManageView
        token={managingToken}
        isArabic={isArabic}
        onBack={() => setManagingToken(null)}
        onCancelled={() => {
          // Remove the cancelled appointment from state + localStorage
          const cancelledUrl = `/manage-booking/${managingToken}`
          setExistingAppts(prev => {
            const updated = prev.filter(b => b.manage_url !== cancelledUrl)
            try {
              const todayStr = new Date().toISOString().slice(0, 10)
              const kept = updated.filter(b => b.appointment_date >= todayStr)
              localStorage.setItem(`bf_bookings_${business.id}`, JSON.stringify(kept))
            } catch { /* storage unavailable */ }
            return updated
          })
          setExistingApptIdx(0)
          setManagingToken(null)
          // Reset to step 1 and clear slot cache so fresh data is fetched
          setStep(1)
          setSelectedService(null)
          setSelectedStaff(null)
          setSelectedDate(undefined)
          setSelectedSlot(null)
          setSlots([])
        }}
      />
    )
  }

  return (
    <div className="booking-flow-root" dir={isArabic ? "rtl" : "ltr"}>

      {/* Existing appointment notice — shown above the whole card */}
      {existingBookingNotice}

      {/* Mobile install guide — shown when visiting from browser, not PWA */}
      {!installBannerDismissed && installOS && (
        <InstallGuide
          os={installOS}
          isArabic={isArabic}
          step={installStep}
          onStep={setInstallStep}
          onDismiss={dismissInstallBanner}
          appName={business.app_name || business.name}
          iconUrl={business.app_icon_url || business.logo_url}
        />
      )}

      {/* PWA notification permission modal */}
      {!notifyModalDismissed && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-[var(--bf-card)] p-6 shadow-2xl">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--bf-primary-soft)] text-3xl mx-auto">
              🔔
            </div>
            <h3 className="text-center text-lg font-bold tracking-tight text-[var(--bf-text)]">
              {isArabic ? "ابق على اطلاع دائم" : "Stay updated on your appointments"}
            </h3>
            <p className="mt-2 text-center text-sm text-[var(--bf-muted)] leading-relaxed">
              {isArabic
                ? "اسمح بالإشعارات لتلقي:"
                : "Allow notifications to receive:"}
            </p>
            <ul className="mt-3 space-y-1.5 text-sm text-[var(--bf-text)]">
              <li className="flex items-center gap-2">
                <span className="text-emerald-500">✓</span>
                {isArabic ? "تأكيد الحجز فور إتمامه" : "Booking confirmation instantly"}
              </li>
              <li className="flex items-center gap-2">
                <span className="text-emerald-500">✓</span>
                {isArabic ? "تذكير قبل موعدك بساعة" : "Reminder 1 hour before your appointment"}
              </li>
              <li className="flex items-center gap-2">
                <span className="text-emerald-500">✓</span>
                {isArabic ? "تحديثات على موعدك" : "Appointment status updates"}
              </li>
            </ul>
            <button
              type="button"
              onClick={async () => {
                dismissNotifyModal(true)
                const permission = await Notification.requestPermission().catch(() => 'denied')
                if (permission !== 'granted') return
                // If already subscribed to a push manager, subscribe silently for the waitlist token
                const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
                if (!vapidKey || !('serviceWorker' in navigator)) return
                try {
                  const reg = await navigator.serviceWorker.ready
                  await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey) })
                } catch { /* ok */ }
              }}
              className="mt-5 w-full rounded-xl bg-[var(--bf-primary)] py-3 text-sm font-semibold text-[var(--bf-on-primary)] hover:opacity-90"
            >
              {isArabic ? "السماح بالإشعارات" : "Allow Notifications"}
            </button>
            <button
              type="button"
              onClick={() => dismissNotifyModal(true)}
              className="mt-2 w-full rounded-xl py-2.5 text-sm text-[var(--bf-muted)] hover:text-[var(--bf-text)]"
            >
              {isArabic ? "ليس الآن" : "Not now"}
            </button>
          </div>
        </div>
      )}

      <div className="booking-flow-card bg-[var(--bf-card)] rounded-2xl border border-[var(--bf-border)] overflow-hidden">

      {/* Inject tenant DayPicker + slot theme */}
      <style>{`
        .bf-${accent.replace('#','')} .rdp { --rdp-accent-color: ${accent}; --rdp-background-color: ${accent}18; }
        .bf-${accent.replace('#','')} .rdp { margin: 0; width: 100%; max-width: 100%; }
        .bf-${accent.replace('#','')} .rdp-months, .bf-${accent.replace('#','')} .rdp-month { width: 100%; max-width: 100%; }
        .bf-${accent.replace('#','')} .rdp-table { width: 100%; max-width: 100%; table-layout: fixed; }
        .bf-${accent.replace('#','')} .rdp-caption { padding: 0 0.25rem; }
        .bf-${accent.replace('#','')} .rdp-head_cell { font-size: 0.68rem; }
        .bf-${accent.replace('#','')} .rdp-cell { padding: 0.05rem; }
        .bf-${accent.replace('#','')} .rdp-day { width: 1.85rem; height: 1.85rem; max-width: 100%; font-size: 0.75rem; margin: 0 auto; }
        @media (min-width: 640px) {
          .bf-${accent.replace('#','')} .rdp-day { width: 2.25rem; height: 2.25rem; }
        }
        .bf-${accent.replace('#','')} .rdp-day_selected:not(.rdp-day_disabled) { background-color: ${accent} !important; }
        .bf-${accent.replace('#','')} .rdp-day_today { color: ${accent} !important; }
        .bf-${accent.replace('#','')} .bf-slot-selected { background-color: ${accent} !important; border-color: ${accent} !important; color: var(--tenant-calendar-text, #fff) !important; }
        .bf-${accent.replace('#','')} .bf-progress-done { background-color: ${accent} !important; }
        .bf-${accent.replace('#','')} .bf-progress-line-done { background-color: ${accent}40 !important; }
        .bf-${accent.replace('#','')} .bf-cta-btn { background-color: ${accent} !important; border-radius: ${radius} !important; }
      `}</style>

      {/* Progress header */}
      {step < 5 && (
        <div className="px-4 sm:px-6 pt-5 sm:pt-6 pb-4 sm:pb-5 border-b border-[var(--bf-border)]">
          <div className={`flex items-center gap-0 bf-${accent.replace('#','')}`}>
            {STEPS.slice(0, 4).map((s, i) => (
              <div key={s.id} className="flex items-center flex-1 last:flex-none">
                <div
                  className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                    step === s.id
                      ? "text-[var(--bf-text)]"
                      : step > s.id
                      ? "text-[var(--bf-muted)]"
                      : "text-[var(--bf-muted)]"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all bf-progress-done ${
                      step > s.id
                        ? "text-[var(--bf-on-primary)]"
                        : step === s.id
                        ? "bg-[var(--bf-text)] text-[var(--bf-card)]"
                        : "border border-[var(--bf-border)] text-[var(--bf-muted)]"
                    }`}
                    style={step > s.id ? { backgroundColor: accent } : undefined}
                  >
                    {step > s.id ? <CheckCircle2 className="w-3 h-3" /> : s.id}
                  </div>
                  <span className="hidden sm:inline text-[12px]">{[t.service, t.staff, t.dateTime, t.details][i]}</span>
                </div>
                {i < 3 && (
                  <div
                    className={`mx-1 sm:mx-2 h-px flex-1 transition-colors bf-progress-line-done`}
                    style={{ backgroundColor: step > s.id ? `${accent}40` : 'var(--bf-border)' }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step content */}
      <div className="p-4 sm:p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.18 }}
          >
            {/* Step 1: Service */}
            {step === 1 && (
              <div>
                <h2 className="text-[17px] font-bold tracking-tight mb-1">{choosingCategory ? t.chooseCategory : t.chooseService}</h2>
                <p className="text-sm text-[var(--bf-muted)] mb-5">{choosingCategory ? t.chooseCategorySub : t.chooseServiceSub}</p>
                {services.length === 0 ? (
                  <p className="text-[var(--bf-muted)] text-sm italic">{t.noServices}</p>
                ) : (
                  <>
                    {choosingCategory && (
                      <div className="space-y-2" aria-label={t.chooseCategory}>
                        {serviceGroups.map(group => (
                          <button key={group.id} type="button" disabled={!group.services.length}
                            onClick={() => setCategoryFilter(group.id)}
                            className="w-full flex items-center justify-between gap-3 rounded-xl border border-[var(--bf-border)] px-4 py-4 text-start hover:border-[var(--bf-primary)] hover:bg-[var(--bf-subtle)]/50 disabled:opacity-50 disabled:cursor-not-allowed">
                            <span><span className="block font-semibold text-[14px] text-[var(--bf-text)]">{group.name}</span>
                              <span className="block text-xs text-[var(--bf-muted)] mt-1">{isArabic ? `${group.services.length} خدمات` : `${group.services.length} service${group.services.length === 1 ? '' : 's'}`}</span>
                            </span>
                            <ChevronRight className={`h-4 w-4 shrink-0 text-[var(--bf-muted)] ${isArabic ? 'rotate-180' : ''}`} />
                          </button>
                        ))}
                      </div>
                    )}
                    {selectedCategory && (
                      <div className="mb-4">
                        <button type="button" onClick={() => { setCategoryFilter(null); setSelectedService(null); setSelectedStaff(null); setSelectedDate(undefined); setSelectedSlot(null) }}
                          className="inline-flex items-center gap-1 text-sm font-medium text-[var(--bf-muted)] hover:text-[var(--bf-text)]">
                          <ChevronLeft className={`h-4 w-4 ${isArabic ? 'rotate-180' : ''}`} />{t.changeCategory}
                        </button>
                        <h3 className="mt-3 text-sm font-semibold text-[var(--bf-text)]">{selectedCategory.name}</h3>
                      </div>
                    )}
                    <div className="space-y-5">
                      {visibleServiceGroups.map(group => (
                        <div key={group.id}>
                          <div className="space-y-2">
                            {group.services.map((service) => (
                              <button
                                key={service.id}
                                onClick={() => {
                                  setSelectedService(service)
                                  const options = staffForService(service)
                                  if (options.length > 1) {
                                    setStep(2)
                                  } else {
                                    setSelectedStaff(options[0] ?? null)
                                    setStep(3)
                                  }
                                }}
                                className={`w-full ${isArabic ? "text-right" : "text-left"} rounded-xl border px-4 py-3.5 transition-all ${
                                  selectedService?.id === service.id
                                    ? "border-[var(--bf-primary-soft)] bg-[var(--bf-primary-soft)]/50"
                                    : "border-[var(--bf-border)] hover:border-[var(--bf-primary)] hover:bg-[var(--bf-subtle)]/50"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <p className="font-semibold text-[14px] text-[var(--bf-text)] tracking-tight">{service.name}</p>
                                    {service.description && (
                                      <p className="text-xs text-[var(--bf-muted)] line-clamp-1 mt-0.5">
                                        {service.description}
                                      </p>
                                    )}
                                  </div>
                                  <div className="text-right shrink-0">
                                    <p className="font-bold text-[14px] text-[var(--bf-text)]">{formatCurrency(service.price, business.currency ?? "USD")}</p>
                                    <p className="text-[11px] text-[var(--bf-muted)] flex items-center gap-1 justify-end mt-0.5">
                                      <Clock className="w-3 h-3" />
                                      {durationLabel(service.duration_minutes)}
                                    </p>
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Step 2: Staff */}
            {step === 2 && needsStaffChoice && (
              <div>
                <h2 className="text-[17px] font-bold tracking-tight mb-1">{t.chooseStaff}</h2>
                <p className="text-sm text-[var(--bf-muted)] mb-5">{t.chooseStaffSub}</p>
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      setSelectedStaff(null)
                      setStep(3)
                    }}
                    className={`w-full ${isArabic ? "text-right" : "text-left"} rounded-xl border border-dashed border-[var(--bf-border)] px-4 py-3.5 hover:border-[var(--bf-primary)] hover:bg-[var(--bf-subtle)]/50 transition-all`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[var(--bf-subtle)] flex items-center justify-center shrink-0">
                        <Users className="w-4 h-4 text-[var(--bf-muted)]" />
                      </div>
                      <div>
                        <p className="font-semibold text-[14px] text-[var(--bf-text)] tracking-tight">{t.anyAvailable}</p>
                        <p className="text-xs text-[var(--bf-muted)]">{t.allOpenSlots}</p>
                      </div>
                    </div>
                  </button>

                  {eligibleStaff.map((member) => (
                    <button
                      key={member.id}
                      onClick={() => {
                        setSelectedStaff(member)
                        setStep(3)
                      }}
                      className={`w-full ${isArabic ? "text-right" : "text-left"} rounded-xl border px-4 py-3.5 transition-all ${
                        selectedStaff?.id === member.id
                          ? "border-[var(--bf-primary-soft)] bg-[var(--bf-primary-soft)]/50"
                          : "border-[var(--bf-border)] hover:border-[var(--bf-primary)] hover:bg-[var(--bf-subtle)]/50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8 shrink-0">
                          <AvatarImage src={member.avatar_url ?? undefined} />
                          <AvatarFallback className="text-[11px] bg-[var(--bf-subtle)] text-[var(--bf-muted)]">{getInitials(member.name)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold text-[14px] text-[var(--bf-text)] tracking-tight">{member.name}</p>
                          {member.role && (
                            <p className="text-xs text-[var(--bf-muted)]">{member.role}</p>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3: Date & time */}
            {step === 3 && (
              <div>
                <h2 className="text-[17px] font-bold tracking-tight mb-1">{t.pickDateTime}</h2>
                <p className="text-sm text-[var(--bf-muted)] mb-5">
                  {selectedService?.duration_minutes
                    ? `${t.sessionIs} ${durationLabel(selectedService.duration_minutes)}`
                    : t.chooseWhen}
                </p>

                <div className={`${forceMobileLayout ? "flex flex-col" : "flex flex-col lg:flex-row"} gap-4 sm:gap-6`}>
                  <div className={`flex-1 bf-${accent.replace('#','')}`}>
                    {calendarView === "weekly" ? (
                      <div className="border border-[var(--bf-border)] rounded-xl p-3">
                        <p className="text-[13px] font-semibold text-[var(--bf-text)] mb-3 text-center">
                          {formatDate(today, "MMMM")}
                        </p>
                        <div className="grid grid-cols-7 gap-1">
                          {weekDates.map((date) => {
                            const disabled = isDisabledDay(date)
                            const selected = selectedDate && formatDate(selectedDate, "yyyy-MM-dd") === formatDate(date, "yyyy-MM-dd")

                            return (
                              <button
                                key={date.toISOString()}
                                type="button"
                                disabled={disabled}
                                onClick={() => handleDateSelect(date)}
                                className={`min-w-0 rounded-full border px-0.5 py-2 text-center transition-all ${
                                  disabled
                                    ? "border-[var(--bf-border)] bg-[var(--bf-subtle)] text-[var(--bf-muted)] cursor-not-allowed"
                                    : selected
                                    ? "bf-slot-selected text-[var(--bf-on-primary)]"
                                    : "border-[var(--bf-border)] text-[var(--bf-text)] hover:border-[var(--bf-primary)]"
                                }`}
                                style={selected ? { backgroundColor: accent, borderColor: accent } : undefined}
                              >
                                <span className="block text-[10px] font-medium uppercase leading-none">
                                  {formatDate(date, "EEE")}
                                </span>
                                <span className="block text-sm font-bold mt-1 leading-none">
                                  {formatDate(date, "d")}
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ) : (
                      <DayPicker
                        mode="single"
                        selected={selectedDate}
                        onSelect={handleDateSelect}
                        disabled={isDisabledDay}
                        fromDate={today}
                        toDate={maxBookingDate ?? addDays(today, 90)}
                        locale={dateLocale}
                        dir={isArabic ? "rtl" : "ltr"}
                        className="border border-[var(--bf-border)] rounded-xl p-2 sm:p-3 w-full"
                      />
                    )}
                  </div>

                  <div className="flex-1">
                    {!selectedDate ? (
                      <div className="flex items-center justify-center h-40 text-[var(--bf-muted)] text-sm">
                        <Calendar className="w-4 h-4 mr-2" />
                        {t.selectDateFirst}
                      </div>
                    ) : loadingSlots ? (
                      <div className="flex items-center justify-center h-40">
                        <Loader2 className="w-5 h-5 animate-spin text-[var(--bf-muted)]" />
                      </div>
                    ) : (slots.length === 0 || slots.every(s => !s.available)) ? (
                      <div className="rounded-xl border border-dashed border-[var(--bf-border)] p-4">
                        {/* ── Fully booked header ── */}
                        <div className="text-center">
                          <Clock className="w-4 h-4 mb-2 text-[var(--bf-muted)] mx-auto" />
                          <p className="text-sm font-semibold text-[var(--bf-text)]">
                            {slots.length > 0 ? (isArabic ? "المواعيد محجوزة بالكامل" : "Fully booked on this date") : t.noSlots}
                          </p>
                          <p className="mt-1 text-xs text-[var(--bf-muted)]">
                            {isArabic ? "انضم لقائمة الانتظار وسنُعلمك فور توفر موعد" : "Join the waitlist — we'll alert you the moment a spot opens"}
                          </p>
                        </div>

                        {/* ── Success state ── */}
                        {waitlistJoined ? (
                          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-center">
                            <p className="text-sm font-semibold text-emerald-700">
                              {isArabic ? "✓ أنت في قائمة الانتظار!" : "✓ You're on the waitlist!"}
                            </p>
                            <p className="mt-1 text-xs text-emerald-600">
                              {pushSubscribed
                                ? (isArabic ? "سيصلك إشعار فوري عند توفر موعد 🔔" : "You'll get a push notification the instant a spot opens 🔔")
                                : (isArabic ? "سنتواصل معك فور توفر موعد" : "We'll let you know as soon as a spot opens")}
                            </p>
                          </div>

                        /* ── Form (waitlistOpen) ── */
                        ) : waitlistOpen ? (
                          <div className="mt-4 space-y-2.5 text-left">

                            {/* Push info banner */}
                            {typeof Notification !== 'undefined' && Notification.permission !== 'denied' && (
                              <div className="flex items-start gap-2 rounded-lg border border-[var(--bf-primary-soft)] bg-[var(--bf-primary-soft)] px-3 py-2.5">
                                <span className="shrink-0 text-base leading-none">🔔</span>
                                <p className="text-xs text-[var(--bf-primary)] leading-snug">
                                  {isArabic
                                    ? "سيُطلب منك السماح بالإشعارات — ستصلك تنبيهات فورية عند توفر موعد."
                                    : "You'll be asked to allow notifications so we can alert you instantly when a spot opens."}
                                </p>
                              </div>
                            )}

                            {/* Error */}
                            {waitlistError && (
                              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                                {waitlistError}
                              </div>
                            )}

                            {/* Era selection */}
                            <div>
                              <p className="text-[11px] text-[var(--bf-muted)] mb-1.5">
                                {isArabic ? "متى تفضل؟ (اختياري)" : "Preferred time of day (optional)"}
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {([
                                  { id: "morning", en: "Morning", ar: "الصباح", hours: "6–12" },
                                  { id: "noon",    en: "Noon",    ar: "الظهر",  hours: "12–5" },
                                  { id: "evening", en: "Evening", ar: "المساء", hours: "5–10" },
                                ] as const).map(era => {
                                  const active = waitlistEras.includes(era.id)
                                  return (
                                    <button
                                      key={era.id}
                                      type="button"
                                      onClick={() => setWaitlistEras(prev =>
                                        prev.includes(era.id) ? prev.filter(e => e !== era.id) : [...prev, era.id]
                                      )}
                                      className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                                        active ? "bg-[var(--bf-text)] text-[var(--bf-card)] border-[var(--bf-text)]" : "border-[var(--bf-border)] text-[var(--bf-text)] hover:bg-[var(--bf-subtle)]"
                                      }`}
                                    >
                                      {isArabic ? era.ar : era.en}
                                      <span className={`opacity-70 ${active ? "text-[var(--bf-card)]" : "text-[var(--bf-muted)]"}`}>{era.hours}</span>
                                    </button>
                                  )
                                })}
                              </div>
                            </div>

                            {/* Fields */}
                            <Input
                              value={waitlistName}
                              onChange={e => setWaitlistName(e.target.value)}
                              placeholder={t.fullName.replace(" *", "")}
                              className="h-9 rounded-lg text-xs"
                            />
                            <Input
                              value={waitlistEmail}
                              onChange={e => setWaitlistEmail(e.target.value)}
                              type="email"
                              placeholder={isArabic ? "البريد الإلكتروني" : "Email"}
                              className="h-9 rounded-lg text-xs"
                            />
                            <Input
                              value={waitlistPhone}
                              onChange={e => setWaitlistPhone(e.target.value)}
                              type="tel"
                              placeholder={t.phone}
                              className="h-9 rounded-lg text-xs"
                            />
                            {isGroupBooking && (
                              <Input
                                value={waitlistParticipants}
                                onChange={e => setWaitlistParticipants(Math.max(1, Number(e.target.value) || 1))}
                                type="number" min={1} max={business.group_capacity ?? 1}
                                className="h-9 rounded-lg text-xs"
                              />
                            )}

                            {/* Primary CTA */}
                            <button
                              type="button"
                              disabled={waitlistSubmitting}
                              onClick={() => joinWaitlist(true)}
                              className="bf-cta-btn flex h-10 w-full items-center justify-center gap-2 rounded-lg text-xs font-semibold text-[var(--bf-on-primary)] disabled:opacity-50"
                              style={{ backgroundColor: accent, borderRadius: radius }}
                            >
                              {waitlistSubmitting
                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                : (isArabic ? "🔔 السماح بالإشعارات والانضمام" : "🔔 Allow notifications & join")}
                            </button>
                            {/* Shown after permission denied */}
                            {typeof Notification !== 'undefined' && Notification.permission === 'denied' && (
                              <button
                                type="button"
                                disabled={waitlistSubmitting}
                                onClick={() => joinWaitlist(false)}
                                className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--bf-border)] text-[11px] font-medium text-[var(--bf-text)] hover:bg-[var(--bf-subtle)] disabled:opacity-50"
                              >
                                {isArabic ? "انضم بدون إشعارات" : "Join without notifications"}
                              </button>
                            )}
                          </div>

                        /* ── Collapsed — show "Join waitlist" button ── */
                        ) : (
                          <div className="mt-4 text-center">
                            <button
                              type="button"
                              onClick={() => setWaitlistOpen(true)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--bf-border)] bg-[var(--bf-card)] px-4 py-2 text-xs font-semibold text-[var(--bf-text)] shadow-sm hover:bg-[var(--bf-subtle)]"
                            >
                              🔔 {t.joinWaitlist}
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <p className="text-[13px] font-semibold text-[var(--bf-text)] mb-3 tracking-tight">
                          {formatDate(selectedDate, "EEEE, MMMM d")}
                        </p>
                        <div className={`${forceMobileLayout ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"} grid gap-2 max-h-72 overflow-y-auto pr-1`}>
                          {slots.map((slot) => (
                            <button
                              key={slot.time}
                              disabled={!slot.available}
                              onClick={() => {
                                setSelectedSlot(slot)
                                if (!verifiedUser && verificationMethod === 'otp') {
                                  setOtpPhone('')
                                  setOtpCode('')
                                  setOtpError(null)
                                  setOtpPhase('phone')
                                } else if (verificationMethod === 'none') {
                                  setOtpPhase(null)
                                }
                                setStep(4)
                              }}
                              className={`py-2 px-3 rounded-lg text-xs font-medium border transition-all bf-slot ${
                                !slot.available
                                  ? "opacity-30 cursor-not-allowed border-[var(--bf-border)] text-[var(--bf-muted)]"
                                  : selectedSlot?.time === slot.time
                                  ? "bf-slot-selected border-[var(--bf-border)] text-[var(--bf-on-primary)]"
                                  : "border-[var(--bf-border)] text-[var(--bf-text)] hover:opacity-80"
                              }`}
                              style={selectedSlot?.time === slot.time ? { backgroundColor: accent, borderColor: accent } : undefined}
                            >
                              <span className="block">{slot.label}</span>
                              {isGroupBooking && (
                                <span className="block text-[10px] opacity-70 mt-0.5">
                                  {slot.available_spots ?? 0} {t.left}
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Step 4 — OTP verification (shown before details when not logged in) */}
            {step === 4 && otpPhase === 'phone' && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-[17px] font-bold tracking-tight mb-1">{isArabic ? 'تحقق من رقمك' : 'Verify your number'}</h2>
                  <p className="text-sm text-[var(--bf-muted)]">{isArabic ? 'سنرسل لك رمزاً عبر واتساب.' : "We'll send a 4-digit code to your WhatsApp."}</p>
                </div>
                {otpError && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{otpError}</p>}
                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-[var(--bf-text)]">{isArabic ? 'رقم الواتساب' : 'WhatsApp number'}</label>
                  <input
                    type="tel"
                    value={otpPhone}
                    onChange={e => setOtpPhone(e.target.value)}
                    placeholder="+972 50 000 0000"
                    className="w-full h-10 px-3 rounded-lg border border-[var(--bf-border)] text-sm outline-none focus:border-[var(--bf-primary)]"
                    dir="ltr"
                  />
                </div>
                <button
                  onClick={sendBookingOtp}
                  disabled={otpLoading || otpPhone.length < 7}
                  className="w-full py-3 rounded-xl text-sm font-semibold text-[var(--bf-on-primary)] disabled:opacity-50 transition-opacity"
                  style={{ backgroundColor: accent }}
                >
                  {otpLoading ? (isArabic ? 'جاري الإرسال…' : 'Sending…') : (isArabic ? 'إرسال الرمز' : 'Send Code')}
                </button>
                <button onClick={() => { setOtpPhase(null); setStep(3) }} className="w-full text-xs text-[var(--bf-muted)] hover:text-[var(--bf-text)]">
                  ← {isArabic ? 'رجوع' : 'Back'}
                </button>
              </div>
            )}

            {step === 4 && otpPhase === 'verify' && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-[17px] font-bold tracking-tight mb-1">{isArabic ? 'أدخل الرمز' : 'Enter the code'}</h2>
                  <p className="text-sm text-[var(--bf-muted)]">
                    {isArabic ? `أرسلنا رمزاً من 4 أرقام إلى ${otpPhone}` : `We sent a 4-digit code to ${otpPhone}`}
                  </p>
                </div>
                {otpError && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{otpError}</p>}
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={otpCode}
                  onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="0000"
                  className="w-full h-14 text-center text-3xl tracking-[0.5em] font-mono rounded-xl border border-[var(--bf-border)] outline-none focus:border-[var(--bf-primary)]"
                  dir="ltr"
                />
                <button
                  onClick={verifyBookingOtp}
                  disabled={otpLoading || otpCode.length !== 4}
                  className="w-full py-3 rounded-xl text-sm font-semibold text-[var(--bf-on-primary)] disabled:opacity-50 transition-opacity"
                  style={{ backgroundColor: accent }}
                >
                  {otpLoading ? (isArabic ? 'جاري التحقق…' : 'Verifying…') : (isArabic ? 'تحقق' : 'Verify')}
                </button>
                <div className="flex items-center justify-between text-xs text-[var(--bf-muted)]">
                  <button onClick={() => { setOtpPhase('phone'); setOtpError(null) }} className="text-[var(--bf-muted)] hover:text-[var(--bf-text)]">
                    ← {isArabic ? 'تغيير الرقم' : 'Change number'}
                  </button>
                  {otpCountdown > 0 ? (
                    <span>{isArabic ? `إعادة الإرسال بعد ${otpCountdown}ث` : `Resend in ${otpCountdown}s`}</span>
                  ) : (
                    <button onClick={sendBookingOtp} disabled={otpLoading} className="font-medium hover:opacity-80" style={{ color: accent }}>
                      {isArabic ? 'إعادة الإرسال' : 'Resend code'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Step 4: Customer details */}
            {step === 4 && otpPhase === null && (
              <div>
                <h2 className="text-[17px] font-bold tracking-tight mb-1">{t.details}</h2>
                <p className="text-sm text-[var(--bf-muted)] mb-5">
                  {isArabic ? "\u0628\u0642\u064a\u062a \u062e\u0637\u0648\u0629 \u0648\u0627\u062d\u062f\u0629 \u0644\u062a\u0623\u0643\u064a\u062f \u0627\u0644\u062d\u062c\u0632." : "Almost there - just a few details to confirm your booking."}
                </p>

                {/* Summary */}
                <div className="bg-[var(--bf-subtle)] rounded-xl p-4 mb-6 space-y-2.5">
                  <div className="flex justify-between text-[13px]">
                    <span className="text-[var(--bf-muted)]">{t.service}</span>
                    <span className="font-medium text-[var(--bf-text)]">{selectedService?.name}</span>
                  </div>
                  {selectedStaff && (
                    <div className="flex justify-between text-[13px]">
                      <span className="text-[var(--bf-muted)]">{t.with}</span>
                      <span className="font-medium text-[var(--bf-text)]">{selectedStaff.name}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-[13px]">
                    <span className="text-[var(--bf-muted)]">{t.date}</span>
                    <span className="font-medium text-[var(--bf-text)]">
                      {selectedDate && formatDate(selectedDate, "EEEE, MMMM d")}
                    </span>
                  </div>
                  <div className="flex justify-between text-[13px]">
                    <span className="text-[var(--bf-muted)]">{t.time}</span>
                    <span className="font-medium text-[var(--bf-text)]">{selectedSlot?.label}</span>
                  </div>
                  {isGroupBooking && (
                    <div className="flex justify-between text-[13px]">
                      <span className="text-[var(--bf-muted)]">{t.availability}</span>
                      <span className="font-medium text-[var(--bf-text)]">
                        {selectedSlot?.available_spots ?? 0} {t.left}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-[13px] font-semibold pt-2 border-t border-[var(--bf-border)]">
                    <span className="text-[var(--bf-text)]">{t.total}</span>
                    <span className="text-[var(--bf-text)]">{selectedService && formatCurrency(selectedService.price, business.currency ?? "USD")}</span>
                  </div>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-[13px] font-medium text-[var(--bf-text)]">{t.fullName}</Label>
                    <Input
                      placeholder={t.yourName}
                      className="h-10 rounded-lg border-[var(--bf-border)] placeholder:text-[var(--bf-muted)] focus-visible:ring-1 focus-visible:ring-[var(--bf-primary)] focus-visible:border-[var(--bf-text)]"
                      {...register("name")}
                    />
                    {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[13px] font-medium text-[var(--bf-text)]">{t.phone}</Label>
                    <Input
                      type="tel"
                      placeholder="+1 (555) 000-0000"
                      className="h-10 rounded-lg border-[var(--bf-border)] placeholder:text-[var(--bf-muted)] focus-visible:ring-1 focus-visible:ring-[var(--bf-primary)] focus-visible:border-[var(--bf-text)]"
                      {...register("phone")}
                    />
                    {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
                  </div>

                  {isGroupBooking && (
                    <div className="space-y-1.5">
                      <Label className="text-[13px] font-medium text-[var(--bf-text)]">{t.participants}</Label>
                      <Input
                        type="number"
                        min={1}
                        max={maxParticipants}
                        defaultValue={1}
                        className="h-10 rounded-lg border-[var(--bf-border)] placeholder:text-[var(--bf-muted)] focus-visible:ring-1 focus-visible:ring-[var(--bf-primary)] focus-visible:border-[var(--bf-text)]"
                        {...register("participants_count", {
                          valueAsNumber: true,
                          min: 1,
                          max: maxParticipants,
                        })}
                      />
                      <p className="text-xs text-[var(--bf-muted)]">
                        {isArabic ? `حتى ${maxParticipants} ${t.participantsHelp}` : `Up to ${maxParticipants} ${t.participantsHelp}`}
                      </p>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label className="text-[13px] font-medium text-[var(--bf-text)]">{t.notes}</Label>
                    <Input
                      placeholder={t.notesPlaceholder}
                      className="h-10 rounded-lg border-[var(--bf-border)] placeholder:text-[var(--bf-muted)] focus-visible:ring-1 focus-visible:ring-[var(--bf-primary)] focus-visible:border-[var(--bf-text)]"
                      {...register("notes")}
                    />
                  </div>

                  {bookingError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {bookingError}
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <Button type="button" variant="outline" onClick={() => setStep(3)} className="flex-1 border-[var(--bf-border)] text-[var(--bf-text)] hover:text-[var(--bf-text)]">
                      <ChevronLeft className="w-4 h-4" />
                      {t.back}
                    </Button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="bf-cta-btn flex-1 flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold text-[var(--bf-on-primary)] rounded-xl transition-opacity hover:opacity-90 disabled:opacity-50"
                      style={{ backgroundColor: accent, borderRadius: radius }}
                    >
                      {submitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          {t.confirmBooking}
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Step 5: Confirmed */}
            {step === 5 && (
              <div className="text-center py-10">
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 220, damping: 16 }}
                  className={`w-16 h-16 rounded-full ${pendingLinkVerification ? "bg-amber-50" : "bg-emerald-50"} flex items-center justify-center mx-auto mb-5`}
                >
                  {pendingLinkVerification
                    ? <Clock className="w-8 h-8 text-amber-500" />
                    : <CheckCircle2 className="w-8 h-8 text-emerald-600" />}
                </motion.div>

                <h2 className="text-xl font-bold tracking-tight mb-1.5">
                  {previewMode ? (isArabic ? "اكتملت المعاينة — لم يتم إنشاء حجز" : "Preview complete — no booking was created") : pendingLinkVerification
                    ? (isArabic ? "تحقق من الواتساب" : "Check your WhatsApp")
                    : t.bookingConfirmed}
                </h2>
                <p className="text-sm text-[var(--bf-muted)] mb-7 max-w-xs mx-auto leading-relaxed">
                  {previewMode ? (isArabic ? "هذه معاينة فقط، لم يتم إرسال أي رسالة." : "This was a preview. No appointment or message was sent.") : pendingLinkVerification
                    ? (isArabic
                        ? "أرسلنا لك رابط تأكيد عبر واتساب. افتح الرابط لتأكيد حجزك."
                        : "We sent a confirmation link to your WhatsApp. Open the link to confirm your booking.")
                    : isArabic ? t.confirmationCopy : (
                    <>
                      Your appointment at <span className="font-medium text-[var(--bf-text)]">{business.name}</span> is all set.
                    </>
                  )}
                </p>

                <div className={`bg-[var(--bf-subtle)] rounded-xl p-5 space-y-2.5 max-w-xs mx-auto mb-7 ${isArabic ? "text-right" : "text-left"}`}>
                  <div className="flex justify-between text-[13px]">
                    <span className="text-[var(--bf-muted)]">{t.service}</span>
                    <span className="font-medium text-[var(--bf-text)]">{selectedService?.name}</span>
                  </div>
                  {selectedStaff && (
                    <div className="flex justify-between text-[13px]">
                      <span className="text-[var(--bf-muted)]">{t.with}</span>
                      <span className="font-medium text-[var(--bf-text)]">{selectedStaff.name}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-[13px]">
                    <span className="text-[var(--bf-muted)]">{t.date}</span>
                    <span className="font-medium text-[var(--bf-text)]">
                      {selectedDate && formatDate(selectedDate, "EEEE, MMMM d, yyyy")}
                    </span>
                  </div>
                  <div className="flex justify-between text-[13px]">
                    <span className="text-[var(--bf-muted)]">{t.time}</span>
                    <span className="font-medium text-[var(--bf-text)]">{selectedSlot?.label}</span>
                  </div>
                </div>

                {manageUrl && !pendingLinkVerification && (
                  <button
                    type="button"
                    onClick={() => {
                      const token = manageUrl.split("/manage-booking/")[1]
                      if (token) setManagingToken(token)
                    }}
                    className="mb-3 inline-flex w-full max-w-xs items-center justify-center rounded-xl border border-[var(--bf-border)] px-4 py-2.5 text-sm font-semibold text-[var(--bf-text)] hover:bg-[var(--bf-subtle)]"
                  >
                    {t.manageBooking}
                  </button>
                )}

                {/* Push subscription offer — only shown when permission is 'default' (not auto-granted) */}
                {appointmentId && pushAvailable && !apptPushSubscribed &&
                  typeof Notification !== 'undefined' && Notification.permission === 'default' && (
                  <div className="mb-4 rounded-xl border border-[var(--bf-primary-soft)] bg-[var(--bf-primary-soft)] p-4 max-w-xs mx-auto text-left">
                    <p className="text-sm font-semibold text-[var(--bf-primary)]">{t.reminderPushTitle}</p>
                    <p className="mt-0.5 text-xs text-[var(--bf-primary)]">{t.reminderPushHelp}</p>
                    <button
                      type="button"
                      disabled={apptPushSubscribing}
                      onClick={() => subscribeApptPush(appointmentId, true)}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--bf-primary)] px-4 py-2 text-xs font-semibold text-[var(--bf-on-primary)] hover:opacity-90 disabled:opacity-60"
                    >
                      {apptPushSubscribing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t.enableReminders}
                    </button>
                  </div>
                )}

                {apptPushSubscribed && (
                  <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 max-w-xs mx-auto">
                    <p className="text-sm font-semibold text-emerald-700">{t.remindersEnabled}</p>
                    <p className="mt-0.5 text-xs text-emerald-600">{t.remindersEnabledHelp}</p>
                  </div>
                )}

                <div className="flex flex-col items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-[var(--bf-border)] text-[var(--bf-text)] hover:text-[var(--bf-text)] text-xs"
                    onClick={() => {
                      setStep(1)
                      setCategoryFilter(null)
                      setSelectedService(null)
                      setSelectedStaff(null)
                      setSelectedDate(undefined)
                      setSelectedSlot(null)
                      setManageUrl(null)
                      setAppointmentId(null)
                      setApptPushSubscribed(false)
                    }}
                  >
                    {t.bookAnother}
                  </Button>
                  <a
                    href={`/book/${business.slug}`}
                    className="text-xs text-[var(--bf-muted)] hover:text-[var(--bf-text)] underline underline-offset-2"
                  >
                    {t.returnHome}
                  </a>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Back nav for steps 2-3 */}
      {step >= 2 && step <= 3 && (
        <div className="px-6 pb-5">
          <button
            onClick={() => setStep(step - 1)}
            className="flex items-center gap-1 text-xs text-[var(--bf-muted)] hover:text-[var(--bf-text)] transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            {t.back}
          </button>
        </div>
      )}
      </div>
    </div>
  )
}

// ── Inline manage-booking view (keeps user inside PWA) ────────────────────────

type ApptDetail = {
  id: string
  appointment_date: string
  start_time: string
  end_time: string
  status: string
  participants_count: number
  customer_name: string
  customer_confirmed_at: string | null
  businesses: { name: string; slug: string; language: string | null; customer_confirmation_enabled: boolean } | null
  services: { name: string; price: number; duration_minutes: number } | null
  staff_members: { name: string } | null
}

function InlineManageView({
  token,
  isArabic,
  onBack,
  onCancelled,
}: {
  token: string
  isArabic: boolean
  onBack: () => void
  onCancelled: () => void
}) {
  const [appt, setAppt] = useState<ApptDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [cancelled, setCancelled] = useState(false)
  const [attendanceConfirmed, setAttendanceConfirmed] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const back = isArabic ? "رجوع" : "Back"
  const cancelLabel = isArabic ? "إلغاء الحجز" : "Cancel booking"
  const confirmAttLabel = isArabic ? "تأكيد حضوري" : "Confirm my attendance"
  const cancelConfirmMsg = isArabic ? "هل تريد إلغاء هذا الحجز؟" : "Cancel this booking?"
  const cancelledMsg = isArabic ? "تم إلغاء حجزك." : "Your booking was cancelled."
  const confirmedMsg = isArabic ? "تم تأكيد حضورك!" : "Your attendance is confirmed!"
  const withLabel = isArabic ? "مع" : "With"
  const manageTitle = isArabic ? "إدارة الحجز" : "Manage booking"

  useEffect(() => {
    fetch(`/api/appointment/by-token/${token}`)
      .then(r => r.json())
      .then(d => { setAppt(d); setLoading(false) })
      .catch(() => { setError("Could not load appointment."); setLoading(false) })
  }, [token])

  const cancelBooking = async () => {
    if (!confirm(cancelConfirmMsg)) return
    setCancelling(true)
    const res = await fetch("/api/book/manage/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
    if (res.ok) {
      setCancelled(true)
      setTimeout(onCancelled, 1500)
    } else {
      const r = await res.json().catch(() => ({}))
      setError(r.error ?? "Could not cancel.")
    }
    setCancelling(false)
  }

  const confirmAttendance = async () => {
    setConfirming(true)
    const res = await fetch(`/api/appointment/confirm/${token}`, { method: "POST" })
    if (res.ok) {
      setAttendanceConfirmed(true)
    } else {
      const r = await res.json().catch(() => ({}))
      setError(r.error ?? "Could not confirm.")
    }
    setConfirming(false)
  }

  return (
    <div dir={isArabic ? "rtl" : "ltr"} className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm font-medium text-[var(--bf-muted)] hover:text-[var(--bf-text)]"
      >
        <ChevronLeft className={`h-4 w-4 ${isArabic ? "rotate-180" : ""}`} />
        {back}
      </button>

      <div className="rounded-2xl border border-[var(--bf-border)] bg-[var(--bf-card)] p-5 shadow-sm space-y-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--bf-primary)]">{manageTitle}</p>

        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--bf-muted)]" />
          </div>
        )}

        {error && !loading && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {appt && !loading && (
          <>
            <div className="space-y-2 rounded-xl bg-[var(--bf-subtle)] p-4 text-sm">
              {appt.services?.name && (
                <Row label={appt.services.name} value={`${appt.services.duration_minutes} min`} />
              )}
              <Row
                label={format(parseISO(appt.appointment_date), "EEE, MMM d, yyyy")}
                value={`${appt.start_time.slice(0, 5)} – ${appt.end_time.slice(0, 5)}`}
              />
              {appt.staff_members?.name && (
                <Row label={withLabel} value={appt.staff_members.name} />
              )}
              <Row label={isArabic ? "الحالة" : "Status"} value={appt.status} />
            </div>

            {cancelled ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                {cancelledMsg}
              </div>
            ) : appt.status !== "cancelled" && appt.status !== "completed" ? (
              <div className="space-y-2">
                {appt.businesses?.customer_confirmation_enabled && !appt.customer_confirmed_at && !attendanceConfirmed && (
                  <button
                    type="button"
                    disabled={confirming}
                    onClick={confirmAttendance}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : confirmAttLabel}
                  </button>
                )}
                {attendanceConfirmed && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                    {confirmedMsg}
                  </div>
                )}
                <button
                  type="button"
                  disabled={cancelling}
                  onClick={cancelBooking}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-[var(--bf-card)] px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : cancelLabel}
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[var(--bf-muted)]">{label}</span>
      <span className="font-medium text-[var(--bf-text)] text-end">{value}</span>
    </div>
  )
}

// ── PWA Install Guide ─────────────────────────────────────────────────────────

function InstallGuide({
  os, isArabic, step, onStep, onDismiss, appName, iconUrl,
}: {
  os: 'ios' | 'android'
  isArabic: boolean
  step: number
  onStep: (n: number) => void
  onDismiss: () => void
  appName: string
  iconUrl?: string | null
}) {
  const iosSteps = isArabic
    ? [
        { icon: "🌐", title: "افتح في سفاري", desc: "تأكد أنك تستخدم متصفح Safari (وليس Chrome أو غيره)." },
        { icon: "⬆️", title: "اضغط على زر المشاركة", desc: 'اضغط على أيقونة المشاركة في أسفل الشاشة (المربع بالسهم للأعلى).', img: "share-ios" },
        { icon: "➕", title: "اختر «إضافة للشاشة الرئيسية»", desc: 'مرّر للأسفل في القائمة واختر "إضافة إلى الشاشة الرئيسية".', img: "add-ios" },
        { icon: "✅", title: "اضغط «إضافة»", desc: 'ستظهر الأيقونة على شاشتك الرئيسية. افتحها لتلقّي الإشعارات!' },
      ]
    : [
        { icon: "🌐", title: "Open in Safari", desc: "Make sure you're using Safari (not Chrome or another browser)." },
        { icon: "⬆️", title: "Tap the Share button", desc: "Tap the Share icon at the bottom of the screen (box with arrow).", img: "share-ios" },
        { icon: "➕", title: "Tap \"Add to Home Screen\"", desc: "Scroll down in the menu and tap \"Add to Home Screen\".", img: "add-ios" },
        { icon: "✅", title: "Tap \"Add\"", desc: "The icon will appear on your home screen. Open it to get notifications!" },
      ]

  const androidSteps = isArabic
    ? [
        { icon: "🌐", title: "افتح في Chrome", desc: "تأكد أنك تستخدم متصفح Google Chrome." },
        { icon: "⋮", title: "اضغط على القائمة", desc: 'اضغط على النقاط الثلاث (⋮) في أعلى يمين المتصفح.', img: "menu-android" },
        { icon: "➕", title: "اختر «إضافة إلى الشاشة الرئيسية»", desc: 'اضغط على "إضافة إلى الشاشة الرئيسية" أو "تثبيت التطبيق".', img: "add-android" },
        { icon: "✅", title: "اضغط «إضافة»", desc: 'ستظهر الأيقونة على شاشتك الرئيسية. افتحها لتلقّي الإشعارات!' },
      ]
    : [
        { icon: "🌐", title: "Open in Chrome", desc: "Make sure you're using Google Chrome." },
        { icon: "⋮", title: "Tap the menu", desc: "Tap the three dots (⋮) at the top right of Chrome.", img: "menu-android" },
        { icon: "➕", title: "Tap \"Add to Home Screen\"", desc: "Tap \"Add to Home Screen\" or \"Install App\".", img: "add-android" },
        { icon: "✅", title: "Tap \"Add\"", desc: "The icon will appear on your home screen. Open it to get notifications!" },
      ]

  const steps = os === 'ios' ? iosSteps : androidSteps
  const current = steps[step]
  const isLast = step === steps.length - 1
  const isFirst = step === 0

  const headline = isArabic
    ? `حمّل ${appName} على هاتفك`
    : `Add ${appName} to your phone`
  const subheadline = isArabic
    ? "احصل على تأكيد حجزك، تذكيرات، وتحديثات فورية مباشرة على شاشتك"
    : "Get booking confirmations, reminders & instant updates on your screen"

  return (
    <div className="mb-5 overflow-hidden rounded-2xl border border-[var(--bf-primary-soft)] bg-gradient-to-br from-[var(--bf-primary-soft)] to-white shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[var(--bf-primary-soft)] bg-[var(--bf-primary)] px-4 py-3">
        {iconUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={iconUrl} alt={appName} className="h-10 w-10 rounded-xl object-cover shadow" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-2xl">📲</div>
        )}
        <div className="flex-1">
          <p className="text-sm font-bold text-[var(--bf-on-primary)]">{headline}</p>
          <p className="text-xs text-[var(--bf-on-primary)] leading-snug mt-0.5">{subheadline}</p>
        </div>
        <button onClick={onDismiss} className="shrink-0 rounded-full p-1 text-[var(--bf-on-primary)] hover:opacity-90 hover:text-[var(--bf-on-primary)]">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Benefits strip */}
      <div className="flex gap-3 border-b border-[var(--bf-primary-soft)] bg-white/60 px-4 py-2.5">
        {[
          { icon: "✅", label: isArabic ? "تأكيد الحجز" : "Booking confirmed" },
          { icon: "⏰", label: isArabic ? "تذكير قبل ساعة" : "1-hour reminder" },
          { icon: "❌", label: isArabic ? "تنبيه الإلغاء" : "Cancellation alert" },
        ].map((b, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1 text-center">
            <span className="text-lg">{b.icon}</span>
            <span className="text-[10px] font-medium text-[var(--bf-primary)] leading-tight">{b.label}</span>
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="px-4 py-4">
        {/* Step dots */}
        <div className="mb-3 flex justify-center gap-1.5">
          {steps.map((_, i) => (
            <button
              key={i}
              onClick={() => onStep(i)}
              className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-[var(--bf-primary)]' : 'w-1.5 bg-[var(--bf-primary-soft)]'}`}
            />
          ))}
        </div>

        {/* Current step */}
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--bf-primary-soft)] text-2xl">
            {current.icon}
          </div>
          <div className="flex-1">
            <p className="font-bold text-[var(--bf-text)] text-sm">
              {isArabic ? `الخطوة ${step + 1}` : `Step ${step + 1}`}: {current.title}
            </p>
            <p className="mt-0.5 text-xs text-[var(--bf-muted)] leading-relaxed">{current.desc}</p>
          </div>
        </div>

        {/* Visual hint for share/add steps */}
        {'img' in current && current.img === 'share-ios' && (
          <div className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-[var(--bf-border)] bg-[var(--bf-subtle)] py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--bf-border)] bg-[var(--bf-card)] shadow-sm">
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-blue-500" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <p className="text-xs text-[var(--bf-muted)]">{isArabic ? "أيقونة المشاركة ↑" : "Share icon ↑"}</p>
          </div>
        )}
        {'img' in current && (current.img === 'add-ios' || current.img === 'add-android') && (
          <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-[var(--bf-border)] bg-[var(--bf-subtle)] px-3 py-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--bf-border)] bg-[var(--bf-card)] text-lg shadow-sm">➕</div>
            <p className="text-xs font-medium text-[var(--bf-text)]">
              {isArabic ? "إضافة إلى الشاشة الرئيسية" : "Add to Home Screen"}
            </p>
          </div>
        )}
        {'img' in current && current.img === 'menu-android' && (
          <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-[var(--bf-border)] bg-[var(--bf-subtle)] px-3 py-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--bf-border)] bg-[var(--bf-card)] text-lg font-bold shadow-sm">⋮</div>
            <p className="text-xs font-medium text-[var(--bf-text)]">
              {isArabic ? "القائمة في أعلى المتصفح" : "Menu at top of browser"}
            </p>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="mt-4 flex gap-2">
          {!isFirst && (
            <button
              onClick={() => onStep(step - 1)}
              className="flex-1 rounded-xl border border-[var(--bf-border)] py-2.5 text-sm font-medium text-[var(--bf-text)] hover:bg-[var(--bf-subtle)]"
            >
              {isArabic ? "← السابق" : "← Back"}
            </button>
          )}
          {!isLast ? (
            <button
              onClick={() => onStep(step + 1)}
              className="flex-1 rounded-xl bg-[var(--bf-primary)] py-2.5 text-sm font-semibold text-[var(--bf-on-primary)] hover:opacity-90"
            >
              {isArabic ? "التالي ←" : "Next →"}
            </button>
          ) : (
            <button
              onClick={onDismiss}
              className="flex-1 rounded-xl bg-[var(--bf-primary)] py-2.5 text-sm font-semibold text-[var(--bf-on-primary)] hover:opacity-90"
            >
              {isArabic ? "تم! 🎉" : "Got it! 🎉"}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
