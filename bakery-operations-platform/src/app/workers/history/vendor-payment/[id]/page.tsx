import { redirect } from "next/navigation";
import { getWorkerSession } from "@/lib/kiosk/session";
import { createServiceClient } from "@/lib/supabase/server";
import { businessToday, jerusalemDayRange } from "@/lib/db/day-lock";
import type { VendorWithDebt } from "../../../pay-vendor-debt/vendor-payment-form";
import { EditPaymentClient } from "./edit-payment-client";

export const metadata = { title: "עריכת תשלום לספק" };

/**
 * Correcting a debt payment: the payment form again, filled in with what
 * was recorded. Same rule as the history list — an action recorded today,
 * corrected by an admin.
 */
export default async function EditVendorPaymentPage({
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

  const { data: payment } = await supabase
    .from("vendor_payments")
    .select("id, vendor_id, vendor_order_id, amount, method, paid_by_id, proof_file_path, notes")
    .eq("id", id)
    .eq("business_id", session.businessId)
    .gte("paid_at", start)
    .lt("paid_at", end)
    .maybeSingle();
  if (!payment) redirect("/workers/history");

  const [{ data: vendors }, { data: debts }, { data: unpaid }, { data: workers }, { count: charges }] =
    await Promise.all([
      supabase
        .from("vendors")
        .select("id, name")
        .eq("business_id", session.businessId)
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("vendor_debts")
        .select("vendor_id, debt")
        .eq("business_id", session.businessId),
      supabase
        .from("vendor_orders")
        .select("id, vendor_id, amount, received_at, notes")
        .eq("business_id", session.businessId)
        .eq("status", "unpaid")
        .order("received_at"),
      supabase
        .from("workers")
        .select("id, full_name")
        .eq("business_id", session.businessId)
        .eq("is_active", true)
        .order("full_name"),
      // A vendor we never bill (the kiosk's "ספק אחר") has no debt to cap
      // this payment against.
      supabase
        .from("vendor_ledger_entries")
        .select("id", { count: "exact", head: true })
        .eq("business_id", session.businessId)
        .eq("vendor_id", payment.vendor_id)
        .eq("entry_type", "charge"),
    ]);

  const debtByVendor = new Map(
    (debts ?? []).map((d) => [d.vendor_id, Number(d.debt)])
  );
  const vendorIsBilled = (charges ?? 0) > 0;

  // The vendors worth showing: anyone still owed money, plus this
  // payment's own vendor even if it now owes nothing.
  const withDebt: VendorWithDebt[] = (vendors ?? [])
    .map((v) => ({
      id: v.id,
      name: v.name,
      debt:
        v.id === payment.vendor_id && !vendorIsBilled
          ? null
          : (debtByVendor.get(v.id) ?? 0),
    }))
    .filter((v) => v.id === payment.vendor_id || (v.debt ?? 0) > 0);

  // Invoices this payment may point at: everything still unpaid, plus the
  // one it currently covers (which is marked paid because of it).
  const payable = (unpaid ?? []).map((o) => ({ ...o, amount: Number(o.amount) }));
  if (payment.vendor_order_id && !payable.some((o) => o.id === payment.vendor_order_id)) {
    const { data: linked } = await supabase
      .from("vendor_orders")
      .select("id, vendor_id, amount, received_at, notes")
      .eq("id", payment.vendor_order_id)
      .eq("business_id", session.businessId)
      .maybeSingle();
    if (linked) payable.unshift({ ...linked, amount: Number(linked.amount) });
  }

  return (
    <EditPaymentClient
      paymentId={payment.id}
      vendors={withDebt}
      payableOrders={payable}
      workers={workers ?? []}
      currentWorkerId={session.workerId}
      initial={{
        vendorId: payment.vendor_id,
        vendorOrderId: payment.vendor_order_id,
        amount: Number(payment.amount),
        method: payment.method,
        paidByWorkerId: payment.paid_by_id,
        notes: payment.notes,
        hasProof: Boolean(payment.proof_file_path),
      }}
    />
  );
}
