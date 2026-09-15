/**
 * Marketplace server helpers.
 * All functions use the service-role client so they can be called from any
 * server context (RSC, API route, middleware) without needing a request cookie.
 */
import { createServiceClient } from '@/lib/supabase/service'
import type { Business, Service, ServiceCategory, StaffMember, StaffService, WorkingHours, Appointment } from '@/types/database'
import type { PublishedConfig } from '@/types/builder'

// ─── Public types ─────────────────────────────────────────────────────────────

export interface MarketplaceBusiness {
  id: string
  slug: string
  name: string
  displayName: string
  category: string
  address: string | null
  phone: string | null
  logoUrl: string | null
  coverUrl: string | null
  primaryColor: string
  backgroundColor: string
  minPrice: number | null
  isPublished: boolean
  publishedConfig: PublishedConfig | null
  businessCode: string | null
  appEnabled: boolean
}

export interface MarketplaceBusinessFull extends MarketplaceBusiness {
  services: Service[]
  categories: ServiceCategory[]
  staff: StaffMember[]
  staffServices: StaffService[]
  workingHours: WorkingHours[]
  business: Business
}

export interface MarketplaceSearchFilters {
  category?: string
  minPrice?: number
  maxPrice?: number
  date?: string
  timeAfter?: string
  sort?: 'name' | 'price_asc' | 'price_desc'
}

export interface MarketplaceSearchResult extends MarketplaceBusiness {
  matchedService: { name: string; price: number; durationMinutes: number } | null
}

export interface MarketplaceStats {
  businessCount: number
  serviceCount: number
  bookingCount: number
}

