import Link from "next/link"
import { notFound } from "next/navigation"
import { format, parseISO } from "date-fns"
import { arSA } from "date-fns/locale"
import { createServiceClient } from "@/lib/supabase/service"
import { formatCurrency } from "@/lib/utils"
import { dirForLocale, getDictionary, normalizeLocale, statusLabel } from "@/lib/i18n"
import { CancelBookingButton } from "./cancel-button"
import { ConfirmAttendanceButton } from "./confirm-button"
import { RescheduleSheet } from "./reschedule-sheet"

export const dynamic = "force-dynamic"

type PageProps = {
  params: Promise<{ token: string }>
}

type ManagedAppointment = {
  id: string
  business_id: string
  staff_member_id: string | null
  appointment_date: string
  start_time: string
  end_time: string
  participants_count: number
  status: string
  customer_name: string
  customer_email: string | null
  customer_confirmed_at: string | null
  businesses: { name: string; slug: string; language: string | null; currency: string | null; customer_confirmation_enabled: boolean } | null
  services: { name: string; price: number; duration_minutes: number } | null
  staff_members: { name: string } | null
}

export default async function ManageBookingPage({ params }: PageProps) {
  const { token } = await params
  // Service role: the unguessable manage_token in the URL is the authorization.
  // Using the anon client here required a read-everything RLS policy on
  // appointments, which exposed every customer's name/phone/email publicly.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceClient() as any

  const { data: appointment } = await supabase
    .from("appointments")
    .select(`
      id,
      business_id,
      staff_member_id,
      appointment_date,
      start_time,
      end_time,
      participants_count,
      status,
      customer_name,
      customer_email,
      customer_confirmed_at,
      businesses(name, slug, language, currency, customer_confirmation_enabled),
      services(name, price, duration_minutes),
      staff_members(name)
    `)
    .eq("manage_token", token)
    .maybeSingle() as { data: ManagedAppointment | null }

  if (!appointment) {
    notFound()
  }

  const isCancelled = appointment.status === "cancelled"
  const bookingUrl = appointment.businesses?.slug ? `/book/${appointment.businesses.slug}` : "/"
  const locale = normalizeLocale(appointment.businesses?.language)
  const t = getDictionary(locale)
  const dateText = format(parseISO(`${appointment.appointment_date}T00:00:00`), "EEEE, MMMM d, yyyy", locale === "ar" ? { locale: arSA } : undefined)

  // Show confirm button if:
  // - Business has customer_confirmation_enabled
  // - Appointment is not cancelled
  // - Customer hasn't already confirmed
  const showConfirmButton =
    !!appointment.businesses?.customer_confirmation_enabled &&
    appointment.status !== "cancelled" &&
    !appointment.customer_confirmed_at

  return (
    <main dir={dirForLocale(locale)} className="min-h-screen bg-zinc-50 px-4 py-10">
      {bookingUrl !== "/" && (
        <div className="mx-auto mb-4 max-w-lg">
          <Link href={bookingUrl} className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-800">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d={locale === "ar" ? "M9 5l7 7-7 7" : "M15 19l-7-7 7-7"} />
            </svg>
            {t.common.back}
          </Link>
        </div>
      )}
      <div className="mx-auto max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-600">
          {t.manageBooking.title}
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-950">
          {appointment.businesses?.name ?? t.manageBooking.fallbackTitle}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {t.manageBooking.intro}
        </p>

        <div className="mt-6 space-y-3 rounded-xl bg-zinc-50 p-4 text-sm">
          <Detail label={t.common.service} value={appointment.services?.name ?? t.common.service} />
          <Detail label={t.common.date} value={dateText} />
          <Detail label={t.common.time} value={`${appointment.start_time.slice(0, 5)} - ${appointment.end_time.slice(0, 5)}`} />
          {appointment.staff_members?.name && <Detail label={t.common.with} value={appointment.staff_members.name} />}
          <Detail label={t.common.name} value={appointment.customer_name} />
          {appointment.customer_email && <Detail label={t.common.email} value={appointment.customer_email} />}
          {appointment.participants_count > 1 && (
            <Detail label={t.manageBooking.participants} value={String(appointment.participants_count)} />
          )}
          {appointment.services && <Detail label={t.manageBooking.price} value={formatCurrency(appointment.services.price, appointment.businesses?.currency ?? "USD")} />}
          <Detail label={t.common.status} value={statusLabel(appointment.status, locale)} />
          {appointment.customer_confirmed_at && (
            <div className="flex items-center justify-between gap-4">
              <span className="text-zinc-400">Attendance</span>
              <span className="text-end font-medium text-emerald-600">✓ Confirmed by you</span>
            </div>
          )}
        </div>

        <div className="mt-6 space-y-3">
          {/* Customer attendance confirm button */}
          {showConfirmButton && (
            <ConfirmAttendanceButton token={token} language={locale} />
          )}

          {isCancelled ? (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-600">
              {t.manageBooking.alreadyCancelled}
            </div>
          ) : (
            <>
              {appointment.status !== "completed" && (
                <RescheduleSheet
                  token={token}
                  businessId={appointment.business_id}
                  durationMinutes={appointment.services?.duration_minutes ?? 30}
                  staffMemberId={appointment.staff_member_id}
                  language={locale}
                />
              )}
              <CancelBookingButton token={token} language={locale} />
            </>
          )}

          <Link
            href={bookingUrl}
            className="block w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-center text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            {t.manageBooking.bookNewTime}
          </Link>
        </div>
      </div>
    </main>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-zinc-400">{label}</span>
      <span className="text-end font-medium text-zinc-800">{value}</span>
    </div>
  )
}
