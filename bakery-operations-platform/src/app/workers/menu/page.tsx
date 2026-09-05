import { redirect } from "next/navigation";
import { getWorkerSession } from "@/lib/kiosk/session";
import { createServiceClient } from "@/lib/supabase/server";
import { MenuClient, type WorkerStatus } from "./menu-client";

export const dynamic = "force-dynamic";

export default async function KioskMenuPage() {
  const session = await getWorkerSession("kiosk");
  if (!session) redirect("/workers");

  const supabase = createServiceClient();
  // Shift managers clock the whole roster from this screen, so they get the
  // worker list with each worker's open-shift state; others only need their
  // own shift for the smart button.
  const [{ data: openShifts }, { data: workers }] = await Promise.all([
    supabase
      .from("worker_shifts")
      .select("worker_id, started_at")
      .eq("business_id", session.businessId)
      .is("ended_at", null),
    session.canManageShift
      ? supabase
          .from("workers")
          .select("id, full_name")
          .eq("business_id", session.businessId)
          .eq("is_active", true)
          .order("full_name")
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ]);

  const openByWorker = new Map(
    (openShifts ?? []).map((s) => [s.worker_id, s.started_at])
  );

  const statuses: WorkerStatus[] = (workers ?? []).map((w) => ({
    id: w.id,
    full_name: w.full_name,
    shift_started_at: openByWorker.get(w.id) ?? null,
  }));

  return (
    <MenuClient
      workerName={session.name}
      hasOpenShift={openByWorker.has(session.workerId)}
      canManageShift={session.canManageShift}
      workers={statuses}
    />
  );
}
