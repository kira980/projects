"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { createAuditLog } from "@/lib/db/audit";
import { clientIp, isValidCoords } from "@/lib/attendance/geo";

export type SettingsResult = { ok: boolean; error?: string; info?: string };

/** Both halves must be set before any phone can clock in. */
async function refreshActive(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string
): Promise<void> {
  const { data } = await supabase
    .from("attendance_settings")
    .select("latitude, longitude, allowed_ips")
    .eq("business_id", businessId)
    .maybeSingle();
  const ready =
    data?.latitude !== null &&
    data?.latitude !== undefined &&
    (data?.allowed_ips?.length ?? 0) > 0;
  await supabase
    .from("attendance_settings")
    .update({ is_active: ready })
    .eq("business_id", businessId);
}

/**
 * Pins the work site. The owner presses this standing at the production
 * place, so the browser's own fix becomes the centre of the geofence.
 */
export async function saveLocation(
  latitude: number,
  longitude: number,
  radiusM: number
): Promise<SettingsResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  if (!isValidCoords(latitude, longitude)) {
    return { ok: false, error: "מיקום לא תקין" };
  }
  if (!Number.isFinite(radiusM) || radiusM < 20 || radiusM > 5000) {
    return { ok: false, error: "רדיוס חייב להיות בין 20 ל־5000 מטר" };
  }

  const { error } = await supabase.from("attendance_settings").upsert(
    {
      business_id: admin.business_id,
      latitude,
      longitude,
      radius_m: Math.round(radiusM),
      updated_by: admin.id,
    },
    { onConflict: "business_id" }
  );
  if (error) return { ok: false, error: "שמירת המיקום נכשלה" };

  await refreshActive(supabase, admin.business_id);
  await createAuditLog(supabase, {
    businessId: admin.business_id,
    actor: { type: "admin", id: admin.id, name: admin.full_name },
    action: "attendance.location_set",
    entityType: "attendance_settings",
    details: { radius_m: Math.round(radiusM) },
  });

  revalidatePath("/dashboard/attendance");
  return { ok: true, info: "המיקום נשמר" };
}

/**
 * Registers the network the owner is on right now.
 *
 * The address is read from the request server-side — the owner never has
 * to know what a public IP is, and the phone cannot claim one. A site can
 * legitimately have several, so they add to a list rather than replace it.
 */
export async function registerCurrentNetwork(): Promise<SettingsResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const ip = clientIp(await headers());
  if (!ip) return { ok: false, error: "לא הצלחנו לזהות את הרשת" };

  const { data: current } = await supabase
    .from("attendance_settings")
    .select("allowed_ips")
    .eq("business_id", admin.business_id)
    .maybeSingle();

  const allowed = current?.allowed_ips ?? [];
  if (allowed.includes(ip)) {
    return { ok: true, info: "הרשת הזו כבר רשומה" };
  }

  const { error } = await supabase.from("attendance_settings").upsert(
    {
      business_id: admin.business_id,
      allowed_ips: [...allowed, ip],
      updated_by: admin.id,
    },
    { onConflict: "business_id" }
  );
  if (error) return { ok: false, error: "רישום הרשת נכשל" };

  await refreshActive(supabase, admin.business_id);
  await createAuditLog(supabase, {
    businessId: admin.business_id,
    actor: { type: "admin", id: admin.id, name: admin.full_name },
    action: "attendance.network_add",
    entityType: "attendance_settings",
    details: { count: allowed.length + 1 },
  });

  revalidatePath("/dashboard/attendance");
  return { ok: true, info: "הרשת נרשמה" };
}

export async function removeNetwork(ip: string): Promise<SettingsResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const { data: current } = await supabase
    .from("attendance_settings")
    .select("allowed_ips")
    .eq("business_id", admin.business_id)
    .maybeSingle();

  const allowed = (current?.allowed_ips ?? []).filter((a: string) => a !== ip);
  const { error } = await supabase
    .from("attendance_settings")
    .update({ allowed_ips: allowed, updated_by: admin.id })
    .eq("business_id", admin.business_id);
  if (error) return { ok: false, error: "ההסרה נכשלה" };

  await refreshActive(supabase, admin.business_id);
  await createAuditLog(supabase, {
    businessId: admin.business_id,
    actor: { type: "admin", id: admin.id, name: admin.full_name },
    action: "attendance.network_remove",
    entityType: "attendance_settings",
  });

  revalidatePath("/dashboard/attendance");
  return { ok: true, info: "הרשת הוסרה" };
}

/** What the browser is currently seen as, for the "register" card. */
export async function currentNetwork(): Promise<{ ip: string | null }> {
  await requireAdmin();
  return { ip: clientIp(await headers()) };
}
