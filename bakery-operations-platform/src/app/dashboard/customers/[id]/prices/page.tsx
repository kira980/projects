import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PricesClient, type PriceRow } from "./prices-client";

export const metadata = { title: "מחירון לקוח" };

export default async function CustomerPricesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = await requireAdmin();
  const supabase = await createClient();

  const { data: customer } = await supabase
    .from("customers")
    .select("id, name")
    .eq("id", id)
    .eq("business_id", admin.business_id)
    .single();

  if (!customer) notFound();

  const [{ data: products }, { data: overrides }, { data: categories }] =
    await Promise.all([
      supabase
        .from("products")
        .select("id, name, unit_type, category_id, default_price, sort_order")
        .eq("business_id", admin.business_id)
        .eq("is_active", true)
        .order("sort_order")
        .order("name"),
      supabase
        .from("customer_product_prices")
        .select("product_id, price, is_available_to_customer")
        .eq("customer_id", id),
      supabase
        .from("product_categories")
        .select("id, name")
        .eq("business_id", admin.business_id),
    ]);

  const categoryNames = new Map((categories ?? []).map((c) => [c.id, c.name]));
  const overrideMap = new Map(
    (overrides ?? []).map((o) => [o.product_id, o])
  );

  const rows: PriceRow[] = (products ?? []).map((p) => {
    const o = overrideMap.get(p.id);
    return {
      product_id: p.id,
      product_name: p.name,
      unit_type: p.unit_type,
      category_name: p.category_id
        ? (categoryNames.get(p.category_id) ?? null)
        : null,
      default_price: Number(p.default_price),
      special_price: o ? Number(o.price) : null,
      is_available: o?.is_available_to_customer ?? true,
    };
  });

  return (
    <PricesClient customerId={id} customerName={customer.name} rows={rows} />
  );
}
