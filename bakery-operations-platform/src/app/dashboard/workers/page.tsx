import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ViewToggle } from "@/components/view-toggle";
import { WorkersTable } from "./workers-table";
import { WorkersReport } from "./workers-report";
import { SalariesView } from "./salaries-view";
import { HoursView } from "./hours-view";

export const metadata = { title: "עובדים" };

async function ManageView() {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const [{ data: workers }, { data: devices }] = await Promise.all([
    supabase
      .from("workers")
      .select(
        "id, full_name, phone, hourly_rate, pay_type, monthly_rate, daily_rate, can_manage_shift, is_admin, is_baker, is_driver, notes, is_active, passcode_hash"
      )
      .eq("business_id", admin.business_id)
      .order("is_active", { ascending: false })
      .order("full_name"),
    supabase
      .from("worker_devices")
      .select("worker_id, created_at")
      .eq("business_id", admin.business_id)
      .is("revoked_at", null),
  ]);

  const deviceByWorker = Object.fromEntries(
    (devices ?? []).map((d) => [
      d.worker_id,
      { connected: true, connectedAt: d.created_at },
    ])
  );

  return <WorkersTable workers={workers ?? []} devices={deviceByWorker} />;
}

const VIEWS = ["report", "salaries", "hours", "manage"] as const;
type View = (typeof VIEWS)[number];

export default async function WorkersPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    period?: string;
    month?: string;
    date?: string;
    mode?: string;
    worker?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const sp = await searchParams;
  const view: View = VIEWS.includes(sp.view as View)
    ? (sp.view as View)
    : "report";

  return (
    <div className="grid gap-5">
      <ViewToggle
        basePath="/dashboard/workers"
        current={view}
        options={[
          { value: "report", label: "דוח" },
          { value: "salaries", label: "משכורות" },
          { value: "hours", label: "שעות" },
          { value: "manage", label: "ניהול" },
        ]}
      />
      {view === "manage" ? (
        <ManageView />
      ) : view === "salaries" ? (
        <SalariesView searchParams={searchParams} />
      ) : view === "hours" ? (
        <HoursView searchParams={searchParams} />
      ) : (
        <WorkersReport searchParams={searchParams} />
      )}
    </div>
  );
}
