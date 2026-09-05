import { redirect } from "next/navigation";
import { getWorkerSession } from "@/lib/kiosk/session";
import { createServiceClient } from "@/lib/supabase/server";
import { businessToday, jerusalemDayRange } from "@/lib/db/day-lock";
import { HistoryClient } from "./history-client";

export const metadata = { title: "היסטוריה" };

/**
 * Everything recorded on the kiosk today, by whoever was on shift — so the
 * shift can see what has already been entered. Correcting a line is an
 * admin-only right (is_admin); everyone else reads it.
 */
export default async function WorkerHistoryPage() {
  const session = await getWorkerSession("kiosk");
  if (!session) redirect("/workers");
  if (!session.canManageShift) redirect("/workers/menu");

  const supabase = createServiceClient();
  const { start, end } = jerusalemDayRange(businessToday());

  const [
    { data: advances },
    { data: vendorOrders },
    { data: vendorPayments },
    { data: expenses },
    { data: workers },
    { data: vendors },
  ] = await Promise.all([
    supabase
      .from("worker_advances")
      .select("id, worker_id, amount, taken_at, given_by_type, given_by_id")
      .eq("business_id", session.businessId)
      .gte("taken_at", start)
      .lt("taken_at", end)
      .order("taken_at", { ascending: false }),
    supabase
      .from("vendor_orders")
      .select("id, vendor_id, amount, status, received_at, received_by_type, received_by_id")
      .eq("business_id", session.businessId)
      .gte("received_at", start)
      .lt("received_at", end)
      .order("received_at", { ascending: false }),
    supabase
      .from("vendor_payments")
      .select("id, vendor_id, amount, at_arrival, paid_at, paid_by_type, paid_by_id")
      .eq("business_id", session.businessId)
      .gte("paid_at", start)
      .lt("paid_at", end)
      .order("paid_at", { ascending: false }),
    // Expenses are filed by business day, not by timestamp, so they are
    // matched on the date column rather than the day's range.
    supabase
      .from("expenses")
      .select("id, amount, description, created_at, spent_by_type, spent_by_id")
      .eq("business_id", session.businessId)
      .eq("expense_date", businessToday())
      .order("created_at", { ascending: false }),
    supabase
      .from("workers")
      .select("id, full_name")
      .eq("business_id", session.businessId),
    supabase
      .from("vendors")
      .select("id, name")
      .eq("business_id", session.businessId),
  ]);

  const workerNames = new Map((workers ?? []).map((w) => [w.id, w.full_name]));
  const vendorNames = new Map((vendors ?? []).map((v) => [v.id, v.name]));

  /** Who recorded the line — a worker by name, the office as "מנהל". */
  const actorName = (type: string | null, id: string | null) =>
    type === "worker" && id ? (workerNames.get(id) ?? null) : "מנהל";

  return (
    <HistoryClient
      managerName={session.name}
      canEdit={session.isAdmin}
      advances={(advances ?? []).map((a) => ({
        id: a.id,
        amount: Number(a.amount),
        at: a.taken_at,
        label: workerNames.get(a.worker_id) ?? "—",
        by: actorName(a.given_by_type, a.given_by_id),
      }))}
      vendorOrders={(vendorOrders ?? []).map((o) => ({
        id: o.id,
        amount: Number(o.amount),
        at: o.received_at,
        label: vendorNames.get(o.vendor_id) ?? "—",
        paid: o.status === "paid",
        by: actorName(o.received_by_type, o.received_by_id),
      }))}
      // Money handed over at an arrival is edited through that arrival,
      // not twice — only standalone debt payments get their own row.
      vendorPayments={(vendorPayments ?? [])
        .filter((p) => !p.at_arrival)
        .map((p) => ({
          id: p.id,
          amount: Number(p.amount),
          at: p.paid_at,
          label: vendorNames.get(p.vendor_id) ?? "—",
          by: actorName(p.paid_by_type, p.paid_by_id),
        }))}
      expenses={(expenses ?? []).map((e) => ({
        id: e.id,
        amount: Number(e.amount),
        at: e.created_at,
        label: e.description ?? "—",
        by: actorName(e.spent_by_type, e.spent_by_id),
      }))}
    />
  );
}
