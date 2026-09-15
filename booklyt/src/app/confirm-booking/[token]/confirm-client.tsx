"use client"

import { useState } from "react"
import { CheckCircle2, XCircle, Info, Calendar, Clock, User, Scissors, Loader2 } from "lucide-react"
import Link from "next/link"

interface Props {
  token: string
  status: "pending" | "already_confirmed" | "cancelled"
  language: string
  businessName: string
  customerName?: string
  customerPhone?: string
  serviceName?: string
  servicePrice?: number
  serviceDuration?: number
  staffName?: string
  appointmentDate?: string
  startTime?: string
  endTime?: string
  manageUrl?: string
}

export default function ConfirmBookingClient({
  token,
  status: initialStatus,
  language,
  businessName,
  customerName,
  serviceName,
  servicePrice,
  serviceDuration,
  staffName,
  appointmentDate,
  startTime,
  endTime,
  manageUrl,
}: Props) {
  const isArabic = language === "ar"
  const [status, setStatus] = useState(initialStatus)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/confirm-booking/${token}`, { method: "POST", credentials: "same-origin" })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? (isArabic ? "حدث خطأ" : "Something went wrong"))
        return
      }
      setStatus("already_confirmed")
    } catch {
      setError(isArabic ? "حدث خطأ في الاتصال" : "Connection error")
    } finally {
      setLoading(false)
    }
  }

  const handleDecline = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/confirm-booking/${token}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? (isArabic ? "حدث خطأ" : "Something went wrong"))
        return
      }
      setStatus("cancelled")
    } catch {
      setError(isArabic ? "حدث خطأ في الاتصال" : "Connection error")
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split("-").map(Number)
    const date = new Date(y, m - 1, d)
    const dayNames = isArabic
      ? ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"]
      : ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    return `${dayNames[date.getDay()]}, ${dateStr}`
  }

  return (
    <div dir={isArabic ? "rtl" : "ltr"} className="min-h-screen bg-zinc-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">

        {/* ── Cancelled ── */}
        {status === "cancelled" && (
          <div className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-5">
              <XCircle className="w-8 h-8 text-red-500" />
            </div>
            <h1 className="text-xl font-bold tracking-tight mb-2">
              {isArabic ? "تم إلغاء الحجز" : "Booking Cancelled"}
            </h1>
            <p className="text-sm text-zinc-500">
              {isArabic ? "تم إلغاء هذا الحجز." : "This booking has been cancelled."}
            </p>
          </div>
        )}

        {/* ── Already confirmed ── */}
        {status === "already_confirmed" && (
          <div className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <h1 className="text-xl font-bold tracking-tight mb-1.5">
              {isArabic ? "تم تأكيد الحجز!" : "Booking Confirmed!"}
            </h1>
            <p className="text-sm text-zinc-500 mb-6">
              {isArabic
                ? `تم تأكيد حجزك لدى ${businessName}.`
                : `Your booking at ${businessName} is confirmed.`}
            </p>

            {(serviceName || appointmentDate || startTime) && (
              <div className="bg-zinc-50 rounded-xl p-4 space-y-2.5 mb-6 text-start">
                {serviceName && (
                  <Row icon={<Scissors className="w-3.5 h-3.5" />} label={isArabic ? "الخدمة" : "Service"} value={serviceName} />
                )}
                {appointmentDate && (
                  <Row icon={<Calendar className="w-3.5 h-3.5" />} label={isArabic ? "التاريخ" : "Date"} value={formatDate(appointmentDate)} />
                )}
                {startTime && (
                  <Row icon={<Clock className="w-3.5 h-3.5" />} label={isArabic ? "الوقت" : "Time"} value={`${startTime.slice(0, 5)}${endTime ? ` – ${endTime.slice(0, 5)}` : ""}`} />
                )}
                {staffName && (
                  <Row icon={<User className="w-3.5 h-3.5" />} label={isArabic ? "مع" : "With"} value={staffName} />
                )}
              </div>
            )}

            {manageUrl && (
              <Link
                href={manageUrl}
                className="inline-flex items-center justify-center w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                {isArabic ? "إدارة الحجز" : "Manage booking"}
              </Link>
            )}
          </div>
        )}

        {/* ── Pending — show details + confirm/decline ── */}
        {status === "pending" && (
          <>
            {/* Header */}
            <div className="bg-gradient-to-b from-violet-50 to-white px-6 pt-7 pb-5 text-center">
              <div className="w-14 h-14 rounded-full bg-violet-100 flex items-center justify-center mx-auto mb-4">
                <Info className="w-7 h-7 text-violet-600" />
              </div>
              <h1 className="text-lg font-bold tracking-tight text-zinc-900">
                {isArabic ? "تأكيد الحجز" : "Confirm Your Booking"}
              </h1>
              <p className="text-sm text-zinc-500 mt-1">
                {isArabic
                  ? `يرجى مراجعة تفاصيل حجزك لدى ${businessName}`
                  : `Please review your booking at ${businessName}`}
              </p>
            </div>

            {/* Details */}
            <div className="px-6 pb-2">
              <div className="bg-zinc-50 rounded-xl p-4 space-y-3">
                {customerName && (
                  <Row icon={<User className="w-3.5 h-3.5" />} label={isArabic ? "الاسم" : "Name"} value={customerName} />
                )}
                {serviceName && (
                  <Row icon={<Scissors className="w-3.5 h-3.5" />} label={isArabic ? "الخدمة" : "Service"} value={serviceName} />
                )}
                {serviceDuration && (
                  <Row icon={<Clock className="w-3.5 h-3.5" />} label={isArabic ? "المدة" : "Duration"} value={isArabic ? `${serviceDuration} دقيقة` : `${serviceDuration} min`} />
                )}
                {appointmentDate && (
                  <Row icon={<Calendar className="w-3.5 h-3.5" />} label={isArabic ? "التاريخ" : "Date"} value={formatDate(appointmentDate)} />
                )}
                {startTime && (
                  <Row icon={<Clock className="w-3.5 h-3.5" />} label={isArabic ? "الوقت" : "Time"} value={`${startTime.slice(0, 5)}${endTime ? ` – ${endTime.slice(0, 5)}` : ""}`} />
                )}
                {staffName && (
                  <Row icon={<User className="w-3.5 h-3.5" />} label={isArabic ? "مع" : "With"} value={staffName} />
                )}
                {servicePrice != null && servicePrice > 0 && (
                  <div className="flex items-center justify-between pt-2 border-t border-zinc-200">
                    <span className="text-sm font-semibold text-zinc-900">{isArabic ? "المجموع" : "Total"}</span>
                    <span className="text-sm font-bold text-zinc-900">{servicePrice}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="px-6 pt-2">
                <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
              </div>
            )}

            {/* Buttons */}
            <div className="px-6 py-5 space-y-2.5">
              <button
                onClick={handleConfirm}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    {isArabic ? "تأكيد الحجز" : "Confirm Booking"}
                  </>
                )}
              </button>
              <button
                onClick={handleDecline}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                <XCircle className="w-4 h-4" />
                {isArabic ? "إلغاء الحجز" : "Decline & Cancel"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-zinc-400">
        {icon}
        <span className="text-[13px]">{label}</span>
      </div>
      <span className="text-[13px] font-medium text-zinc-800 text-end">{value}</span>
    </div>
  )
}
