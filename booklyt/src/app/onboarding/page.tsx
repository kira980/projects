"use client"

import { useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  Calendar,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Building2,
  Phone,
  MapPin,
  Plus,
  Trash2,
  Check,
  Upload,
  X,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
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
import { Progress } from "@/components/ui/progress"
import { toast } from "@/components/ui/use-toast"
import { slugify, BUSINESS_CATEGORIES } from "@/lib/utils"
import { TEMPLATE_PRESETS } from "@/lib/builder/templates"
import { TenantWebsite } from "@/components/layouts/TenantWebsite"
import { ImageDragEditor } from "@/components/builder/ImageDragEditor"
import { PreviewViewport } from "@/components/builder/PreviewViewport"
import { compressImage } from "@/lib/builder/compress-image"
import type { ContentConfig, MetaConfig } from "@/types/builder"
import type { Business, Service, WorkingHours } from "@/types/database"

// ── Types ─────────────────────────────────────────────────────────────────────

interface ServiceDraft {
  name: string
  price: string
  duration: string
}

interface HoursDraft {
  day: number
  open: boolean
  openTime: string
  closeTime: string
  breaks: { start: string; end: string }[]
}

// ── Form schema ───────────────────────────────────────────────────────────────

const schema = z.object({
  name: z.string().min(2, "Business name must be at least 2 characters"),
  slug: z
    .string()
    .min(2, "Slug must be at least 2 characters")
    .regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and hyphens"),
  category: z.string().min(1, "Please select a category"),
  phone: z.string().optional(),
  address: z.string().optional(),
  description: z.string().optional(),
})

type FormData = z.infer<typeof schema>

// ── Step definitions ──────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, title: "Business name",       description: "What should customers call your business?" },
  { id: 2, title: "Category & URL",      description: "Choose your category and booking page URL" },
  { id: 3, title: "Contact & location",  description: "How can clients reach and find you?" },
  { id: 4, title: "About your business", description: "Tell clients what makes you special" },
  { id: 5, title: "Your services",       description: "Add the services customers can book" },
  { id: 6, title: "Working hours",       description: "When are you open for bookings?" },
  { id: 7, title: "Preview & customize", description: "See your website and make it yours" },
]

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_HOURS: HoursDraft[] = [
  { day: 0, open: false, openTime: "09:00", closeTime: "18:00", breaks: [] },
  { day: 1, open: true,  openTime: "09:00", closeTime: "18:00", breaks: [] },
  { day: 2, open: true,  openTime: "09:00", closeTime: "18:00", breaks: [] },
  { day: 3, open: true,  openTime: "09:00", closeTime: "18:00", breaks: [] },
  { day: 4, open: true,  openTime: "09:00", closeTime: "18:00", breaks: [] },
  { day: 5, open: true,  openTime: "09:00", closeTime: "18:00", breaks: [] },
  { day: 6, open: true,  openTime: "10:00", closeTime: "16:00", breaks: [] },
]

const DAY_SHORT  = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

const PREVIEW_BUSINESS_DEFAULTS: Business = {
  id: "preview", owner_id: "preview",
  name: "Your Business", slug: "your-business",
  description: "Book your appointment online", category: "beauty",
  phone: null, address: null, logo_url: null, app_name: null, app_icon_url: null,
  admin_password_hash: null, admin_password_salt: null, admin_password_updated_at: null,
  appointments_require_confirmation: false,
  customer_confirmation_enabled: false,
  booking_verification_method: "otp" as const,
  timezone: "Asia/Jerusalem",
  wa_booking_confirmation: false,
  wa_reminders: true,
  wa_waitlist: true,
  active: true,
  business_code: null, app_enabled: true,
  time_format: "12h",
  language: "en", currency: "USD", slot_interval: 30, booking_days_ahead: null, booking_mode: "appointment", group_capacity: 1,
  created_at: "", updated_at: "",
}

// ── Template color swatches ───────────────────────────────────────────────────

