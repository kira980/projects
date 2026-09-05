import { redirect } from "next/navigation";
import { getWorkerSession } from "@/lib/kiosk/session";
import { createServiceClient } from "@/lib/supabase/server";
import { PayDebtClient, type VendorWithDebt } from "./pay-debt-client";

export default async function PayVendorDebtPage() {
  const session = await getWorkerSession("kiosk");
  if (!session) redirect("/workers");

  const supabase = createServiceClient();
  const [{ data: vendors }, { data: debts }, { data: unpaid }, { data: workers }] =
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
    ]);

  const debtByVendor = new Map(
    (debts ?? []).map((d) => [d.vendor_id, Number(d.debt)])
  );

  const withDebt: VendorWithDebt[] = (vendors ?? [])
    .map((v) => ({ ...v, debt: debtByVendor.get(v.id) ?? 0 }))
    .filter((v) => v.debt > 0);

  return (
    <PayDebtClient
      vendors={withDebt}
      unpaidOrders={(unpaid ?? []).map((o) => ({
        ...o,
        amount: Number(o.amount),
      }))}
      workers={workers ?? []}
      currentWorkerId={session.workerId}
    />
  );
}
