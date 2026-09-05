import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ViewToggle } from "@/components/view-toggle";
import { ProductsClient } from "./products-client";
import { ProductsReport } from "./products-report";

export const metadata = { title: "מוצרים" };

async function ManageView() {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const [{ data: products }, { data: categories }] = await Promise.all([
    supabase
      .from("products")
      .select(
        "id, name, name_ar, category_id, unit_type, default_price, is_active"
      )
      .eq("business_id", admin.business_id)
      .order("is_active", { ascending: false })
      .order("sort_order")
      .order("name"),
    supabase
      .from("product_categories")
      .select("id, name")
      .eq("business_id", admin.business_id)
      .eq("is_active", true)
      .order("sort_order")
      .order("name"),
  ]);

  return (
    <ProductsClient
      products={(products ?? []).map((p) => ({
        ...p,
        default_price: Number(p.default_price),
      }))}
      categories={categories ?? []}
    />
  );
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; period?: string; month?: string; date?: string }>;
}) {
  const sp = await searchParams;
  const view = sp.view === "manage" ? "manage" : "report";

  return (
    <div className="grid gap-5">
      <ViewToggle
        basePath="/dashboard/products"
        current={view}
        options={[
          { value: "report", label: "דוח" },
          { value: "manage", label: "ניהול" },
        ]}
      />
      {view === "manage" ? (
        <ManageView />
      ) : (
        <ProductsReport searchParams={searchParams} />
      )}
    </div>
  );
}
