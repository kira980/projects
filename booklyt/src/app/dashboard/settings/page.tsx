"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, Save, Building2, Link as LinkIcon, Copy, ExternalLink, Upload } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { Business } from "@/types/database"
import { compressImage, createAppIconFile } from "@/lib/builder/compress-image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { toast } from "@/components/ui/use-toast"
import { BUSINESS_CATEGORIES, SUPPORTED_CURRENCIES, TIMEZONES } from "@/lib/utils"
import Link from "next/link"

const schema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  category: z.string().min(1, "Category is required"),
  booking_mode: z.enum(["appointment", "group"]),
  group_capacity: z.coerce.number().int().min(1),
  appointments_require_confirmation: z.boolean().default(true),
  customer_confirmation_enabled: z.boolean().default(false),
  booking_verification_method: z.enum(["otp", "link", "none"]).default("otp"),
  timezone: z.string().default("Asia/Jerusalem"),
  wa_booking_confirmation: z.boolean().default(false),
  wa_reminders: z.boolean().default(true),
  wa_waitlist: z.boolean().default(true),
  time_format: z.enum(["12h", "24h"]).default("12h"),
  language: z.enum(["en", "ar"]).default("en"),
  currency: z.string().default("USD"),
  phone: z.string().optional(),
  address: z.string().optional(),
  description: z.string().optional(),
  app_name: z.string().optional(),
  logo_url: z.string().optional(),
  app_icon_url: z.string().optional(),
})

type FormData = z.infer<typeof schema>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any