const TEMPLATE_COLORS: Record<string, { bg: string; primary: string }> = {
  "luxury-barber":  { bg: "#0d0d14", primary: "#c9a227" },
  "soft-salon":     { bg: "#fff9f8", primary: "#b76e79" },
  "minimal-clinic": { bg: "#ffffff", primary: "#1a56db" },
  "bold-fitness":   { bg: "#0a0a0a", primary: "#22d3ee" },
  "elegant-spa":    { bg: "#faf7f2", primary: "#8b6f4e" },
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const [step, setStep]       = useState(1)
  const [loading, setLoading] = useState(false)

  // Step 5: Services
  const [services, setServices]         = useState<ServiceDraft[]>([{ name: "", price: "", duration: "30" }])
  const [serviceErrors, setServiceErrors] = useState<string | null>(null)

  // Step 6: Working hours
  const [hours, setHours] = useState<HoursDraft[]>(DEFAULT_HOURS)

  // Step 7: Preview / customize
  const [selectedTemplate, setSelectedTemplate] = useState("soft-salon")
  const [heroImage,   setHeroImage]   = useState<string | undefined>()
  const [previewOverrides, setPreviewOverrides] = useState<Partial<ContentConfig>>({
    showHeroText: true,
    heroImageOverlayOpacity: 40,
    heroImagePositionX: 50,
    heroImagePositionY: 50,
    heroImageZoom: 100,
  })
  const [uploading,   setUploading]   = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Convenience reads from previewOverrides
  const heroTitle     = previewOverrides.heroTitle     ?? ""
  const heroSubtitle  = previewOverrides.heroSubtitle  ?? ""
  const showText      = previewOverrides.showHeroText  ?? true
  const overlayOpacity = previewOverrides.heroImageOverlayOpacity ?? 40
  const heroPosX      = previewOverrides.heroImagePositionX ?? 50
  const heroPosY      = previewOverrides.heroImagePositionY ?? 50
  const heroZoom      = previewOverrides.heroImageZoom ?? 100

  const {
    register, handleSubmit, watch, setValue, trigger,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const nameValue = watch("name", "")

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value
    setValue("name", name)
    if (step === 1) setValue("slug", slugify(name))
  }

  // ── Hours helpers ─────────────────────────────────────────────────────────

  const toggleDay = (day: number) =>
    setHours(prev => prev.map(h => h.day === day ? { ...h, open: !h.open } : h))

  const updateHour = (day: number, field: "openTime" | "closeTime", val: string) =>
    setHours(prev => prev.map(h => h.day === day ? { ...h, [field]: val } : h))

  const addBreak = (day: number) =>
    setHours(prev => prev.map(h => h.day === day ? { ...h, breaks: [...h.breaks, { start: "13:00", end: "14:00" }] } : h))

  const removeBreak = (day: number, bi: number) =>
    setHours(prev => prev.map(h => h.day === day ? { ...h, breaks: h.breaks.filter((_, i) => i !== bi) } : h))

  const updateBreak = (day: number, bi: number, field: "start" | "end", val: string) =>
    setHours(prev => prev.map(h => h.day === day ? {
      ...h,
      breaks: h.breaks.map((b, i) => i === bi ? { ...b, [field]: val } : b),
    } : h))

  // ── Services helpers ───────────────────────────────────────────────────────

  const addService = () => {
    if (services.length >= 8) return
    setServices(prev => [...prev, { name: "", price: "", duration: "30" }])
  }

  const removeService = (i: number) =>
    setServices(prev => prev.filter((_, idx) => idx !== i))

  const updateService = (i: number, field: keyof ServiceDraft, value: string) =>
    setServices(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s))

  // ── Navigation ─────────────────────────────────────────────────────────────

  const nextStep = async () => {
    if (step === 5) {
      const valid = services.some(s => s.name.trim().length > 0)
      if (!valid) { setServiceErrors("Add at least one service."); return }
      setServiceErrors(null)
      setStep(6)
      return
    }
    if (step === 6) { setStep(7); return }

    const fieldsToValidate: (keyof FormData)[] =
      step === 1 ? ["name"] :
      step === 2 ? ["slug", "category"] :
      step === 3 ? ["phone", "address"] :
      ["description"]

    const valid = await trigger(fieldsToValidate)
    if (valid) setStep(s => Math.min(s + 1, STEPS.length))
  }

  // ── Photo upload (step 7) ─────────────────────────────────────────────────

  const handleUpload = async (file: File) => {
    setUploading(true)
    // Optimistic preview. The blob: URL only resolves in this tab, so it is
    // swapped for the Supabase URL on success and rolled back on failure —
    // submitting it would publish a permanently broken hero image.
    const previousHeroImage = heroImage
    const localUrl = URL.createObjectURL(file)
    setHeroImage(localUrl)

    try {
      // Compress first
      const { file: compressed } = await compressImage(file, 1920, 0.85)

      // Get a short-lived signed upload URL from the server
      const urlRes = await fetch("/api/builder/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename:    compressed.name,
          contentType: compressed.type,
          size:        compressed.size,
        }),
      })
      const urlJson = await urlRes.json()
      if (!urlRes.ok) throw new Error(urlJson.error ?? "Could not get upload URL")

      // Upload compressed file directly to Supabase storage
      const uploadRes = await fetch(urlJson.signedUrl, {
        method: "PUT",
        headers: { "Content-Type": compressed.type },
        body: compressed,
      })
      if (!uploadRes.ok) throw new Error(`Upload failed (${uploadRes.status})`)

      // Swap local blob URL for permanent Supabase URL
      setHeroImage(urlJson.publicUrl)
      URL.revokeObjectURL(localUrl)
    } catch (err) {
      setHeroImage(previousHeroImage)
      URL.revokeObjectURL(localUrl)
      toast({
        variant: "destructive",
        title: "Photo upload failed",
        description: err instanceof Error ? err.message : "Please try again, or paste an image URL instead.",
      })
    } finally {
      setUploading(false)
    }
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      toast({ variant: "destructive", title: "Not authenticated", description: "Please sign in again." })
      setLoading(false)
      return
    }

    // Guard: existing business → dashboard
    const { data: existing } = await supabase.from("businesses").select("id").eq("owner_id", user.id).maybeSingle()
    if (existing) { window.location.href = "/dashboard"; return }

    // Slug uniqueness check
    const { data: slugTaken } = await supabase.from("businesses").select("id").eq("slug", data.slug).maybeSingle()
    if (slugTaken) {
      toast({ variant: "destructive", title: "URL taken", description: "Go back to step 2 and choose a different one." })
      setLoading(false)
      return
    }

    // Ensure profile row
    const profileRes = await fetch("/api/auth/ensure-profile", { method: "POST" })
    if (!profileRes.ok) {
      const { error: profileError } = await profileRes.json()
      toast({ variant: "destructive", title: "Profile error", description: profileError })
      setLoading(false)
      return
    }

    // Create business
    const { error: bizError } = await supabase.from("businesses").insert({
      owner_id: user.id,
      name: data.name,
      slug: data.slug,
      category: data.category,
      phone: data.phone || null,
      address: data.address || null,
      description: data.description || null,
    })

    if (bizError) {
      if (bizError.code === "23505") { window.location.href = "/dashboard"; return }
      toast({ variant: "destructive", title: "Could not create business", description: bizError.message })
      setLoading(false)
      return
    }

    const { data: biz } = await supabase.from("businesses").select("id").eq("owner_id", user.id).single()
    if (!biz) {
      toast({ variant: "destructive", title: "Unexpected error", description: "Business was created but could not be fetched." })
      setLoading(false)
      return
    }

    // Seed working hours from step 6 state
    const hoursRows = hours.map(h => ({
      business_id: biz.id,
      day_of_week: h.day,
      is_open: h.open,
      open_time: h.open ? `${h.openTime}:00` : "09:00:00",
      close_time: h.open ? `${h.closeTime}:00` : "18:00:00",
    }))
    await supabase.from("working_hours").insert(hoursRows)

    // Seed breaks
    const breakRows = hours.flatMap(h =>
      h.open ? h.breaks
        .filter(b => b.start && b.end && b.start < b.end)
        .map(b => ({
          business_id: biz.id,
          day_of_week: h.day,
          start_time: `${b.start}:00`,
          end_time: `${b.end}:00`,
        }))
      : []
    )
    if (breakRows.length > 0) {
      await supabase.from("working_hour_breaks").insert(breakRows)
    }

    // Create services
    const validServices = services.filter(s => s.name.trim().length > 0)
    if (validServices.length > 0) {
      await supabase.from("services").insert(
        validServices.map(s => ({
          business_id: biz.id,
          name: s.name.trim(),
          price: parseFloat(s.price) || 0,
          duration_minutes: parseInt(s.duration) || 30,
          active: true,
        }))
      )
    }

    // Build the final config from the preview step customizations
    const tpl = TEMPLATE_PRESETS.find(t => t.slug === selectedTemplate) ?? TEMPLATE_PRESETS[0]
    const configPayload = {
      brand: tpl.brand,
      layout: {
        ...tpl.layout,
        sections: tpl.layout.sections.map(s =>
          s.type === "booking" ? { ...s, visible: true } : s
        ),
      },
      content: {
        ...tpl.content,
        ...previewOverrides,
        heroTitle: previewOverrides.heroTitle || data.name,
        heroSubtitle: previewOverrides.heroSubtitle || data.description || "Book your appointment online, anytime.",
        heroCtaText: previewOverrides.heroCtaText || "Book Now",
        heroImage,
      } satisfies Partial<ContentConfig>,
      meta: {
        businessType: "general",
        bookingMode: "appointment",
        language: "en",
        branding: {},
        booking: {
          calendarType: "monthly",
          staffSelectionBehavior: "optional",
          capacityBehavior: "per-slot",
        },
        app: {
          mobileNavStyle: "bottom-tabs",
          defaultOpenMode: "standalone",
        },
      } satisfies MetaConfig,
    }

    // 1. Save as draft, then 2. publish so the booking page is live on first
    //    visit. Failures here used to be swallowed, which left the new business
    //    with no published config at all — the booking page fell back to the
    //    generic template and the owner was told their site was ready.
    try {
      const saveRes = await fetch("/api/builder/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_draft", ...configPayload }),
      })
      if (!saveRes.ok) {
        const { error } = await saveRes.json().catch(() => ({ error: null }))
        throw new Error(error ?? `Save failed (${saveRes.status})`)
      }

      const pubRes = await fetch("/api/builder/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish" }),
      })
      if (!pubRes.ok) {
        const { error } = await pubRes.json().catch(() => ({ error: null }))
        throw new Error(error ?? `Publish failed (${pubRes.status})`)
      }

      toast({ title: "Welcome to BookFlow! 🎉", description: "Your website is ready." })
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Your business was created, but the website could not be published",
        description: `${err instanceof Error ? err.message : "Unknown error"} — open the Website Builder and press Publish.`,
      })
    }

    window.location.href = "/dashboard"
  }

  const progress = (step / STEPS.length) * 100

  // ── Live preview data (step 7) ─────────────────────────────────────────────

  const tpl = TEMPLATE_PRESETS.find(t => t.slug === selectedTemplate) ?? TEMPLATE_PRESETS[0]
  const previewContent: Partial<ContentConfig> = {
    ...tpl.content,
    heroTitle: nameValue || "Your Business",
    heroSubtitle: watch("description") || "Book your appointment online, anytime.",
    heroCtaText: "Book Now",
    ...previewOverrides,
    heroImage, // upload state always wins over any inline edit
  }

  const isFullWidth = step === 7

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      {/* Header */}
      <header className="h-16 border-b bg-white flex items-center justify-between px-6 shrink-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center">
            <Calendar className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-bold text-sm">BookFlow</span>
        </div>
        <span className="text-sm text-zinc-400">Step {step} of {STEPS.length}</span>
      </header>

      {/* Progress bar */}
      <div className="bg-white border-b px-6 py-3 shrink-0">
        <Progress value={progress} className="h-1.5" />
        <div className="flex gap-1 mt-2">
          {STEPS.map(s => (
            <div
              key={s.id}
              className={`flex-1 h-0.5 rounded-full transition-all ${s.id <= step ? "gradient-primary opacity-100" : "bg-zinc-200"}`}
            />
          ))}
        </div>
      </div>

      {/* Body */}
      <div className={`flex-1 flex ${isFullWidth ? "items-stretch" : "items-center justify-center p-4 sm:p-8"}`}>
        {/* ── Steps 1–6: centered narrow container ── */}
        {!isFullWidth && (
          <div className="w-full max-w-lg">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
              >
                <div className="mb-8">
                  <h1 className="text-2xl font-bold mb-1">{STEPS[step - 1].title}</h1>
                  <p className="text-zinc-500">{STEPS[step - 1].description}</p>
                </div>

                <div className="bg-white rounded-2xl border p-6 shadow-sm space-y-5">

                  {/* ── Step 1: Business name ── */}
                  {step === 1 && (
                    <div className="space-y-1.5">
                      <Label htmlFor="name">Business name *</Label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                        <Input
                          id="name"
                          placeholder="The Sharp Cut Barbershop"
                          className="pl-9"
                          {...register("name")}
                          onChange={handleNameChange}
                        />
                      </div>
                      {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                      {nameValue && (
                        <p className="text-xs text-zinc-400">
                          Preview URL:{" "}
                          <span className="text-violet-600 font-medium">
                            bookflow.app/book/{slugify(nameValue)}
                          </span>
                        </p>
                      )}
                    </div>
                  )}

                  {/* ── Step 2: Category & URL ── */}
                  {step === 2 && (
                    <>
                      <div className="space-y-1.5">
                        <Label htmlFor="category">Business category *</Label>
                        <Select onValueChange={v => setValue("category", v)}>
                          <SelectTrigger id="category">
                            <SelectValue placeholder="Select your category" />
                          </SelectTrigger>
                          <SelectContent>
                            {BUSINESS_CATEGORIES.map(cat => (
                              <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {errors.category && <p className="text-xs text-destructive">{errors.category.message}</p>}
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="slug">Booking page URL *</Label>
                        <div className="flex rounded-lg border overflow-hidden focus-within:ring-2 focus-within:ring-violet-500">
                          <span className="bg-zinc-50 border-r px-3 flex items-center text-xs text-zinc-500 whitespace-nowrap">
                            bookflow.app/book/
                          </span>
                          <Input
                            id="slug"
                            className="border-0 rounded-none focus-visible:ring-0"
                            placeholder="your-business"
                            {...register("slug")}
                          />
                        </div>
                        {errors.slug && <p className="text-xs text-destructive">{errors.slug.message}</p>}
                        <p className="text-xs text-zinc-400">Only lowercase letters, numbers, and hyphens</p>
                      </div>
                    </>
                  )}

                  {/* ── Step 3: Contact & location ── */}
                  {step === 3 && (
                    <>
                      <div className="space-y-1.5">
                        <Label htmlFor="phone">Phone number</Label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                          <Input id="phone" type="tel" placeholder="+1 (555) 000-0000" className="pl-9" {...register("phone")} />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="address">Business address</Label>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                          <Input id="address" placeholder="123 Main St, City, State" className="pl-9" {...register("address")} />
                        </div>
                      </div>
                    </>
                  )}

                  {/* ── Step 4: About ── */}
                  {step === 4 && (
                    <div className="space-y-1.5">
                      <Label htmlFor="description">Business description</Label>
                      <Textarea
                        id="description"
                        placeholder="Tell clients what makes your business special…"
                        rows={5}
                        {...register("description")}
                      />
                      <p className="text-xs text-zinc-400">Appears on your public booking page</p>
                    </div>
                  )}

                  {/* ── Step 5: Services ── */}
                  {step === 5 && (
                    <div className="space-y-3">
                      {services.map((svc, i) => (
                        <div key={i} className="flex gap-2 items-start p-3 rounded-xl border bg-zinc-50">
                          <div className="flex-1 space-y-2 min-w-0">
                            <Input
                              placeholder="Service name (e.g. Haircut)"
                              value={svc.name}
                              onChange={e => updateService(i, "name", e.target.value)}
                            />
                            <div className="flex gap-2">
                              <div className="flex-1 relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">$</span>
                                <Input
                                  type="number" min="0" placeholder="Price"
                                  className="pl-7"
                                  value={svc.price}
                                  onChange={e => updateService(i, "price", e.target.value)}
                                />
                              </div>
                              <Select value={svc.duration} onValueChange={v => updateService(i, "duration", v)}>
                                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {[15, 20, 30, 45, 60, 75, 90, 120].map(d => (
                                    <SelectItem key={d} value={String(d)}>{d} min</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          {services.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeService(i)}
                              className="mt-1 p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                      {serviceErrors && <p className="text-xs text-destructive">{serviceErrors}</p>}
                      {services.length < 8 && (
                        <button
                          type="button"
                          onClick={addService}
                          className="flex items-center gap-2 text-sm text-violet-600 hover:text-violet-700 font-medium py-1"
                        >
                          <Plus className="w-4 h-4" />
                          Add another service
                        </button>
                      )}
                    </div>
                  )}

                  {/* ── Step 6: Working hours ── */}
                  {step === 6 && (
                    <div className="space-y-2">
                      {hours.map(h => (
                        <div
                          key={h.day}
                          className={`rounded-xl border p-3 space-y-2 ${!h.open ? "opacity-50 bg-zinc-50" : "bg-white"}`}
                        >
                          <div className="flex items-center gap-3">
                            {/* Toggle */}
                            <button
                              type="button"
                              onClick={() => toggleDay(h.day)}
                              className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${h.open ? "bg-violet-600" : "bg-zinc-200"}`}
                            >
                              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${h.open ? "translate-x-4" : ""}`} />
                            </button>

                            {/* Day label */}
                            <span className={`text-sm font-medium w-24 shrink-0 ${h.open ? "text-zinc-900" : "text-zinc-400"}`}>
                              {DAY_SHORT[h.day]}
                            </span>

                            {/* Time pickers */}
                            {h.open ? (
                              <div className="flex items-center gap-2 flex-1 flex-wrap">
                                <input
                                  type="time"
                                  value={h.openTime}
                                  onChange={e => updateHour(h.day, "openTime", e.target.value)}
                                  className="text-sm border rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-violet-500"
                                />
                                <span className="text-zinc-400 text-xs">–</span>
                                <input
                                  type="time"
                                  value={h.closeTime}
                                  onChange={e => updateHour(h.day, "closeTime", e.target.value)}
                                  className="text-sm border rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-violet-500"
                                />
                              </div>
                            ) : (
                              <span className="text-sm text-zinc-400 flex-1">Closed</span>
                            )}
                          </div>

                          {/* Breaks */}
                          {h.open && h.breaks.map((b, bi) => (
                            <div key={bi} className="flex items-center gap-2 pl-12">
                              <span className="text-xs text-zinc-400 shrink-0">Break</span>
                              <input
                                type="time"
                                value={b.start}
                                onChange={e => updateBreak(h.day, bi, "start", e.target.value)}
                                className="text-xs border rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-violet-500"
                              />
                              <span className="text-zinc-400 text-xs">–</span>
                              <input
                                type="time"
                                value={b.end}
                                onChange={e => updateBreak(h.day, bi, "end", e.target.value)}
                                className="text-xs border rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-violet-500"
                              />
                              <button
                                type="button"
                                onClick={() => removeBreak(h.day, bi)}
                                className="p-1 rounded text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}

                          {h.open && (
                            <button
                              type="button"
                              onClick={() => addBreak(h.day)}
                              className="pl-12 flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700 font-medium"
                            >
                              <Plus className="w-3 h-3" />
                              Add break
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                </div>

                {/* Navigation (steps 1–6) */}
                <div className="flex gap-3 mt-6">
                  {step > 1 && (
                    <Button type="button" variant="outline" size="lg" onClick={() => setStep(s => s - 1)} className="flex-1">
                      <ChevronLeft className="w-4 h-4" />
                      Back
                    </Button>
                  )}
                  <Button type="button" variant="gradient" size="lg" onClick={nextStep} className="flex-1">
                    Continue
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        )}

        {/* ── Step 7: Full-width preview & customize ── */}
        {isFullWidth && (
          <div className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden">

            {/* ── Left: customization sidebar ── */}
            <div className="lg:w-80 xl:w-88 bg-zinc-900 border-r border-zinc-800 flex flex-col overflow-y-auto shrink-0">
              {/* Sidebar header */}
              <div className="px-5 py-4 border-b border-zinc-800">
                <h2 className="text-sm font-semibold text-white">Customize your website</h2>
                <p className="text-xs text-zinc-500 mt-0.5">Changes appear live in the preview</p>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-6">

                {/* ── Template / Style ── */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3">Website Style</p>
                  <div className="grid grid-cols-1 gap-2">
                    {TEMPLATE_PRESETS.map(t => {
                      const colors = TEMPLATE_COLORS[t.slug]
                      const isSelected = selectedTemplate === t.slug
                      return (
                        <button
                          key={t.slug}
                          type="button"
                          onClick={() => setSelectedTemplate(t.slug)}
                          className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                            isSelected ? "border-violet-500 bg-violet-500/10" : "border-zinc-700 hover:border-zinc-600"
                          }`}
                        >
                          <div
                            className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center"
                            style={{ background: colors?.bg ?? "#fff" }}
                          >
                            <div className="w-4 h-4 rounded-full" style={{ background: colors?.primary ?? "#7c3aed" }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-zinc-100">{t.name}</p>
                            <p className="text-[10px] text-zinc-500 truncate">{t.description}</p>
                          </div>
                          {isSelected && (
                            <div className="w-4 h-4 rounded-full bg-violet-600 flex items-center justify-center shrink-0">
                              <Check className="w-2.5 h-2.5 text-white" />
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* ── Hero photo ── */}
                <div className="border-t border-zinc-800 pt-5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3">Hero Photo</p>

                  {heroImage ? (
                    <>
                      <ImageDragEditor
                        src={heroImage}
                        positionX={heroPosX}
                        positionY={heroPosY}
                        zoom={heroZoom}
                        onChange={(x, y, z) => setPreviewOverrides(p => ({ ...p, heroImagePositionX: x, heroImagePositionY: y, heroImageZoom: z }))}
                        aspectRatio={4 / 3}
                      />
                      <p className="text-[10px] text-zinc-600 text-center mt-1.5">
                        Drag to pan · Drag corners to zoom
                      </p>
                      <button
                        type="button"
                        onClick={() => setHeroImage(undefined)}
                        className="mt-2 w-full text-xs text-zinc-500 hover:text-red-400 transition-colors"
                      >
                        Remove photo
                      </button>
                    </>
                  ) : (
                    <>
                      <label
                        className={`flex flex-col items-center justify-center gap-2 w-full py-8 rounded-xl border border-dashed text-xs transition-colors cursor-pointer ${
                          uploading ? "border-violet-500 text-violet-400" : "border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300"
                        }`}
                      >
                        {uploading ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Upload className="w-5 h-5" />
                        )}
                        <span>{uploading ? "Uploading…" : "Upload hero photo"}</span>
                        <span className="text-zinc-600">{uploading ? "" : "or paste URL below"}</span>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f) }}
                        />
                      </label>

                      <input
                        type="url"
                        value={heroImage ?? ""}
                        onChange={e => setHeroImage(e.target.value || undefined)}
                        placeholder="https://example.com/photo.jpg"
                        className="mt-2 w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500"
                      />
                    </>
                  )}

                  {/* Show text toggle */}
                  <div className="mt-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-zinc-300 font-medium">Show headline and introduction</p>
                      <p className="text-[10px] text-zinc-600">Placement follows your website style</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPreviewOverrides(p => ({ ...p, showHeroText: !showText }))}
                      className={`relative w-9 h-5 rounded-full transition-colors ${showText ? "bg-violet-600" : "bg-zinc-700"}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${showText ? "translate-x-4" : ""}`} />
                    </button>
                  </div>

                  {showText && tpl.layout.websiteStyle === 'performance' && (
                    <div className="mt-3 space-y-2">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs text-zinc-400">Overlay darkness</label>
                          <span className="text-[10px] text-zinc-500">{overlayOpacity}%</span>
                        </div>
                        <input
                          type="range" min={0} max={80} step={5}
                          value={overlayOpacity}
                          onChange={e => setPreviewOverrides(p => ({ ...p, heroImageOverlayOpacity: Number(e.target.value) }))}
                          className="w-full accent-violet-500"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Text content ── */}
                <div className="border-t border-zinc-800 pt-5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3">Text Content</p>

                  <div className="space-y-3">
                    <p className="text-[10px] text-zinc-500">Your changes appear in the preview as you type.</p>
                    <div>
                      <label className="text-xs text-zinc-400 block mb-1">Headline</label>
                      <input
                        type="text"
                        value={heroTitle}
                        onChange={e => setPreviewOverrides(p => ({ ...p, heroTitle: e.target.value }))}
                        placeholder={nameValue || "Your business name"}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-400 block mb-1">Subtitle</label>
                      <textarea
                        rows={2}
                        value={heroSubtitle}
                        onChange={e => setPreviewOverrides(p => ({ ...p, heroSubtitle: e.target.value }))}
                        placeholder="Book your appointment online, anytime."
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500 resize-none"
                      />
                    </div>
                  </div>
                </div>

              </div>

              {/* Sidebar footer — navigation */}
              <div className="p-4 border-t border-zinc-800 space-y-2">
                <Button
                  type="button"
                  variant="gradient"
                  size="lg"
                  onClick={handleSubmit(onSubmit)}
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Setting up…
                    </>
                  ) : (
                    <>
                      Launch my website
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
                <button
                  type="button"
                  onClick={() => setStep(6)}
                  className="w-full flex items-center justify-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors py-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Back to working hours
                </button>
              </div>
            </div>

            {/* ── Right: phone preview ── */}
            <div className="flex-1 bg-zinc-100 flex flex-col items-center justify-center p-4 sm:p-8 overflow-y-auto">
              <div className="mb-4 text-center">
                <p className="text-sm font-semibold text-zinc-700">Live Preview</p>
                <p className="text-xs text-zinc-400">Your services, photos and hours. Availability starts after launch.</p>
              </div>

              <PreviewViewport mode="mobile">
                <TenantWebsite
                  config={{ brand: tpl.brand, layout: tpl.layout, content: previewContent as ContentConfig, meta: { language: 'en' } }}
                  business={{
                    ...PREVIEW_BUSINESS_DEFAULTS,
                    name: nameValue || "Your Business",
                    slug: watch("slug") || "preview",
                    category: watch("category") || "general",
                    phone: watch("phone") || null,
                    address: watch("address") || null,
                    description: watch("description") || null,
                  }}
                  services={services.filter(service => service.name.trim()).map((service, index): Service => ({
                    id: String(index), business_id: 'preview', category_id: null, name: service.name,
                    price: Number(service.price) || 0, duration_minutes: Number(service.duration) || 30,
                    image_url: null, description: null, active: true, created_at: '', updated_at: '',
                  }))}
                  staff={[]}
                  workingHours={hours.map((day): WorkingHours => ({
                    id: String(day.day), business_id: 'preview', day_of_week: day.day,
                    is_open: day.open, open_time: day.openTime, close_time: day.closeTime,
                    created_at: '', updated_at: '',
                  }))}
                  previewMode previewSlots={[]}
                />
              </PreviewViewport>

              <p className="mt-4 text-xs text-zinc-400 text-center">
                You can customize everything in the builder after launch
              </p>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
