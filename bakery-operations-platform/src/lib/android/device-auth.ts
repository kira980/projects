import "server-only";
import type { SupabaseClient } from "@/lib/demo-backend/types";
import { createServiceClient } from "@/lib/supabase/server";
import {
  bearerFromRequest,
  generateDeviceToken,
  hashToken,
} from "./token-util";

export { bearerFromRequest, generateDeviceToken, hashToken };

/**
 * Bearer-token auth for the standalone Android receipt-printer app.
 *
 * A device pairs by presenting a worker passcode (the same credential the
 * kiosk/driver apps use). On success it receives a long, opaque token; only
 * the token's SHA-256 hash is stored in `android_devices`. Every subsequent
 * request carries the token in `Authorization: Bearer <token>`, and the
 * server resolves it to exactly one business_id — the client never sends a
 * business id, so cross-tenant access is impossible.
 */

export type AndroidDevice = {
  id: string;
  businessId: string;
  workerId: string | null;
  label: string;
};

/**
 * Resolve a request to its paired device. Returns null when the token is
 * missing, unknown, or revoked. Updates last_seen_at (best-effort).
 */
export async function authenticateDevice(
  request: Request
): Promise<{ device: AndroidDevice; supabase: SupabaseClient } | null> {
  const token = bearerFromRequest(request);
  if (!token) return null;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("android_devices")
    .select("id, business_id, worker_id, label, revoked_at")
    .eq("token_hash", hashToken(token))
    .maybeSingle();

  if (error || !data || data.revoked_at) return null;

  // Best-effort heartbeat; never blocks the request.
  void supabase
    .from("android_devices")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", data.id);

  return {
    device: {
      id: data.id,
      businessId: data.business_id,
      workerId: data.worker_id,
      label: data.label ?? "",
    },
    supabase,
  };
}

/** Uniform JSON error helper for the Android route handlers. */
export function jsonError(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}
