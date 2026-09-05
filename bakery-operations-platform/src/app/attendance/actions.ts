"use server";

import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { createAuditLog } from "@/lib/db/audit";
import { hashToken, generateDeviceToken } from "@/lib/android/token-util";
import {
  currentDevice,
  setDeviceCookie,
  touchDevice,
} from "@/lib/attendance/device";
import {
  clientIp,
  distanceMeters,
  isAllowedIp,
  isValidCoords,
} from "@/lib/attendance/geo";
import { headers } from "next/headers";

export type AttendanceResult = { ok: boolean; error?: string; info?: string };

/**
 * Registers the phone that opened a one-time enrollment link.
 *
 * The token is single-use and short-lived, and it names the worker — the
 * phone supplies nothing about who it is, so a link cannot be redirected
 * to a different worker. A worker's previous phone is revoked here, which
 * is what makes "replace device" work: the old handset simply stops
 * resolving.
 */
export async function registerDevice(token: string): Promise<AttendanceResult> {
  const supabase = createServiceClient();

  const { data: session } = await supabase
    .from("device_enrollments")
    .select("id, business_id, worker_id, expires_at, used_at, cancelled_at")
    .eq("token_hash", hashToken(token))
    .maybeSingle();

  if (!session) return { ok: false, error: "הקישור אינו תקין" };
  if (session.used_at) return { ok: false, error: "הקישור כבר נוצל" };
  if (session.cancelled_at) return { ok: false, error: "הקישור בוטל" };
  if (Date.parse(session.expires_at) < Date.now()) {
    return { ok: false, error: "תוקף הקישור פג" };
  }

  const { data: worker } = await supabase
    .from("workers")
    .select("id, full_name, is_active")
    .eq("id", session.worker_id)
    .maybeSingle();
  if (!worker || !worker.is_active) {
    return { ok: false, error: "העובד אינו פעיל" };
  }

  // One live phone per worker (enforced by a partial unique index too).
  await supabase
    .from("worker_devices")
    .update({ revoked_at: new Date().toISOString() })
    .eq("worker_id", session.worker_id)
    .is("revoked_at", null);

  const deviceToken = generateDeviceToken();
  const { data: device, error } = await supabase
    .from("worker_devices")
    .insert({
      business_id: session.business_id,
      worker_id: session.worker_id,
      token_hash: hashToken(deviceToken),
      label: "טלפון עובד",
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: "חיבור הטלפון נכשל" };

  // Burn the session: the QR and the WhatsApp link both die here.
  await supabase
    .from("device_enrollments")
    .update({ used_at: new Date().toISOString(), device_id: device.id })
    .eq("id", session.id);

  await setDeviceCookie(deviceToken);

  await createAuditLog(supabase, {
    businessId: session.business_id,
    actor: { type: "worker", id: worker.id, name: worker.full_name },
    action: "device.register",
    entityType: "worker_device",
    entityId: device.id,
    affectedWorkerId: worker.id,
    details: { worker_name: worker.full_name },
  });

  return { ok: true, info: `הטלפון חובר. שלום ${worker.full_name}` };
}

/**
 * Clock in or out from the phone.
 *
 * Every check is made here, never on the handset: the device token names
 * the worker, the worker must still be active, the reported fix must fall
 * inside the site's radius, and the request must arrive over one of the
 * site's networks. The coordinates the phone sends are recorded but are
 * only ever used to accept or refuse — they never decide WHO is clocking.
 */
export async function clockAction(
  direction: "in" | "out",
  coords: { lat: number; lng: number; accuracy?: number } | null
): Promise<AttendanceResult> {
  const device = await currentDevice();
  if (!device) {
    return { ok: false, error: "הטלפון הזה אינו מחובר. פנו לבעל העסק." };
  }
  if (!device.workerActive) {
    return { ok: false, error: "החשבון שלך אינו פעיל. פנו לבעל העסק." };
  }

  const supabase = createServiceClient();
  const { data: settings } = await supabase
    .from("attendance_settings")
    .select("latitude, longitude, radius_m, allowed_ips, is_active")
    .eq("business_id", device.businessId)
    .maybeSingle();

  if (!settings?.is_active) {
    return { ok: false, error: "מערכת הנוכחות עדיין לא הופעלה. פנו לבעל העסק." };
  }

  if (!isAllowedIp(clientIp(await headers()), settings.allowed_ips)) {
    return { ok: false, error: "יש להתחבר לרשת ה־Wi-Fi של מקום העבודה ולנסות שוב." };
  }

  if (!coords || !isValidCoords(coords.lat, coords.lng)) {
    return { ok: false, error: "לא הצלחנו לקבל את המיקום. אשרו הרשאת מיקום ונסו שוב." };
  }
  if (settings.latitude === null || settings.longitude === null) {
    return { ok: false, error: "מיקום מקום העבודה לא הוגדר. פנו לבעל העסק." };
  }
  const away = distanceMeters(
    coords.lat,
    coords.lng,
    settings.latitude,
    settings.longitude
  );
  if (away > settings.radius_m) {
    return { ok: false, error: "אתם מחוץ לאזור המותר להחתמה." };
  }

  const { data: openShift } = await supabase
    .from("worker_shifts")
    .select("id, started_at")
    .eq("worker_id", device.workerId)
    .is("ended_at", null)
    .maybeSingle();

  const now = new Date().toISOString();
  await touchDevice(device.deviceId);

  if (direction === "in") {
    if (openShift) return { ok: false, error: "כבר יש לך משמרת פתוחה" };
    const { data: shift, error } = await supabase
      .from("worker_shifts")
      .insert({
        business_id: device.businessId,
        worker_id: device.workerId,
        started_at: now,
        started_by_type: "worker",
        started_by_id: device.workerId,
        started_via: "phone",
        started_lat: coords.lat,
        started_lng: coords.lng,
        started_device_id: device.deviceId,
      })
      .select("id")
      .single();
    if (error) return { ok: false, error: "פתיחת המשמרת נכשלה" };

    await createAuditLog(supabase, {
      businessId: device.businessId,
      actor: { type: "worker", id: device.workerId, name: device.workerName },
      action: "shift.start",
      entityType: "worker_shift",
      entityId: shift.id,
      affectedWorkerId: device.workerId,
      details: { via: "phone" },
    });
    return { ok: true, info: "נרשמה כניסה. עבודה נעימה!" };
  }

  if (!openShift) return { ok: false, error: "אין לך משמרת פתוחה" };
  const { error } = await supabase
    .from("worker_shifts")
    .update({
      ended_at: now,
      ended_by_type: "worker",
      ended_by_id: device.workerId,
      ended_via: "phone",
      ended_lat: coords.lat,
      ended_lng: coords.lng,
      ended_device_id: device.deviceId,
    })
    .eq("id", openShift.id);
  if (error) return { ok: false, error: "סיום המשמרת נכשל" };

  await createAuditLog(supabase, {
    businessId: device.businessId,
    actor: { type: "worker", id: device.workerId, name: device.workerName },
    action: "shift.end",
    entityType: "worker_shift",
    entityId: openShift.id,
    affectedWorkerId: device.workerId,
    details: { via: "phone" },
  });
  return { ok: true, info: "נרשמה יציאה. להתראות!" };
}

/** Used by the enrollment page once the phone is registered. */
export async function goToAttendance(): Promise<void> {
  redirect("/attendance");
}
