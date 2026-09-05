import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { perfRequestId, timed } from "@/lib/perf";
import { NewOrderClient, type CustomerOption } from "./new-order-client";

export const metadata = { title: "הזמנה חדשה" };

export default async function NewOrderPage() {
  const reqId = perfRequestId();
  const admin = await timed(reqId, "auth (requireAdmin)", requireAdmin);
  const supabase = await createClient();

  const [{ data: customers }, { data: addresses }] = await timed(
    reqId,
    "load customers + addresses",
    () =>
      Promise.all([
    supabase
      .from("customers")
      .select("id, name, receipt")
      .eq("business_id", admin.business_id)
      .eq("is_active", true)
      .order("name"),
        supabase
          .from("customer_addresses")
          .select("id, customer_id, address_text, city, is_default")
          .eq("business_id", admin.business_id),
      ])
  );

  const addressesByCustomer = new Map<string, CustomerOption["addresses"]>();
  for (const a of addresses ?? []) {
    const list = addressesByCustomer.get(a.customer_id) ?? [];
    list.push(a);
    addressesByCustomer.set(a.customer_id, list);
  }

  const options: CustomerOption[] = (customers ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    receipt: Boolean(c.receipt),
    addresses: addressesByCustomer.get(c.id) ?? [],
  }));

  // Pin the walk-in customer (לקוח מזדמן) to the top of the list; the rest
  // keep their alphabetical order from the query.
  const WALK_IN_NAME = "לקוח מזדמן";
  options.sort((a, b) => {
    if (a.name === WALK_IN_NAME) return -1;
    if (b.name === WALK_IN_NAME) return 1;
    return 0;
  });

  return <NewOrderClient customers={options} />;
}
