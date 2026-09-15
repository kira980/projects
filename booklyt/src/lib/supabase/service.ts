import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { type Database } from "@/types/database"

/**
 * Service-role client — bypasses RLS.
 * Only use server-side after independently verifying the user's identity.
 * Never expose SUPABASE_SERVICE_ROLE_KEY to the browser.
 */
export function createServiceClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
