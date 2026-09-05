import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ViewToggle } from "@/components/view-toggle";
import { CustomersTable } from "./customers-table";
import { CustomersReport } from "./customers-report";
import { DebtsReport } from "./debts-report";

export const metadata = { title: "לקוחות" };

async function ManageView() {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const [{ data: customers }, { data: priceCounts }, { data: addresses }] =
    await Promise.all([
      supabase
        .from("customers")
        .select(
          "id, name, phone, customer_type, payment_terms, notes, can_order_online, show_debt_in_portal, is_active, receipt"
        )
        .eq("business_id", admin.business_id)
        .order("is_active", { ascending: false })
        .order("name"),
      supabase
        .from("customer_product_prices")
        .select("customer_id")
        .eq("business_id", admin.business_id),
      supabase
        .from("customer_addresses")
        .select("customer_id, address_text, city, latitude, longitude, is_default")
        .eq("business_id", admin.business_id),
    ]);

  const counts = new Map<string, number>();
  for (const p of priceCounts ?? []) {
    counts.set(p.customer_id, (counts.get(p.customer_id) ?? 0) + 1);
  }

  // Prefer the default address; else the first one on file.
  const addrByCustomer = new Map<
    string,
    { address_text: string; city: string | null; latitude: number | null; longitude: number | null }
  >();
  for (const a of addresses ?? []) {
    const cur = addrByCustomer.get(a.customer_id);
    if (!cur || a.is_default) {
      addrByCustomer.set(a.customer_id, {
        address_text: a.address_text,
        city: a.city,
        latitude: a.latitude,
        longitude: a.longitude,
      });
    }
  }

  return (
    <CustomersTable
      customers={(customers ?? []).map((c) => ({
        ...c,
        special_prices_count: counts.get(c.id) ?? 0,
        default_address: addrByCustomer.get(c.id) ?? null,
      }))}
    />
  );
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; period?: string; month?: string; date?: string }>;
}) {
  const sp = await searchParams;
  const view =
    sp.view === "manage" ? "manage" : sp.view === "debts" ? "debts" : "report";

  return (
    <div className="grid gap-5">
      <ViewToggle
        basePath="/dashboard/customers"
        current={view}
        options={[
          { value: "report", label: "דוח" },
          { value: "debts", label: "חובות" },
          { value: "manage", label: "ניהול" },
        ]}
      />
      {view === "manage" ? (
        <ManageView />
      ) : view === "debts" ? (
        <DebtsReport />
      ) : (
        <CustomersReport searchParams={searchParams} />
      )}
    </div>
  );
}
