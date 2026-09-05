import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  business_id: string;
  full_name: string;
  role: "admin" | "manager";
  is_active: boolean;
};

export type Business = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  logo_url: string | null;
  settings: Record<string, unknown>;
};

/**
 * Fetches the profile with its business embedded in a single query,
 * so requireAdmin + getCurrentBusiness cost one DB round trip per
 * request instead of two. RLS still applies to both tables.
 */
const getProfileWithBusiness = cache(
  async (): Promise<{ profile: Profile; business: Business | null }> => {
    const supabase = await createClient();
    // getClaims() verifies the session JWT locally against the project's
    // asymmetric (ES256) signing keys — the JWKS is fetched once and cached,
    // so this costs no network round trip per request. The middleware still
    // calls getUser() as the authoritative gate + session refresh on every
    // dashboard request, and RLS enforces access on the profile query below.
    const { data: claimsData } = await supabase.auth.getClaims();
    const userId = claimsData?.claims.sub;
    if (!userId) redirect("/login");

    const { data: profile } = await supabase
      .from("profiles")
      .select(
        "id, business_id, full_name, role, is_active, businesses (id, name, phone, address, logo_url, settings)"
      )
      .eq("id", userId)
      .single();

    if (!profile || !profile.is_active) {
      await supabase.auth.signOut();
      redirect("/login");
    }
    // PostgREST returns a to-one embed as an object at runtime, but the
    // untyped client infers an array — normalize both shapes.
    const { businesses, ...rest } = profile as unknown as Profile & {
      businesses: Business | Business[] | null;
    };
    const business = Array.isArray(businesses)
      ? (businesses[0] ?? null)
      : (businesses ?? null);
    return { profile: rest as Profile, business };
  }
);

/**
 * Returns the authenticated admin/manager profile, or redirects to /login.
 * Deactivated profiles are treated as unauthenticated.
 */
export const requireAdmin = cache(async (): Promise<Profile> => {
  const { profile } = await getProfileWithBusiness();
  return profile;
});

/** Returns the business of the current admin user. */
export const getCurrentBusiness = cache(async (): Promise<Business> => {
  const { business } = await getProfileWithBusiness();
  if (!business) {
    throw new Error("העסק לא נמצא");
  }
  return business;
});
