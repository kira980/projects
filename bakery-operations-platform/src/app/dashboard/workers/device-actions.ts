"use server";

import { revalidatePath } from "next/cache";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { createAuditLog } from "@/lib/db/audit";
import { generateDeviceToken, hashToken } from "@/lib/android/token-util";
import {
  ENROLLMENT_TTL_MINUTES,
  enrollmentMessage,
  enrollmentUrl,
  isProtectedPreviewUrl,
  whatsappUrl,
} from "@/lib/attendance/enrollment";

export type EnrollmentSession = {
  ok: true;
  /** The page the QR and the WhatsApp link both point at. */
  url: string;
  /** PNG data URL of the QR, rendered server-side. */
  qr: string;
  whatsapp: string;
  expiresAt: string;
  workerName: string;
  /** The link points at a preview deployment behind Vercel's login. */
  unreachable: boolean;
};

export type EnrollmentResult = EnrollmentSession | { ok: false; error: string };

/**
 * Opens ONE enrollment session for a worker and returns both renderings of
 * it — a QR to scan and a WhatsApp link to send. Whichever the worker uses
 * first registers the phone and invalidates the other.
 *
 * Any session already open for that worker is cancelled first, so the last
 * QR the owner generated is the only one that works.
 */
export async function createEnrollment(
  workerId: string
): Promise<EnrollmentResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const { data: worker } = await supabase
    .from("workers")
    .select("id, full_name, phone, is_active")
    .eq("id", workerId)
    .eq("business_id", admin.business_id)
    .maybeSingle();
  if (!worker) return { ok: false, error: "העובד לא נמצא" };
  if (!worker.is_active) {
    return { ok: false, error: "העובד אינו פעיל — יש להפעיל אותו קודם" };
  }

  await supabase
    .from("device_enrollments")
    .update({ cancelled_at: new Date().toISOString() })
    .eq("business_id", admin.business_id)
    .eq("worker_id", workerId)
    .is("used_at", null)
    .is("cancelled_at", null);

  const token = generateDeviceToken();
  const expiresAt = new Date(
    Date.now() + ENROLLMENT_TTL_MINUTES * 60_000
  ).toISOString();

  const { error } = await supabase.from("device_enrollments").insert({
    business_id: admin.business_id,
    worker_id: workerId,
    token_hash: hashToken(token),
    created_by: admin.id,
    expires_at: expiresAt,
  });
  if (error) return { ok: false, error: "פתיחת החיבור נכשלה" };

  const url = await enrollmentUrl(token);

  await createAuditLog(supabase, {
    businessId: admin.business_id,
    actor: { type: "admin", id: admin.id, name: admin.full_name },
    action: "device.enrollment_start",
    entityType: "worker",
    entityId: workerId,
    affectedWorkerId: workerId,
    details: { worker_name: worker.full_name },
  });

  return {
    ok: true,
    url,
    qr: await QRCode.toDataURL(url, { width: 640, margin: 1 }),
    whatsapp: whatsappUrl(worker.phone, enrollmentMessage(worker.full_name, url)),
    expiresAt,
    workerName: worker.full_name,
    unreachable: isProtectedPreviewUrl(url),
  };
}

/** Closes an open session — the QR and the link stop working at once. */
export async function cancelEnrollment(
  workerId: string
): Promise<{ ok: boolean; error?: string }> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("device_enrollments")
    .update({ cancelled_at: new Date().toISOString() })
    .eq("business_id", admin.business_id)
    .eq("worker_id", workerId)
    .is("used_at", null)
    .is("cancelled_at", null);

  if (error) return { ok: false, error: "הביטול נכשל" };
  revalidatePath("/dashboard/workers");
  return { ok: true };
}

/** Has the worker's phone registered yet? Polled while the QR is on screen. */
export async function enrollmentStatus(
  workerId: string
): Promise<{ connected: boolean }> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const { data } = await supabase
    .from("worker_devices")
    .select("id")
    .eq("business_id", admin.business_id)
    .eq("worker_id", workerId)
    .is("revoked_at", null)
    .maybeSingle();

  return { connected: !!data };
}

/**
 * Disconnects the worker's phone. The row stays — the shifts it recorded
 * keep pointing at it — but the token stops resolving, so that handset can
 * no longer clock anybody in or out.
 */
export async function revokeDevice(
  workerId: string
): Promise<{ ok: boolean; error?: string }> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const { data: device } = await supabase
    .from("worker_devices")
    .select("id")
    .eq("business_id", admin.business_id)
    .eq("worker_id", workerId)
    .is("revoked_at", null)
    .maybeSingle();
  if (!device) return { ok: false, error: "לא נמצא טלפון מחובר" };

  const { error } = await supabase
    .from("worker_devices")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", device.id);
  if (error) return { ok: false, error: "הניתוק נכשל" };

  await createAuditLog(supabase, {
    businessId: admin.business_id,
    actor: { type: "admin", id: admin.id, name: admin.full_name },
    action: "device.revoke",
    entityType: "worker_device",
    entityId: device.id,
    affectedWorkerId: workerId,
  });

  revalidatePath("/dashboard/workers");
  return { ok: true };
}
