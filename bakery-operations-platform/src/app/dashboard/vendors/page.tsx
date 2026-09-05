import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ViewToggle } from "@/components/view-toggle";
import { VendorsTable } from "./vendors-table";
import { VendorsReport } from "./vendors-report";
import { VendorOrdersView } from "./vendor-orders-view";

export const metadata = { title: "ספקים" };

async function ManageView() {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const [{ data: vendors }, { data: debts }] = await Promise.all([
    supabase
      .from("vendors")
      .select("id, name, phone, contact_name, category, notes, is_active")
      .eq("business_id", admin.business_id)
      .order("is_active", { ascending: false })
      .order("name"),
    supabase
      .from("vendor_debts")
      .select("vendor_id, debt")
      .eq("business_id", admin.business_id),
  ]);

  const debtByVendor = new Map(
    (debts ?? []).map((d) => [d.vendor_id, Number(d.debt)])
  );

  return (
    <VendorsTable
      vendors={(vendors ?? []).map((v) => ({
        ...v,
        debt: debtByVendor.get(v.id) ?? 0,
      }))}
    />
  );
}

export default async function VendorsPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    period?: string;
    month?: string;
    date?: string;
  }>;
}) {
  const sp = await searchParams;
  const view =
    sp.view === "manage" ? "manage" : sp.view === "report" ? "report" : "orders";

  return (
    <div className="grid gap-5">
      <ViewToggle
        basePath="/dashboard/vendors"
        current={view}
        options={[
          { value: "orders", label: "קבלות סחורה" },
          { value: "report", label: "דוח" },
          { value: "manage", label: "ניהול" },
        ]}
      />
      {view === "manage" ? (
        <ManageView />
      ) : view === "report" ? (
        <VendorsReport searchParams={searchParams} />
      ) : (
        <VendorOrdersView searchParams={searchParams} />
      )}
    </div>
  );
}
