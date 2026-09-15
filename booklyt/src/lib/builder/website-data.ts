import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Business, Service, ServiceCategory, StaffMember, StaffService, WorkingHours } from '@/types/database'
import type { BuilderWebsiteData } from '@/types/builder'

// Only website/booking fields cross into the browser. Never return admin credentials.
const BUSINESS_FIELDS = 'id,name,slug,category,description,phone,address,logo_url,app_name,app_icon_url,language,currency,time_format,timezone,booking_mode,group_capacity,slot_interval,booking_days_ahead,booking_verification_method,appointments_require_confirmation,customer_confirmation_enabled,active,app_enabled,business_code'

// Category features are optional on databases that predate their migration.
// Permission and network failures must still surface instead of hiding data.
function isMissingOptionalTable(error: { code: string; message: string } | null, table: string): boolean {
  return !!error && ['PGRST205', '42P01'].includes(error.code) && error.message.includes(table)
}

export async function getBuilderWebsiteData(client: SupabaseClient<Database>, businessId: string): Promise<BuilderWebsiteData> {
  const [business, services, categories, staff, hours] = await Promise.all([
    client.from('businesses').select(BUSINESS_FIELDS).eq('id', businessId).single(),
    client.from('services').select('*').eq('business_id', businessId).eq('active', true).order('name'),
    client.from('service_categories').select('*').eq('business_id', businessId).order('sort_order').order('name'),
    client.from('staff_members').select('*').eq('business_id', businessId).eq('active', true).order('name'),
    client.from('working_hours').select('*').eq('business_id', businessId).order('day_of_week'),
  ])
  for (const result of [business, services, staff, hours]) {
    if (result.error) throw new Error('Could not load your website data. Please try again.')
  }
  if (categories.error && !isMissingOptionalTable(categories.error, 'service_categories')) {
    throw new Error('Could not load your website data. Please try again.')
  }
  if (!business.data) throw new Error('Business not found')

  // staff_services carries no business_id, so it is scoped by this business's
  // staff ids rather than fetched wholesale.
  const staffIds = (staff.data ?? []).map(member => member.id)
  const staffServices = staffIds.length
    ? await client.from('staff_services').select('*').in('staff_member_id', staffIds)
    : { data: [] as StaffService[], error: null }
  if (staffServices.error && !isMissingOptionalTable(staffServices.error, 'staff_services')) {
    throw new Error('Could not load your website data. Please try again.')
  }
  return {
    business: business.data as Business,
    services: (services.data ?? []) as Service[],
    categories: (categories.data ?? []) as ServiceCategory[],
    staff: (staff.data ?? []) as StaffMember[],
    staffServices: (staffServices.data ?? []) as StaffService[],
    workingHours: (hours.data ?? []) as WorkingHours[],
  }
}