export default function SettingsPage() {
  const [business, setBusiness] = useState<Business | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [adminPassword, setAdminPassword] = useState("")
  const [savingAdminPassword, setSavingAdminPassword] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })
  const appointmentsRequireConfirmation = watch("appointments_require_confirmation", true)
  const customerConfirmationEnabled = watch("customer_confirmation_enabled", false)
  const bookingVerificationMethod = watch("booking_verification_method", "otp")
  const currentTimeFormat = watch("time_format", "12h")

  const loadData = async () => {
    const supabase = createClient() as AnySupabase
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: biz } = await supabase
      .from("businesses")
      .select("*")
      .eq("owner_id", user.id)
      .single()

    if (biz) {
      const b = biz as Business
      setBusiness(b)
      reset({
        name: b.name,
        category: b.category,
        booking_mode: b.booking_mode ?? "appointment",
        group_capacity: b.group_capacity ?? 1,
        appointments_require_confirmation: b.appointments_require_confirmation ?? true,
        customer_confirmation_enabled: b.customer_confirmation_enabled ?? false,
        booking_verification_method: b.booking_verification_method ?? "otp",
        timezone: b.timezone ?? "Asia/Jerusalem",
        wa_booking_confirmation: b.wa_booking_confirmation ?? false,
        wa_reminders: b.wa_reminders ?? true,
        wa_waitlist: b.wa_waitlist ?? true,
        time_format: (b.time_format === "24h" ? "24h" : "12h") as "12h" | "24h",
        language: b.language ?? "en",
        currency: b.currency ?? "USD",
        phone: b.phone ?? "",
        address: b.address ?? "",
        description: b.description ?? "",
        app_name: b.app_name ?? b.name,
        logo_url: b.logo_url ?? "",
        app_icon_url: b.app_icon_url ?? "",
      })
    }
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadData() }, [])

  const onSubmit = async (data: FormData) => {
    if (!business) return
    setSaving(true)
    const supabase = createClient() as AnySupabase

    const payload = {
      ...data,
      app_name: data.app_name?.trim() || data.name,
      logo_url: data.logo_url || null,
      app_icon_url: data.app_icon_url || null,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase
      .from("businesses")
      .update(payload)
      .eq("id", business.id)

    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message })
    } else {
      toast({ title: "Settings saved" })
      loadData()
    }
    setSaving(false)
  }

  const copyBookingLink = () => {
    if (!business) return
    const url = `${window.location.origin}/book/${business.slug}`
    navigator.clipboard.writeText(url)
    toast({ title: "Link copied to clipboard" })
  }

  const copyAdminLink = () => {
    if (!business) return
    const url = `${window.location.origin}/admin/${business.slug}`
    navigator.clipboard.writeText(url)
    toast({ title: "Admin link copied to clipboard" })
  }

  const saveAdminPassword = async () => {
    if (adminPassword.length < 8) {
      toast({
        variant: "destructive",
        title: "Password too short",
        description: "Use at least 8 characters.",
      })
      return
    }

    setSavingAdminPassword(true)
    const res = await fetch("/api/admin/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: adminPassword }),
    })
    const result = await res.json().catch(() => ({}))

    if (!res.ok) {
      toast({
        variant: "destructive",
        title: "Could not save admin password",
        description: result.error ?? "Please try again.",
      })
    } else {
      setAdminPassword("")
      toast({ title: "Admin password saved" })
      loadData()
    }

    setSavingAdminPassword(false)
  }

  const uploadBusinessImage = async (file: File) => {
    const uploadOne = async (imageFile: File) => {
      const urlRes = await fetch('/api/builder/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: imageFile.name,
          contentType: imageFile.type,
          size: imageFile.size,
        }),
      })
      const urlJson = await urlRes.json()
      if (!urlRes.ok) throw new Error(urlJson.error ?? 'Could not get upload URL')

      const uploadRes = await fetch(urlJson.signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': imageFile.type },
        body: imageFile,
      })
      if (!uploadRes.ok) throw new Error(`Upload failed (${uploadRes.status})`)

      return urlJson.publicUrl as string
    }

    setUploadingLogo(true)
    try {
      const [{ file: logoFile }, iconFile] = await Promise.all([
        compressImage(file, 1024, 0.86),
        createAppIconFile(file, 512, 0.9),
      ])
      const [logoUrl, iconUrl] = await Promise.all([
        uploadOne(logoFile),
        uploadOne(iconFile),
      ])

      setValue("logo_url", logoUrl, { shouldDirty: true })
      setValue("app_icon_url", iconUrl, { shouldDirty: true })
      setBusiness(prev => prev ? { ...prev, logo_url: logoUrl, app_icon_url: iconUrl } : prev)
      toast({ title: "Logo uploaded", description: "A square app icon was generated automatically." })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Could not upload logo",
      })
    } finally {
      setUploadingLogo(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 w-full max-w-2xl">
        <Skeleton className="h-8 w-40" />
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 w-full max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Business Settings</h1>
        <p className="text-zinc-500 mt-1">Update your business profile and booking page details</p>
      </div>

      {/* Booking link */}
      {business && (
        <div className="rounded-xl border bg-violet-50 p-5">
          <div className="flex items-center gap-2 mb-3">
            <LinkIcon className="w-4 h-4 text-violet-600" />
            <h3 className="font-semibold text-violet-900">Your booking page</h3>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="flex-1 text-sm bg-white rounded-lg px-3 py-2 border text-violet-700 font-mono truncate">
              {typeof window !== "undefined" ? window.location.origin : "https://your-domain.com"}/book/{business.slug}
            </code>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" onClick={copyBookingLink} className="shrink-0">
                <Copy className="w-4 h-4" />
              </Button>
              <Link href={`/book/${business.slug}`} target="_blank">
                <Button variant="outline" size="icon" className="shrink-0">
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Shared admin link */}
      {business && (
        <div className="rounded-xl border bg-white p-5">
          <div className="flex items-center gap-2 mb-3">
            <LinkIcon className="w-4 h-4 text-zinc-600" />
            <h3 className="font-semibold text-zinc-900">Shareable admin page</h3>
          </div>
          <p className="mb-3 text-sm text-zinc-500">
            Give a manager access through a business password without sharing your platform login.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="flex-1 text-sm bg-zinc-50 rounded-lg px-3 py-2 border text-zinc-700 font-mono truncate">
              {typeof window !== "undefined" ? window.location.origin : "https://your-domain.com"}/admin/{business.slug}
            </code>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" onClick={copyAdminLink} className="shrink-0">
                <Copy className="w-4 h-4" />
              </Button>
              <Link href={`/admin/${business.slug}`} target="_blank">
                <Button variant="outline" size="icon" className="shrink-0">
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
            <Input
              type="password"
              value={adminPassword}
              onChange={(event) => setAdminPassword(event.target.value)}
              placeholder={business.admin_password_updated_at ? "Change admin password" : "Set admin password"}
              autoComplete="new-password"
            />
            <Button type="button" onClick={saveAdminPassword} disabled={savingAdminPassword}>
              {savingAdminPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save password"}
            </Button>
          </div>
          {business.admin_password_updated_at && (
            <p className="mt-2 text-xs text-zinc-400">
              Password last changed {new Date(business.admin_password_updated_at).toLocaleDateString()}.
            </p>
          )}
        </div>
      )}

      <Separator />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div>
          <h2 className="text-base font-semibold mb-4">Business information</h2>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Business name *</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <Input className="pl-9" {...register("name")} />
              </div>
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Category *</Label>
              <Select
                defaultValue={business?.category}
                onValueChange={(v) => setValue("category", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BUSINESS_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Booking page language</Label>
              <Select
                defaultValue={business?.language ?? "en"}
                onValueChange={(v) => setValue("language", v as "en" | "ar", { shouldDirty: true })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ar">Arabic / العربية</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-zinc-400">
                Changes the public booking page calendar and booking process language.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Select
                defaultValue={business?.currency ?? "USD"}
                onValueChange={(v) => setValue("currency", v, { shouldDirty: true })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-zinc-400">
                Shown next to service prices on your booking page.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Timezone</Label>
              <select
                value={watch("timezone") ?? "Asia/Jerusalem"}
                onChange={e => setValue("timezone", e.target.value, { shouldDirty: true })}
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {TIMEZONES.map(tz => (
                  <option key={tz.value} value={tz.value}>{tz.label}</option>
                ))}
              </select>
              <p className="text-xs text-zinc-400">
                Used to calculate reminder timing correctly.
              </p>
            </div>

            <div className="rounded-xl border bg-zinc-50 p-4 space-y-3">
              <h3 className="text-sm font-semibold">WhatsApp notifications</h3>
              <p className="text-xs text-zinc-500">Choose which WhatsApp messages to send to customers.</p>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={watch("wa_booking_confirmation")}
                  onChange={e => setValue("wa_booking_confirmation", e.target.checked, { shouldDirty: true })}
                />
                <span className="text-sm">Booking confirmation</span>
              </label>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={watch("wa_reminders")}
                  onChange={e => setValue("wa_reminders", e.target.checked, { shouldDirty: true })}
                />
                <span className="text-sm">Appointment reminders (1 hour before)</span>
              </label>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={watch("wa_waitlist")}
                  onChange={e => setValue("wa_waitlist", e.target.checked, { shouldDirty: true })}
                />
                <span className="text-sm">Waitlist notifications</span>
              </label>
            </div>

            <div className="rounded-xl border bg-white p-4 space-y-4">
              <div>
                <h3 className="text-sm font-semibold">Booking app identity</h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Used when clients install this booking page as an app.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>App name</Label>
                <Input
                  placeholder={business?.name ?? "Your business"}
                  {...register("app_name")}
                />
                <p className="text-xs text-zinc-400">
                  Example: Tone Beauty Booking. Falls back to your business name.
                </p>
              </div>

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-2xl border bg-zinc-50 overflow-hidden flex items-center justify-center shrink-0">
                    {business?.app_icon_url || business?.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={business.app_icon_url ?? business.logo_url ?? ""}
                        alt="App icon"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Building2 className="w-7 h-7 text-zinc-300" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium">Logo and app icon</p>
                    <p className="text-xs text-zinc-500">
                      Upload any logo. We create a square 512px app icon.
                    </p>
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
                  <Button type="button" variant="outline" disabled={uploadingLogo} asChild>
                    <span>
                      {uploadingLogo ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                      {uploadingLogo ? "Uploading..." : "Upload logo"}
                    </span>
                  </Button>
                </label>
              </div>

              <input type="hidden" {...register("logo_url")} />
              <input type="hidden" {...register("app_icon_url")} />
            </div>

            <div className="rounded-xl border bg-white p-4 space-y-4">
              <div>
                <h3 className="text-sm font-semibold">Booking type</h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Choose whether each time slot is private or shared by a group.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>Slot behavior</Label>
                <Select
                  defaultValue={business?.booking_mode ?? "appointment"}
                  onValueChange={(v) => setValue("booking_mode", v as "appointment" | "group")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="appointment">1 appointment per slot</SelectItem>
                    <SelectItem value="group">Group session with capacity</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Group capacity</Label>
                <Input
                  type="number"
                  min={1}
                  placeholder="10"
                  {...register("group_capacity", { valueAsNumber: true })}
                />
                <p className="text-xs text-zinc-400">
                  Used only for group sessions. Example: Pilates class with 12 seats.
                </p>
                {errors.group_capacity && (
                  <p className="text-xs text-destructive">{errors.group_capacity.message}</p>
                )}
              </div>
              <label className="flex items-start gap-3 rounded-xl border bg-zinc-50 p-3">
                <input
                  type="checkbox"
                  checked={appointmentsRequireConfirmation}
                  onChange={event => setValue("appointments_require_confirmation", event.target.checked, { shouldDirty: true })}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-medium">Appointments need confirmation</span>
                  <span className="block text-xs text-zinc-500">
                    Turn this off to automatically confirm new bookings.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-3 rounded-xl border bg-zinc-50 p-3">
                <input
                  type="checkbox"
                  checked={customerConfirmationEnabled}
                  onChange={event => setValue("customer_confirmation_enabled", event.target.checked, { shouldDirty: true })}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-medium">Allow customers to confirm attendance</span>
                  <span className="block text-xs text-zinc-500">
                    Customers can confirm they will attend from their manage-booking page.
                  </span>
                </span>
              </label>

              <div className="space-y-2">
                <Label>Customer booking verification</Label>
                <div className="flex gap-2">
                  {(["otp", "link", "none"] as const).map(method => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setValue("booking_verification_method", method, { shouldDirty: true })}
                      className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
                        bookingVerificationMethod === method
                          ? "border-violet-300 bg-violet-50 text-violet-900"
                          : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                      }`}
                    >
                      {method === "otp" ? "OTP Code" : method === "link" ? "Confirmation Link" : "None"}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-zinc-400">
                  OTP Code: sends a 4-digit code via WhatsApp. Confirmation Link: sends a link to confirm the booking via WhatsApp. None: booking is confirmed immediately.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Time display format</Label>
                <div className="flex gap-2">
                  {(["12h", "24h"] as const).map(fmt => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => setValue("time_format", fmt, { shouldDirty: true })}
                      className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
                        currentTimeFormat === fmt
                          ? "border-violet-300 bg-violet-50 text-violet-900"
                          : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                      }`}
                    >
                      {fmt === "12h" ? "12h (AM/PM)" : "24h"}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-zinc-400">Affects how times appear on your appointments dashboard.</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Phone number</Label>
              <Input type="tel" placeholder="+1 (555) 000-0000" {...register("phone")} />
            </div>

            <div className="space-y-1.5">
              <Label>Address</Label>
              <Input placeholder="123 Main St, City, State" {...register("address")} />
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                rows={4}
                placeholder="Tell clients what makes your business special…"
                {...register("description")}
              />
              <p className="text-xs text-zinc-400">Shown on your public booking page</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" variant="gradient" disabled={saving} className="w-full sm:w-auto">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save changes
          </Button>
        </div>
      </form>

      {business && (
        <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-5 space-y-3">
          <h3 className="text-sm font-semibold text-red-900">
            {business.active !== false ? "Deactivate business" : "Reactivate business"}
          </h3>
          <p className="text-xs text-red-700">
            {business.active !== false
              ? "Deactivating will make your booking page inaccessible to customers. No new bookings can be made."
              : "Your business is currently deactivated. Customers cannot access your booking page."}
          </p>
          <Button
            type="button"
            variant={business.active !== false ? "destructive" : "default"}
            size="sm"
            onClick={async () => {
              const next = business.active === false
              const msg = next
                ? "Reactivate your business? Customers will be able to book again."
                : "Deactivate your business? Customers will not be able to book."
              if (!confirm(msg)) return
              const supabase = createClient() as AnySupabase
              await supabase.from("businesses").update({ active: next, updated_at: new Date().toISOString() }).eq("id", business.id)
              loadData()
            }}
          >
            {business.active !== false ? "Deactivate" : "Reactivate"}
          </Button>
        </div>
      )}
    </div>
  )
}
