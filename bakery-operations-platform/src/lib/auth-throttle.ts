import "server-only";
import { headers } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";
import type { WorkerScope } from "@/lib/kiosk/session";

/**
 * Per-IP brute-force throttle for passcode logins. Backed by auth_throttle
 * (service-role only). After MAX_FAILURES within a window the IP is locked
 * for LOCK_MINUTES. A successful login clears the counter.
 *
 * Fails open: if the throttle store itself errors we do NOT block logins
 * (availability over a best-effort guard), but every real failed attempt
 * still counts once the store is reachable.
 */
const MAX_FAILURES = 8;
const LOCK_MINUTES = 15;

async function clientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return h.get("x-real-ip")?.trim() || "unknown";
}

/** Returns an error message if this IP is currently locked, else null. */
export async function checkLoginAllowed(
  scope: WorkerScope
): Promise<string | null> {
  try {
    const ip = await clientIp();
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("auth_throttle")
      .select("locked_until")
      .eq("ip", ip)
      .eq("scope", scope)
      .maybeSingle();
    if (data?.locked_until && new Date(data.locked_until) > new Date()) {
      return "יותר מדי ניסיונות. נסו שוב בעוד מספר דקות.";
    }
    return null;
  } catch {
    return null;
  }
}

/** Records a failed attempt; locks the IP once the threshold is passed. */
export async function recordLoginFailure(scope: WorkerScope): Promise<void> {
  try {
    const ip = await clientIp();
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("auth_throttle")
      .select("failed_count")
      .eq("ip", ip)
      .eq("scope", scope)
      .maybeSingle();
    const next = (data?.failed_count ?? 0) + 1;
    const lockedUntil =
      next >= MAX_FAILURES
        ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString()
        : null;
    await supabase.from("auth_throttle").upsert(
      {
        ip,
        scope,
        failed_count: next,
        locked_until: lockedUntil,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "ip,scope" }
    );
  } catch {
    /* best-effort — never block the login flow on a throttle write error */
  }
}

/** Clears the counter after a successful login. */
export async function recordLoginSuccess(scope: WorkerScope): Promise<void> {
  try {
    const ip = await clientIp();
    const supabase = createServiceClient();
    await supabase
      .from("auth_throttle")
      .delete()
      .eq("ip", ip)
      .eq("scope", scope);
  } catch {
    /* ignore */
  }
}
