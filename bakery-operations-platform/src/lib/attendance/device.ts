import "server-only";
import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";
import { generateDeviceToken, hashToken } from "@/lib/android/token-util";

export { generateDeviceToken, hashToken };

/**
 * The worker's phone identifies itself with an opaque token held in a
 * long-lived httpOnly cookie — the same shape as the Android app's bearer
 * token (migration 0022), just carried by the browser instead.
 *
 * There is no password and no daily login: the registered device IS the
 * credential, which is the whole point of the enrollment flow. Only the
 * token's hash is stored, so a database leak cannot clock anybody in.
 */

export const DEVICE_COOKIE = "attendance_device";
/** A year — the phone stays paired until the owner replaces or revokes it. */
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

export type AttendanceDevice = {
  deviceId: string;
  businessId: string;
  workerId: string;
  workerName: string;
  /** False when the owner has since deactivated the worker. */
  workerActive: boolean;
};

export async function setDeviceCookie(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(DEVICE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

export async function clearDeviceCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(DEVICE_COOKIE);
}

/**
 * Resolve the phone making this request to its worker, or null when the
 * cookie is missing, unknown or revoked.
 *
 * A revoked device resolves to null rather than an error, so replacing a
 * phone simply logs the old one out.
 */
export async function currentDevice(): Promise<AttendanceDevice | null> {
  const jar = await cookies();
  const token = jar.get(DEVICE_COOKIE)?.value;
  if (!token) return null;

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("worker_devices")
    .select("id, business_id, worker_id, revoked_at, workers (full_name, is_active)")
    .eq("token_hash", hashToken(token))
    .is("revoked_at", null)
    .maybeSingle();

  if (!data) return null;
  const worker = data.workers as unknown as {
    full_name: string;
    is_active: boolean;
  } | null;
  if (!worker) return null;

  return {
    deviceId: data.id,
    businessId: data.business_id,
    workerId: data.worker_id,
    workerName: worker.full_name,
    workerActive: worker.is_active,
  };
}

/** Best-effort "this phone was here" stamp; never blocks the caller. */
export async function touchDevice(deviceId: string): Promise<void> {
  const supabase = createServiceClient();
  await supabase
    .from("worker_devices")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", deviceId);
}
