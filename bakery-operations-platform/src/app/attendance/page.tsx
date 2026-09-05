import { Smartphone } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { currentDevice } from "@/lib/attendance/device";
import { shiftDayRange, shiftToday } from "@/lib/db/day-lock";
import { ClockClient, type TodayShift } from "./clock-client";

export const metadata = { title: "נוכחות" };

/**
 * The worker's home screen. The registered phone decides who this is —
 * nothing is chosen, typed or logged into.
 *
 * There is no planned roster in this system, so the screen shows what the
 * clock actually holds for today rather than a schedule nobody maintains.
 */
export default async function AttendancePage() {
  const device = await currentDevice();

  if (!device) {
    return (
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-5 p-6 text-center">
        <Smartphone className="mx-auto size-16 text-muted-foreground" aria-hidden />
        <h1 className="text-2xl font-bold">הטלפון אינו מחובר</h1>
        <p className="text-muted-foreground">
          בקשו מבעל העסק לחבר את הטלפון שלכם למערכת הנוכחות. הוא ישלח לכם
          קישור או קוד לסריקה.
        </p>
      </main>
    );
  }

  const supabase = createServiceClient();
  const today = shiftToday();
  const { start, end } = shiftDayRange(today);

  const [{ data: dayShifts }, { data: openShift }] = await Promise.all([
    supabase
      .from("worker_shifts")
      .select("id, started_at, ended_at")
      .eq("worker_id", device.workerId)
      .gte("started_at", start)
      .lt("started_at", end)
      .order("started_at"),
    supabase
      .from("worker_shifts")
      .select("id, started_at")
      .eq("worker_id", device.workerId)
      .is("ended_at", null)
      .maybeSingle(),
  ]);

  const shifts: TodayShift[] = (dayShifts ?? []).map((s) => ({
    id: s.id,
    startedAt: s.started_at,
    endedAt: s.ended_at,
  }));

  return (
    <ClockClient
      workerName={device.workerName}
      workerActive={device.workerActive}
      openSince={openShift?.started_at ?? null}
      shifts={shifts}
    />
  );
}
