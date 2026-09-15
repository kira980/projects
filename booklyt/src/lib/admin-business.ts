import { cookies } from "next/headers"
import { getAdminCookieName, verifyAdminSession } from "@/lib/admin-session"
import { createServiceClient } from "@/lib/supabase/service"

export type AdminVerifiedBusiness = {
  id: string
  name: string
  slug: string
  app_icon_url: string | null
  logo_url: string | null
  language: "en" | "ar"
  time_format: string
  country_code: string | null
}

export async function getAdminVerifiedBusiness(businessSlug: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceClient() as any
  const { data: business } = await supabase
    .from("businesses")
    .select("id, name, slug, app_icon_url, logo_url, language, time_format, country_code")
    .eq("slug", businessSlug)
    .maybeSingle() as { data: AdminVerifiedBusiness | null }

  if (!business) return { business: null, supabase }

  const cookieStore = await cookies()
  const ok = verifyAdminSession(cookieStore.get(getAdminCookieName(business.id))?.value, business.id)

  return { business: ok ? business : null, supabase }
}
