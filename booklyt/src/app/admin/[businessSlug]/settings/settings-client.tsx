"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Building2, Loader2, Save, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/use-toast"
import { compressImage, createAppIconFile } from "@/lib/builder/compress-image"
import { dirForLocale, getDictionary, normalizeLocale } from "@/lib/i18n"
import { BUSINESS_CATEGORIES, COUNTRY_CODES, SUPPORTED_CURRENCIES, TIMEZONES } from "@/lib/utils"

type AdminSettings = {
  id: string
  name: string
  slug: string
  category: string
  phone: string | null
  address: string | null
  logo_url: string | null
  description: string | null
  app_name: string | null
  app_icon_url: string | null
  booking_mode: "appointment" | "group"
  group_capacity: number
  appointments_require_confirmation: boolean
  customer_confirmation_enabled: boolean
  booking_verification_method: "otp" | "link" | "none"
  timezone: string
  wa_booking_confirmation: boolean
  wa_reminders: boolean
  wa_waitlist: boolean
  active: boolean
  time_format: string
  language: "en" | "ar"
  currency: string
  country_code: string | null
  slot_interval: number | null
  booking_days_ahead: number | null
  admin_password_updated_at: string | null
}

export function AdminSettingsClient({ slug }: { slug: string }) {
  const [settings, setSettings] = useState<AdminSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [adminPassword, setAdminPassword] = useState("")

  const loadSettings = async () => {
    setLoading(true)
    const res = await fetch(`/api/admin/portal/${slug}/settings`)
    const result = await res.json().catch(() => ({}))

    if (!res.ok) {
      toast({
        variant: "destructive",
        title: "Could not load settings",
        description: result.error ?? "Please sign in again.",
      })
    } else {
      setSettings(result)
    }

    setLoading(false)
  }

  useEffect(() => {
    loadSettings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  const update = (updates: Partial<AdminSettings>) => {
    setSettings(prev => prev ? { ...prev, ...updates } : prev)
  }

  const saveSettings = async () => {
    if (!settings) return
    setSaving(true)

    const payload = {
      name: settings.name,
      category: settings.category,
      phone: settings.phone,
      address: settings.address,
      description: settings.description,
      app_name: settings.app_name || settings.name,
      logo_url: settings.logo_url,
      app_icon_url: settings.app_icon_url,
      booking_mode: settings.booking_mode,
      group_capacity: settings.group_capacity,
      appointments_require_confirmation: settings.appointments_require_confirmation,
      customer_confirmation_enabled: settings.customer_confirmation_enabled,
      booking_verification_method: settings.booking_verification_method ?? "otp",
      timezone: settings.timezone ?? "Asia/Jerusalem",
      wa_booking_confirmation: settings.wa_booking_confirmation ?? false,
      wa_reminders: settings.wa_reminders ?? true,
      wa_waitlist: settings.wa_waitlist ?? true,
      time_format: settings.time_format,
      language: settings.language,
      currency: settings.currency,
      country_code: settings.country_code ?? "972",
      slot_interval: settings.slot_interval ?? 30,
      booking_days_ahead: settings.booking_days_ahead ?? null,
      ...(adminPassword ? { admin_password: adminPassword } : {}),
    }

    const res = await fetch(`/api/admin/portal/${slug}/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const result = await res.json().catch(() => ({}))

    if (!res.ok) {
      toast({
        variant: "destructive",
        title: "Could not save settings",
        description: result.error ?? "Please try again.",
      })
    } else {
      setAdminPassword("")
      toast({ title: "Settings saved" })
      loadSettings()
    }

    setSaving(false)
  }

  const uploadBusinessImage = async (file: File) => {
    if (!settings) return

    const uploadOne = async (imageFile: File) => {
      const urlRes = await fetch("/api/builder/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: imageFile.name,
          contentType: imageFile.type,
          size: imageFile.size,
          admin_slug: slug,
        }),
      })
      const urlJson = await urlRes.json()
      if (!urlRes.ok) throw new Error(urlJson.error ?? "Could not get upload URL")

      const uploadRes = await fetch(urlJson.signedUrl, {
        method: "PUT",
        headers: { "Content-Type": imageFile.type },
        body: imageFile,
      })
      if (!uploadRes.ok) throw new Error(`Upload failed (${uploadRes.status})`)

      return urlJson.publicUrl as string
    }

    setUploading(true)
    try {
      const [{ file: logoFile }, iconFile] = await Promise.all([
        compressImage(file, 1024, 0.86),
        createAppIconFile(file, 512, 0.9),
      ])
      const [logoUrl, iconUrl] = await Promise.all([
        uploadOne(logoFile),
        uploadOne(iconFile),
      ])

      update({ logo_url: logoUrl, app_icon_url: iconUrl })
      toast({ title: "Logo uploaded", description: "A square app icon was generated." })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Could not upload logo",
      })
    } finally {
      setUploading(false)
    }
  }

  if (loading || !settings) {
    return (
      <main className="min-h-screen bg-zinc-50 px-4 py-10">
        <div className="mx-auto flex max-w-2xl justify-center rounded-xl border bg-white py-16">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
        </div>
      </main>
    )
  }
  const locale = normalizeLocale(settings.language)
  const t = getDictionary(locale)

  return (
    <main dir={dirForLocale(locale)} className="min-h-screen bg-zinc-50 px-4 pb-6 sm:pb-10" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 24px)' }}>
      <div className="mx-auto max-w-2xl space-y-5">
        <Link href={`/admin/${slug}`} className="inline-flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-zinc-900">
          <ArrowLeft className="h-4 w-4" />
          {t.common.back} {t.common.admin}
        </Link>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <h1 className="text-2xl font-bold tracking-tight">{t.admin.businessSettings}</h1>
          <p className="mt-1 text-sm text-zinc-500">{t.admin.settingsDescription}</p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-4">
          <div className="space-y-1.5">
            <Label>{locale === "ar" ? "اسم العمل" : "Business name"}</Label>
            <Input value={settings.name} onChange={event => update({ name: event.target.value })} />
          </div>

          <div className="space-y-1.5">
            <Label>{locale === "ar" ? "الفئة" : "Category"}</Label>
            <select
              value={settings.category}
              onChange={event => update({ category: event.target.value })}
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {BUSINESS_CATEGORIES.map(category => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>{locale === "ar" ? "لغة صفحة الحجز" : "Booking page language"}</Label>
            <select
              value={settings.language}
              onChange={event => update({ language: event.target.value as "en" | "ar" })}
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="en">English</option>
              <option value="ar">Arabic / العربية</option>
            </select>
            <p className="text-xs text-zinc-400">
              {locale === "ar" ? "تغيّر لغة التقويم وخطوات الحجز في صفحة الحجز العامة." : "Changes the public booking page calendar and booking process language."}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>{locale === "ar" ? "العملة" : "Currency"}</Label>
            <select
              value={settings.currency ?? "USD"}
              onChange={event => update({ currency: event.target.value })}
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {SUPPORTED_CURRENCIES.map(c => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
            <p className="text-xs text-zinc-400">
              {locale === "ar" ? "يظهر بجانب أسعار الخدمات في صفحة الحجز." : "Shown next to service prices on the booking page."}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>{locale === "ar" ? "رمز الدولة (واتساب)" : "Country code (WhatsApp)"}</Label>
            <select
              value={settings.country_code ?? "972"}
              onChange={event => update({ country_code: event.target.value })}
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {COUNTRY_CODES.map(c => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
            <p className="text-xs text-zinc-400">
              {locale === "ar" ? "يُستخدم عند إرسال رسائل واتساب للعملاء — يُستبدل بالصفر الأول في رقم الهاتف." : "Used when sending WhatsApp messages — replaces the leading 0 in phone numbers."}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>{locale === "ar" ? "المنطقة الزمنية" : "Timezone"}</Label>
            <select
              value={settings.timezone ?? "Asia/Jerusalem"}
              onChange={event => update({ timezone: event.target.value })}
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {TIMEZONES.map(tz => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </select>
            <p className="text-xs text-zinc-400">
              {locale === "ar" ? "يُستخدم لحساب وقت التذكيرات بشكل صحيح." : "Used to calculate reminder timing correctly."}
            </p>
          </div>

          <div className="rounded-xl border bg-zinc-50 p-4 space-y-3">
            <p className="text-sm font-semibold">{locale === "ar" ? "رسائل واتساب" : "WhatsApp notifications"}</p>
            <p className="text-xs text-zinc-500">{locale === "ar" ? "اختر أي الرسائل تُرسل للعملاء عبر واتساب." : "Choose which WhatsApp messages to send to customers."}</p>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings.wa_booking_confirmation ?? false}
                onChange={event => update({ wa_booking_confirmation: event.target.checked })}
              />
              <span className="text-sm">{locale === "ar" ? "تأكيد الحجز" : "Booking confirmation"}</span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings.wa_reminders ?? true}
                onChange={event => update({ wa_reminders: event.target.checked })}
              />
              <span className="text-sm">{locale === "ar" ? "تذكير بالموعد (قبل ساعة)" : "Appointment reminders (1 hour before)"}</span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings.wa_waitlist ?? true}
                onChange={event => update({ wa_waitlist: event.target.checked })}
              />
              <span className="text-sm">{locale === "ar" ? "إشعارات قائمة الانتظار" : "Waitlist notifications"}</span>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t.common.phone}</Label>
              <Input value={settings.phone ?? ""} onChange={event => update({ phone: event.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{locale === "ar" ? "العنوان" : "Address"}</Label>
              <Input value={settings.address ?? ""} onChange={event => update({ address: event.target.value })} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t.common.description}</Label>
            <Textarea rows={4} value={settings.description ?? ""} onChange={event => update({ description: event.target.value })} />
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-4">
          <h2 className="font-semibold">{locale === "ar" ? "نوع الحجز" : "Booking type"}</h2>
          <div className="space-y-1.5">
            <Label>{locale === "ar" ? "طريقة المواعيد" : "Slot behavior"}</Label>
            <select
              value={settings.booking_mode}
              onChange={event => update({ booking_mode: event.target.value as "appointment" | "group" })}
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="appointment">{locale === "ar" ? "حجز واحد لكل موعد" : "1 appointment per slot"}</option>
              <option value="group">{locale === "ar" ? "جلسة جماعية بسعة محددة" : "Group session with capacity"}</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>{locale === "ar" ? "سعة المجموعة" : "Group capacity"}</Label>
            <Input
              type="number"
              min={1}
              value={settings.group_capacity}
              onChange={event => update({ group_capacity: Math.max(1, Number(event.target.value) || 1) })}
            />
          </div>
          <div className="space-y-2">
            <Label>{locale === "ar" ? "فترة المواعيد" : "Appointment slot interval"}</Label>
            <div className="flex gap-2 flex-wrap">
              {[10, 15, 20, 30, 45, 60].map(min => (
                <button
                  key={min}
                  type="button"
                  onClick={() => update({ slot_interval: min })}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                    (settings.slot_interval ?? 30) === min
                      ? "border-violet-300 bg-violet-50 text-violet-900"
                      : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                  }`}
                >
                  {min} {locale === "ar" ? "د" : "min"}
                </button>
              ))}
            </div>
            <p className="text-xs text-zinc-400">
              {locale === "ar"
                ? "الفاصل الزمني بين المواعيد المتاحة في صفحة الحجز."
                : "Gap between available slots on the booking page."}
            </p>
          </div>

          <div className="space-y-2">
            <Label>{locale === "ar" ? "نافذة الحجز (بالأيام)" : "Booking window (days)"}</Label>
            <Input
              type="number"
              min={1}
              max={365}
              value={settings.booking_days_ahead ?? ""}
              onChange={event => {
                const val = event.target.value === "" ? null : Math.max(1, Number(event.target.value) || 1)
                update({ booking_days_ahead: val })
              }}
              placeholder={locale === "ar" ? "بلا حد" : "No limit"}
            />
            <p className="text-xs text-zinc-400">
              {locale === "ar"
                ? "يحدد عدد الأيام القادمة التي يمكن للعملاء الحجز فيها. اتركه فارغاً للسماح بالحجز على مدى 90 يوماً."
                : "Limits how many days ahead customers can book. Leave blank to allow up to 90 days ahead."}
            </p>
          </div>

          <label className="flex items-start gap-3 rounded-xl border bg-zinc-50 p-3">
            <input
              type="checkbox"
              checked={settings.appointments_require_confirmation}
              onChange={event => update({ appointments_require_confirmation: event.target.checked })}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-medium">{locale === "ar" ? "الحجوزات تحتاج تأكيداً" : "Appointments need confirmation"}</span>
              <span className="block text-xs text-zinc-500">
                {locale === "ar" ? "عند إلغاء التحديد، سيتم تأكيد الحجوزات الجديدة تلقائياً." : "When unchecked, new bookings are automatically confirmed."}
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-xl border bg-zinc-50 p-3">
            <input
              type="checkbox"
              checked={settings.customer_confirmation_enabled ?? false}
              onChange={event => update({ customer_confirmation_enabled: event.target.checked })}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-medium">{locale === "ar" ? "السماح للعملاء بتأكيد الحضور" : "Allow customers to confirm attendance"}</span>
              <span className="block text-xs text-zinc-500">
                {locale === "ar" ? "يمكن للعملاء تأكيد حضورهم من صفحة إدارة الحجز." : "Customers can confirm they will attend from their manage-booking page."}
              </span>
            </span>
          </label>

          <div className="space-y-2">
            <Label>{locale === "ar" ? "طريقة تحقق العميل عند الحجز" : "Customer booking verification"}</Label>
            <div className="flex gap-2">
              {(["otp", "link", "none"] as const).map(method => (
                <button
                  key={method}
                  type="button"
                  onClick={() => update({ booking_verification_method: method })}
                  className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
                    (settings.booking_verification_method ?? "otp") === method
                      ? "border-violet-300 bg-violet-50 text-violet-900"
                      : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                  }`}
                >
                  {method === "otp"
                    ? (locale === "ar" ? "رمز OTP" : "OTP Code")
                    : method === "link"
                    ? (locale === "ar" ? "رابط تأكيد" : "Confirmation Link")
                    : (locale === "ar" ? "بدون تحقق" : "None")}
                </button>
              ))}
            </div>
            <p className="text-xs text-zinc-400">
              {locale === "ar"
                ? "رمز OTP: يرسل رمز من 4 أرقام عبر واتساب. رابط تأكيد: يرسل رابط للتأكيد عبر واتساب. بدون تحقق: يُؤكد الحجز مباشرة."
                : "OTP Code: sends a 4-digit code via WhatsApp. Confirmation Link: sends a confirmation link via WhatsApp. None: booking is confirmed immediately."}
            </p>
          </div>

          <div className="space-y-2">
            <Label>{locale === "ar" ? "تنسيق الوقت" : "Time display format"}</Label>
            <div className="flex gap-2">
              {(["12h", "24h"] as const).map(fmt => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => update({ time_format: fmt })}
                  className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
                    (settings.time_format ?? "12h") === fmt
                      ? "border-violet-300 bg-violet-50 text-violet-900"
                      : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                  }`}
                >
                  {fmt === "12h" ? (locale === "ar" ? "12 ساعة (ص/م)" : "12h (AM/PM)") : (locale === "ar" ? "24 ساعة" : "24h")}
                </button>
              ))}
            </div>
            <p className="text-xs text-zinc-400">
              {locale === "ar" ? "يؤثر على كيفية عرض الأوقات في صفحة المواعيد." : "Affects how times appear on your appointments view."}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-4">
          <h2 className="font-semibold">{locale === "ar" ? "هوية التطبيق" : "App identity"}</h2>
          <div className="space-y-1.5">
            <Label>{locale === "ar" ? "اسم التطبيق" : "App name"}</Label>
            <Input value={settings.app_name ?? settings.name} onChange={event => update({ app_name: event.target.value })} />
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border bg-zinc-50">
                {settings.app_icon_url || settings.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={settings.app_icon_url ?? settings.logo_url ?? ""} alt={locale === "ar" ? "أيقونة التطبيق" : "App icon"} className="h-full w-full object-cover" />
                ) : (
                  <Building2 className="h-7 w-7 text-zinc-300" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium">{locale === "ar" ? "الشعار وأيقونة التطبيق" : "Logo and app icon"}</p>
                <p className="text-xs text-zinc-500">{locale === "ar" ? "ارفع أي شعار وسيتم إنشاء أيقونة مربعة للتطبيق." : "Upload any logo. A square app icon is generated."}</p>
              </div>
            </div>
            <label className="sm:ml-auto">
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={event => {
                  const file = event.target.files?.[0]
                  if (file) uploadBusinessImage(file)
                  event.target.value = ""
                }}
              />
              <Button type="button" variant="outline" disabled={uploading} asChild>
                <span>
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {uploading ? (locale === "ar" ? "جار الرفع..." : "Uploading...") : (locale === "ar" ? "رفع الشعار" : "Upload logo")}
                </span>
              </Button>
            </label>
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-4">
          <h2 className="font-semibold">{locale === "ar" ? "كلمة مرور الإدارة" : "Admin password"}</h2>
          <Input
            type="password"
            value={adminPassword}
            onChange={event => setAdminPassword(event.target.value)}
            placeholder={settings.admin_password_updated_at ? (locale === "ar" ? "تغيير كلمة مرور الإدارة" : "Change admin password") : (locale === "ar" ? "تعيين كلمة مرور الإدارة" : "Set admin password")}
            autoComplete="new-password"
          />
          {settings.admin_password_updated_at && (
            <p className="text-xs text-zinc-400">
              {locale === "ar" ? "آخر تغيير" : "Last changed"} {new Date(settings.admin_password_updated_at).toLocaleDateString(locale === "ar" ? "ar" : "en")}.
            </p>
          )}
        </div>

        <Button type="button" onClick={saveSettings} disabled={saving} className="w-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {locale === "ar" ? "حفظ الإعدادات" : "Save settings"}
        </Button>

        <div className={`rounded-2xl border p-5 shadow-sm space-y-3 ${settings.active !== false ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"}`}>
          <h2 className="font-semibold text-sm">
            {settings.active !== false
              ? (locale === "ar" ? "تعطيل النشاط التجاري" : "Deactivate business")
              : (locale === "ar" ? "إعادة تفعيل النشاط التجاري" : "Reactivate business")}
          </h2>
          <p className="text-xs text-zinc-600">
            {settings.active !== false
              ? (locale === "ar" ? "سيصبح رابط الحجز غير متاح ولن يتمكن العملاء من الحجز." : "Your booking page will be inaccessible and no new bookings can be made.")
              : (locale === "ar" ? "النشاط التجاري معطّل حالياً. العملاء لا يمكنهم الوصول لصفحة الحجز." : "Your business is currently deactivated. Customers cannot book.")}
          </p>
          <Button
            type="button"
            variant={settings.active !== false ? "destructive" : "default"}
            size="sm"
            onClick={async () => {
              const next = settings.active === false
              const msg = next
                ? (locale === "ar" ? "إعادة تفعيل النشاط التجاري؟" : "Reactivate your business? Customers will be able to book again.")
                : (locale === "ar" ? "تعطيل النشاط التجاري؟" : "Deactivate your business? Customers will not be able to book.")
              if (!confirm(msg)) return
              const res = await fetch(`/api/admin/portal/${slug}/settings`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ active: next }),
              })
              if (res.ok) {
                update({ active: next })
                toast({ title: next ? (locale === "ar" ? "تم التفعيل" : "Business reactivated") : (locale === "ar" ? "تم التعطيل" : "Business deactivated") })
              }
            }}
          >
            {settings.active !== false
              ? (locale === "ar" ? "تعطيل" : "Deactivate")
              : (locale === "ar" ? "إعادة التفعيل" : "Reactivate")}
          </Button>
        </div>
      </div>
    </main>
  )
}
