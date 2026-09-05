import { headers } from "next/headers";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { clientIp } from "@/lib/attendance/geo";
import { appBaseUrl } from "@/lib/attendance/enrollment";
import { PageHeader } from "@/components/ui/page-header";
import { AttendanceClient, type AttendanceSettings } from "./attendance-client";

export const metadata = { title: "נוכחות ומיקום" };

/**
 * נוכחות ומיקום — where the owner switches phone attendance on.
 *
 * Two things have to be true before any phone can clock in: the work site
 * has a location, and at least one network is registered. Both are set by
 * pressing a button in the right place rather than by typing coordinates
 * or an IP, which is the whole point.
 */
export default async function AttendanceSettingsPage() {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const [{ data: settings }, { count: devices }, { count: workers }] =
    await Promise.all([
      supabase
        .from("attendance_settings")
        .select("latitude, longitude, radius_m, allowed_ips, is_active")
        .eq("business_id", admin.business_id)
        .maybeSingle(),
      supabase
        .from("worker_devices")
        .select("id", { count: "exact", head: true })
        .eq("business_id", admin.business_id)
        .is("revoked_at", null),
      supabase
        .from("workers")
        .select("id", { count: "exact", head: true })
        .eq("business_id", admin.business_id)
        .eq("is_active", true),
    ]);

  const model: AttendanceSettings = {
    latitude: settings?.latitude ?? null,
    longitude: settings?.longitude ?? null,
    radiusM: settings?.radius_m ?? 100,
    allowedIps: settings?.allowed_ips ?? [],
    isActive: settings?.is_active ?? false,
    connectedDevices: devices ?? 0,
    activeWorkers: workers ?? 0,
  };

  const headerList = await headers();

  return (
    <div className="grid gap-5">
      <PageHeader
        title="נוכחות ומיקום"
        description="חיבור טלפונים של עובדים והגדרת המקום והרשת שמהם מותר להחתים"
      />
      <AttendanceClient
        settings={model}
        currentIp={clientIp(headerList)}
        installUrl={`${appBaseUrl(headerList)}/attendance/install`}
      />
    </div>
  );
}
