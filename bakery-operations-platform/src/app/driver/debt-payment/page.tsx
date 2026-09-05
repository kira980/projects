import { redirect } from "next/navigation";
import { getWorkerSession } from "@/lib/kiosk/session";
import { createServiceClient } from "@/lib/supabase/server";
import { DebtPaymentClient } from "./debt-payment-client";

export default async function DebtPaymentPage() {
  const session = await getWorkerSession("driver");
  if (!session) redirect("/driver");

  const supabase = createServiceClient();
  const { data: customers } = await supabase
    .from("customers")
    .select("id, name, payment_terms")
    .eq("business_id", session.businessId)
    .eq("is_active", true)
    .order("name");

  return (
    <DebtPaymentClient
      customers={(customers ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        monthly: c.payment_terms === "monthly",
      }))}
    />
  );
}
