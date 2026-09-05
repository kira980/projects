import bcrypt from "bcryptjs";
import { createServiceClient } from "@/lib/supabase/server";
import {
  generateDeviceToken,
  hashToken,
  jsonError,
} from "@/lib/android/device-auth";

/**
 * POST /api/android/auth/pair
 * Body: { passcode: "1234", label?: "Front counter tablet" }
 *
 * Pairs an Android device using a worker passcode (same credential as the
 * kiosk/driver apps). Returns a long-lived, revocable bearer token plus the
 * business details needed to render receipts. Only the token hash is stored.
 */
export async function POST(request: Request) {
  let body: { passcode?: unknown; label?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "invalid_body", "Malformed JSON body");
  }

  const passcode = String(body.passcode ?? "");
  const label = String(body.label ?? "").slice(0, 80).trim();
  if (!/^\d{4}$/.test(passcode)) {
    return jsonError(400, "invalid_passcode", "Passcode must be 4 digits");
  }

  const supabase = createServiceClient();
  const { data: workers, error } = await supabase
    .from("workers")
    .select("id, business_id, full_name, passcode_hash")
    .eq("is_active", true)
    .not("passcode_hash", "is", null);

  if (error) return jsonError(500, "server_error", "Could not verify passcode");

  let matched: { id: string; business_id: string; full_name: string } | null =
    null;
  for (const w of workers ?? []) {
    if (await bcrypt.compare(passcode, w.passcode_hash!)) {
      matched = { id: w.id, business_id: w.business_id, full_name: w.full_name };
      break;
    }
  }
  if (!matched) {
    return jsonError(401, "wrong_passcode", "Wrong passcode");
  }

  const token = generateDeviceToken();
  const { data: device, error: insErr } = await supabase
    .from("android_devices")
    .insert({
      business_id: matched.business_id,
      worker_id: matched.id,
      label: label || "Android device",
      token_hash: hashToken(token),
    })
    .select("id")
    .single();

  if (insErr || !device) {
    return jsonError(500, "server_error", "Could not register device");
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name, phone, address, logo_url")
    .eq("id", matched.business_id)
    .single();

  return Response.json({
    token,
    device_id: device.id,
    worker: { id: matched.id, name: matched.full_name },
    business: {
      id: business?.id ?? matched.business_id,
      name: business?.name ?? "",
      phone: business?.phone ?? null,
      address: business?.address ?? null,
      logo_url: business?.logo_url ?? null,
    },
  });
}