export interface CustomerAppointment {
  id: string
  appointmentDate: string
  startTime: string
  endTime: string
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed'
  customerName: string
  manageToken: string | null
  service: { name: string; price: number } | null
  business: {
    name: string
    slug: string
    logoUrl: string | null
    primaryColor: string
    address: string | null
    phone: string | null
  } | null
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toMarketplaceBusiness(biz: any, config: any, minPrice: number | null): MarketplaceBusiness {
  const pub: PublishedConfig | null = config?.published_config_json ?? null
  const branding = pub?.meta?.branding
  const brand = pub?.brand
  const heroImage = pub?.content?.heroImage ?? null
  const galleryImages = pub?.content?.galleryImages ?? []

  return {
    id: biz.id,
    slug: biz.slug,
    name: biz.name,
    displayName: branding?.businessName?.trim() || biz.app_name?.trim() || biz.name,
    category: biz.category ?? 'general',
    address: biz.address,
    phone: biz.phone,
    logoUrl: branding?.logoUrl || biz.logo_url || null,
    coverUrl: heroImage || galleryImages[0] || biz.logo_url || null,
    primaryColor: brand?.primaryColor ?? '#7c3aed',
    backgroundColor: brand?.backgroundColor ?? '#ffffff',
    minPrice,
    isPublished: config?.is_published ?? false,
    publishedConfig: pub,
    businessCode: biz.business_code ?? null,
    appEnabled: biz.app_enabled !== false,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns businesses that have a published builder config, sorted by name. */
export async function getPublishedBusinesses(limit = 20): Promise<MarketplaceBusiness[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any

  const { data: configs } = await db
    .from('tenant_experience_configs')
    .select('business_id, published_config_json, is_published')
    .eq('is_published', true)
    .limit(limit)

  if (!configs?.length) return []

  const businessIds: string[] = configs.map((c: { business_id: string }) => c.business_id)

  const [{ data: businesses }, { data: services }] = await Promise.all([
    db.from('businesses').select('*').in('id', businessIds).order('name'),
    db.from('services').select('business_id, price').in('business_id', businessIds).eq('active', true),
  ])

  if (!businesses?.length) return []

  const configMap = new Map(configs.map((c: { business_id: string }) => [c.business_id, c]))
  const priceMap = new Map<string, number>()
  for (const s of services ?? []) {
    const cur = priceMap.get(s.business_id)
    if (cur === undefined || s.price < cur) priceMap.set(s.business_id, s.price)
  }

  return businesses.map((biz: Business) =>
    toMarketplaceBusiness(biz, configMap.get(biz.id), priceMap.get(biz.id) ?? null)
  )
}

/** Full business data for a single slug including services, staff, hours. */
export async function getBusinessBySlug(slug: string): Promise<MarketplaceBusinessFull | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any

  const { data: biz } = await db
    .from('businesses')
    .select('*')
    .eq('slug', slug)
    .maybeSingle() as { data: Business | null }

  if (!biz || biz.active === false) return null

  const [
    { data: config },
    { data: servicesRaw },
    { data: categoriesRaw },
    { data: staffRaw },
    { data: hoursRaw },
  ] = await Promise.all([
    db.from('tenant_experience_configs')
      .select('published_config_json, is_published')
      .eq('business_id', biz.id)
      .eq('is_published', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    db.from('services').select('*').eq('business_id', biz.id).eq('active', true).order('name'),
    db.from('service_categories').select('*').eq('business_id', biz.id).order('sort_order').order('name'),
    db.from('staff_members').select('*').eq('business_id', biz.id).eq('active', true).order('name'),
    db.from('working_hours').select('*').eq('business_id', biz.id).order('day_of_week'),
  ])

  const services = (servicesRaw ?? []) as Service[]
  const staff = (staffRaw ?? []) as StaffMember[]

  // staff_services carries no business_id, so it is fetched by staff id.
  const { data: staffServicesRaw } = staff.length
    ? await db.from('staff_services').select('*').in('staff_member_id', staff.map(m => m.id))
    : { data: [] }
  const minPrice = services.reduce((min: number | null, s: Service) =>
    min === null || s.price < min ? s.price : min, null)

  return {
    ...toMarketplaceBusiness(biz, config, minPrice),
    services,
    categories: (categoriesRaw ?? []) as ServiceCategory[],
    staff,
    staffServices: (staffServicesRaw ?? []) as StaffService[],
    workingHours: (hoursRaw ?? []) as WorkingHours[],
    business: biz,
  }
}

/** Search businesses and services. */
export async function searchMarketplace(
  query: string,
  filters: MarketplaceSearchFilters = {}
): Promise<MarketplaceSearchResult[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any

  const q = query.trim().toLowerCase()

  // Fetch businesses matching name/category
  let bizQuery = db
    .from('businesses')
    .select('*')
    .order('name')
    .limit(40)

  if (q) {
    bizQuery = bizQuery.or(`name.ilike.%${q}%,category.ilike.%${q}%,description.ilike.%${q}%,slug.ilike.%${q}%`)
  }
  if (filters.category) {
    bizQuery = bizQuery.ilike('category', `%${filters.category}%`)
  }

  const { data: businesses } = await bizQuery

  if (!businesses?.length) return []

  const businessIds: string[] = businesses.map((b: Business) => b.id)

  // Fetch services matching query
  let serviceQuery = db
    .from('services')
    .select('*')
    .in('business_id', businessIds)
    .eq('active', true)

  if (q) {
    serviceQuery = serviceQuery.ilike('name', `%${q}%`)
  }
  if (filters.minPrice !== undefined) {
    serviceQuery = serviceQuery.gte('price', filters.minPrice)
  }
  if (filters.maxPrice !== undefined) {
    serviceQuery = serviceQuery.lte('price', filters.maxPrice)
  }

  const [{ data: services }, { data: configs }] = await Promise.all([
    serviceQuery,
    db.from('tenant_experience_configs')
      .select('business_id, published_config_json, is_published')
      .in('business_id', businessIds)
      .eq('is_published', true),
  ])

  const configMap = new Map(
    (configs ?? []).map((c: { business_id: string }) => [c.business_id, c])
  )

  // Build min price + first matched service per business
  const priceMap = new Map<string, number>()
  const matchedServiceMap = new Map<string, Service>()

  for (const s of services ?? []) {
    const cur = priceMap.get(s.business_id)
    if (cur === undefined || s.price < cur) priceMap.set(s.business_id, s.price)

    if (q && s.name.toLowerCase().includes(q)) {
      if (!matchedServiceMap.has(s.business_id)) matchedServiceMap.set(s.business_id, s)
    }
  }

  let results = businesses.map((biz: Business) => ({
    ...toMarketplaceBusiness(biz, configMap.get(biz.id) ?? null, priceMap.get(biz.id) ?? null),
    matchedService: matchedServiceMap.has(biz.id)
      ? {
          name: matchedServiceMap.get(biz.id)!.name,
          price: matchedServiceMap.get(biz.id)!.price,
          durationMinutes: matchedServiceMap.get(biz.id)!.duration_minutes,
        }
      : null,
  })) as MarketplaceSearchResult[]

  // Sort
  if (filters.sort === 'price_asc') {
    results = results.sort((a, b) => (a.minPrice ?? 9999) - (b.minPrice ?? 9999))
  } else if (filters.sort === 'price_desc') {
    results = results.sort((a, b) => (b.minPrice ?? 0) - (a.minPrice ?? 0))
  }

  return results
}

/** Platform-wide aggregate stats. */
export async function getMarketplaceStats(): Promise<MarketplaceStats> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any

  const [
    { count: businessCount },
    { count: serviceCount },
    { count: bookingCount },
  ] = await Promise.all([
    db.from('businesses').select('*', { count: 'exact', head: true }),
    db.from('services').select('*', { count: 'exact', head: true }).eq('active', true),
    db.from('appointments').select('*', { count: 'exact', head: true }).neq('status', 'cancelled'),
  ])

  return {
    businessCount: businessCount ?? 0,
    serviceCount: serviceCount ?? 0,
    bookingCount: bookingCount ?? 0,
  }
}

/** Popular service categories with business counts. */
export async function getPopularCategories(): Promise<{ category: string; count: number }[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any

  const { data: businesses } = await db
    .from('businesses')
    .select('category')

  if (!businesses?.length) return []

  const counts = new Map<string, number>()
  for (const biz of businesses) {
    const cat = (biz.category ?? 'general').toLowerCase()
    counts.set(cat, (counts.get(cat) ?? 0) + 1)
  }

  return Array.from(counts.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
}

type AppointmentSlice = Pick<Appointment, 'id' | 'appointment_date' | 'start_time' | 'end_time' | 'status' | 'customer_name' | 'manage_token' | 'service_id' | 'business_id'>

/** Look up appointments by customer phone or email. */
export async function getCustomerBookings(
  phone?: string,
  email?: string
): Promise<CustomerAppointment[]> {
  if (!phone && !email) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any

  let query = db
    .from('appointments')
    .select('id, appointment_date, start_time, end_time, status, customer_name, manage_token, service_id, business_id')
    .order('appointment_date', { ascending: false })
    .limit(50)

  if (phone && email) {
    query = query.or(`customer_phone.eq.${phone},customer_email.eq.${email}`)
  } else if (phone) {
    query = query.eq('customer_phone', phone)
  } else if (email) {
    query = query.eq('customer_email', email)
  }

  const { data: appointments } = await query as { data: AppointmentSlice[] | null }
  return shapeCustomerAppointments(db, appointments ?? [])
}

/** All appointments for an authenticated customer, across every business. */
export async function getCustomerBookingsByUserId(customerUserId: string): Promise<CustomerAppointment[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any

  const { data: appointments } = await db
    .from('appointments')
    .select('id, appointment_date, start_time, end_time, status, customer_name, manage_token, service_id, business_id')
    .eq('customer_user_id', customerUserId)
    .order('appointment_date', { ascending: false })
    .limit(100) as { data: AppointmentSlice[] | null }

  return shapeCustomerAppointments(db, appointments ?? [])
}

async function shapeCustomerAppointments(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  appointments: AppointmentSlice[]
): Promise<CustomerAppointment[]> {
  if (!appointments.length) return []

  const businessIds = [...new Set(appointments.map(a => a.business_id))]
  const serviceIds = [...new Set(appointments.map(a => a.service_id))]

  const [{ data: businesses }, { data: services }, { data: configs }] = await Promise.all([
    db.from('businesses').select('id, name, slug, logo_url, address, phone').in('id', businessIds),
    db.from('services').select('id, name, price').in('id', serviceIds),
    db.from('tenant_experience_configs')
      .select('business_id, published_config_json')
      .in('business_id', businessIds)
      .eq('is_published', true),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bizMap = new Map<string, any>((businesses ?? []).map((b: any) => [b.id, b]))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svcMap = new Map<string, any>((services ?? []).map((s: any) => [s.id, s]))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const configMap = new Map<string, any>((configs ?? []).map((c: any) => [c.business_id, c]))

  return appointments.map(appt => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const biz: any = bizMap.get(appt.business_id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svc: any = svcMap.get(appt.service_id)
    const pub: PublishedConfig | null = configMap.get(appt.business_id)?.published_config_json ?? null

    return {
      id: appt.id,
      appointmentDate: appt.appointment_date,
      startTime: appt.start_time,
      endTime: appt.end_time,
      status: appt.status,
      customerName: appt.customer_name,
      manageToken: appt.manage_token,
      service: svc ? { name: svc.name, price: svc.price } : null,
      business: biz ? {
        name: biz.name,
        slug: biz.slug,
        logoUrl: pub?.meta?.branding?.logoUrl || biz.logo_url || null,
        primaryColor: pub?.brand?.primaryColor ?? '#7c3aed',
        address: biz.address ?? null,
        phone: biz.phone ?? null,
      } : null,
    }
  })
}

/** Re-export slot logic for use in the booking page. */
export { generateTimeSlots } from '@/lib/booking/slots'
export type { TimeSlot } from '@/lib/booking/slots'
