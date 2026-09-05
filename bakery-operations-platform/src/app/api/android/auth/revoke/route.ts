import { authenticateDevice, jsonError } from "@/lib/android/device-auth";

/**
 * POST /api/android/auth/revoke
 * Revokes the calling device's own token (e.g. on sign-out / device loss).
 */
export async function POST(request: Request) {
  const auth = await authenticateDevice(request);
  if (!auth) return jsonError(401, "unauthorized", "Invalid or revoked token");

  await auth.supabase
    .from("android_devices")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", auth.device.id);

  return Response.json({ ok: true });
}
