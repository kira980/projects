import { redirect } from "next/navigation";
import { getWorkerSession } from "@/lib/kiosk/session";
import { createServiceClient } from "@/lib/supabase/server";
import { businessToday, jerusalemDayRange } from "@/lib/db/day-lock";
import { EditArrivalClient } from "./edit-arrival-client";

export const metadata = { title: "עריכת קבלת סחורה" };

/**
 * Correcting a goods arrival: the arrival form again, filled in with what
 * was recorded. Same rule as the history list — an action recorded today,
 * corrected by an admin.
 */
export default async function EditVendorOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getWorkerSession("kiosk");
  if (!session) redirect("/workers");
  if (!session.canManageShift) redirect("/workers/menu");
  if (!session.isAdmin) redirect("/workers/history");

  const supabase = createServiceClient();
  const { start, end } = jerusalemDayRange(businessToday());

  const { data: order } = await supabase
    .from("vendor_orders")
    .select(
      "id, vendor_id, amount, status, payment_method, paid_by_worker_id, receipt_file_path, notes"
    )
    .eq("id", id)
    .eq("business_id", session.businessId)
    .gte("received_at", start)
    .lt("received_at", end)
    .maybeSingle();
  if (!order) redirect("/workers/history");

  const [{ data: vendors }, { data: workers }] = await Promise.all([
    supabase
      .from("vendors")
      .select("id, name, category")
      .eq("business_id", session.businessId)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("workers")
      .select("id, full_name")
      .eq("business_id", session.businessId)
      .eq("is_active", true)
      .order("full_name"),
  ]);

  return (
    <EditArrivalClient
      orderId={order.id}
      vendors={vendors ?? []}
      workers={workers ?? []}
      currentWorkerId={session.workerId}
      initial={{
        vendorId: order.vendor_id,
        amount: Number(order.amount),
        paid: order.status === "paid",
        method: order.payment_method ?? "cash",
        paidByWorkerId: order.paid_by_worker_id,
        notes: order.notes,
        hasReceipt: Boolean(order.receipt_file_path),
      }}
    />
  );
}
