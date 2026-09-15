import { notFound } from "next/navigation"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

import { WebsiteShell } from "@/components/layouts/WebsiteShell"
import { getRenderMode, getBrandingFromConfig } from "@/lib/render-mode"
import { getCustomerManageCookieName, getCustomerSessionCookieName, hashCustomerSessionToken } from "@/lib/customer-session"
import { CUSTOMER_AUTH_COOKIE, getUserFromToken } from "@/lib/customer-auth"
import type { Business, Service, ServiceCategory, StaffMember, StaffService, WorkingHours } from "@/types/database"
import type { PublishedConfig } from "@/types/builder"

// Always fetch fresh so the public page reflects newly published changes.
export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ businessSlug: string }>
  searchParams?: Promise<{ mode?: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const { businessSlug } = await params
  const supabase = await createClient()
  const { data: business } = await supabase
    .from("businesses")
    .select("name, slug, description, app_name, app_icon_url, logo_url")
    .eq("slug", businessSlug)
    .single() as {
      data: Pick<Business, "name" | "slug" | "description" | "app_name" | "app_icon_url" | "logo_url"> | null
      error: unknown
    }

  if (!business) return { title: "Not Found" }

  const appName = business.app_name?.trim() || business.name
  const iconUrl = business.app_icon_url || business.logo_url || undefined

  return {
    title: `Book at ${business.name}`,
    applicationName: appName,
    description: business.description ?? `Book an appointment at ${business.name}`,
    manifest: `/book/${business.slug}/manifest`,
    appleWebApp: {
      capable: true,
      title: appName,
      statusBarStyle: "default",
    },
    icons: iconUrl
      ? {
          icon: [{ url: iconUrl, sizes: "512x512" }],
          apple: [{ url: iconUrl, sizes: "512x512" }],
        }
      : undefined,
  }
}

