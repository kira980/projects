import { redirect } from "next/navigation";
import { getWorkerSession } from "@/lib/kiosk/session";
import { createServiceClient } from "@/lib/supabase/server";
import { VendorArrivalClient } from "./vendor-arrival-client";

export default async function VendorArrivalPage() {
  const session = await getWorkerSession("kiosk");
  if (!session) redirect("/workers");

  const supabase = createServiceClient();
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
    <VendorArrivalClient
      vendors={vendors ?? []}
      workers={workers ?? []}
      currentWorkerId={session.workerId}
    />
  );
}