export default async function BookingPage({ params, searchParams }: PageProps) {
  const { businessSlug } = await params
  const { mode } = (await searchParams) ?? {}
  const renderMode = getRenderMode(mode)

  const supabase = await createClient()

  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("slug", businessSlug)
    .single() as { data: Business | null; error: unknown }

  if (!business || business.active === false) notFound()

  const [{ data: servicesRaw }, { data: staffRaw }, { data: hoursRaw }, { data: configRaw }] =
    await Promise.all([
      supabase
        .from("services")
        .select("*")
        .eq("business_id", business.id)
        .eq("active", true)
        .order("name"),

      supabase
        .from("staff_members")
        .select("*")
        .eq("business_id", business.id)
        .eq("active", true)
        .order("name"),

      supabase
        .from("working_hours")
        .select("*")
        .eq("business_id", business.id)
        .order("day_of_week"),

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from("tenant_experience_configs")
        .select("published_config_json")
        .eq("business_id", business.id)
        .eq("is_published", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle() as Promise<{ data: { published_config_json: unknown } | null; error: unknown }>,
    ])

  const services = (servicesRaw ?? []) as Service[]
  const staff = (staffRaw ?? []) as StaffMember[]

  // Categories group the service list; staff_services says who performs what.
  // Both are fetched here because staff_services carries no business_id.
  const [{ data: categoriesRaw }, { data: staffServicesRaw }] = await Promise.all([
    supabase.from('service_categories').select('*').eq('business_id', business.id).order('sort_order').order('name'),
    staff.length
      ? supabase.from('staff_services').select('*').in('staff_member_id', staff.map(m => m.id))
      : Promise.resolve({ data: [] }),
  ])
  const categories = (categoriesRaw ?? []) as ServiceCategory[]
  const staffServices = (staffServicesRaw ?? []) as StaffService[]
  const workingHours = (hoursRaw ?? []) as WorkingHours[]
  const publishedConfig = (configRaw?.published_config_json ?? null) as PublishedConfig | null

  // branding: builder config is source of truth; fall back to businesses table
  const { appName, logoUrl, appIconUrl } = getBrandingFromConfig(publishedConfig, business)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const serviceSupabase = createServiceClient() as any
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const currentTime = now.toTimeString().slice(0, 8)
  await serviceSupabase
    .from("appointments")
    .update({ status: "completed", updated_at: now.toISOString() })
    .eq("business_id", business.id)
    .in("status", ["pending", "booked", "confirmed"])
    .or(`appointment_date.lt.${today},and(appointment_date.eq.${today},end_time.lte.${currentTime})`)

  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(getCustomerSessionCookieName(business.id))?.value
  const manageToken = cookieStore.get(getCustomerManageCookieName(business.id))?.value
  const authToken = cookieStore.get(CUSTOMER_AUTH_COOKIE)?.value
  const currentCustomerUser = authToken ? await getUserFromToken(authToken) : null
  const authUrl = `/book/${businessSlug}/auth`
  type ExistingApptRow = { manage_token: string | null; appointment_date: string; start_time: string }
  let initialExistingBookings: { manage_url: string; appointment_date: string; start_time: string }[] = []

  if (sessionToken) {
    const tokenHash = hashCustomerSessionToken(sessionToken)
    const nowIso = new Date().toISOString()
    const { data: session } = await serviceSupabase
      .from("customer_sessions")
      .select("id, customer_id")
      .eq("business_id", business.id)
      .eq("token_hash", tokenHash)
      .gt("expires_at", nowIso)
      .maybeSingle() as { data: { id: string; customer_id: string } | null }

    if (session) {
      await serviceSupabase
        .from("customer_sessions")
        .update({ last_seen_at: nowIso })
        .eq("id", session.id)

      const { data: appointments } = await serviceSupabase
        .from("appointments")
        .select("manage_token, appointment_date, start_time")
        .eq("business_id", business.id)
        .eq("customer_id", session.customer_id)
        .gte("appointment_date", today)
        .not("status", "in", "(cancelled,completed)")
        .order("appointment_date", { ascending: true })
        .order("start_time", { ascending: true })
        .limit(5) as { data: ExistingApptRow[] | null }

      initialExistingBookings = (appointments ?? [])
        .filter(a => a.manage_token)
        .map(a => ({
          manage_url: `/manage-booking/${a.manage_token}`,
          appointment_date: a.appointment_date,
          start_time: a.start_time,
        }))
    }
  }

  if (initialExistingBookings.length === 0 && manageToken) {
    // Look up the customer_id from the manage_token, then fetch all their upcoming appointments
    const { data: anchor } = await serviceSupabase
      .from("appointments")
      .select("customer_id")
      .eq("business_id", business.id)
      .eq("manage_token", manageToken)
      .maybeSingle() as { data: { customer_id: string | null } | null }

    if (anchor?.customer_id) {
      const { data: appointments } = await serviceSupabase
        .from("appointments")
        .select("manage_token, appointment_date, start_time")
        .eq("business_id", business.id)
        .eq("customer_id", anchor.customer_id)
        .gte("appointment_date", today)
        .not("status", "in", "(cancelled,completed)")
        .order("appointment_date", { ascending: true })
        .order("start_time", { ascending: true })
        .limit(5) as { data: ExistingApptRow[] | null }
      initialExistingBookings = (appointments ?? [])
        .filter(a => a.manage_token)
        .map(a => ({ manage_url: `/manage-booking/${a.manage_token}`, appointment_date: a.appointment_date, start_time: a.start_time }))
    }
  }

  return (
    <>
      <WebsiteShell
        publishedConfig={publishedConfig}
        business={business}
      services={services}
      categories={categories}
      staff={staff}
      staffServices={staffServices}
      workingHours={workingHours}
      appName={appName}
      logoUrl={logoUrl}
      appIconUrl={appIconUrl}
      initialExistingBookings={initialExistingBookings}
      renderMode={renderMode}
      currentCustomerUser={currentCustomerUser}
      authUrl={authUrl}
    />
    </>
  )
}
