import type { SupabaseClient } from "@/lib/demo-backend/types";

/**
 * Effective unit price for a customer+product:
 * customer-specific price when one exists, otherwise the product
 * default. This is the single pricing rule for admin orders today
 * and the customer online-ordering portal later. The returned price
 * must be snapshotted into order_items.
 */
export async function getCustomerProductPrice(
  supabase: SupabaseClient,
  customerId: string,
  productId: string
): Promise<number> {
  const { data, error } = await supabase.rpc("get_customer_product_price", {
    p_customer_id: customerId,
    p_product_id: productId,
  });
  if (error || data === null) {
    throw new Error("לא נמצא מחיר למוצר");
  }
  return Number(data);
}

export type PricedProduct = {
  id: string;
  name: string;
  name_ar: string;
  unit_type: string;
  category_id: string | null;
  sort_order: number;
  default_price: number;
  /** Final price for this customer (special price or default). */
  effective_price: number;
  has_special_price: boolean;
  is_available_to_customer: boolean;
};

/**
 * All active products priced for a specific customer — used by the
 * admin order form and, later, the customer portal menu.
 */
export async function getPricedProductsForCustomer(
  supabase: SupabaseClient,
  businessId: string,
  customerId: string
): Promise<PricedProduct[]> {
  const [{ data: products, error: pErr }, { data: overrides, error: oErr }] =
    await Promise.all([
      supabase
        .from("products")
        .select("id, name, name_ar, unit_type, category_id, sort_order, default_price")
        .eq("business_id", businessId)
        .eq("is_active", true)
        .order("sort_order")
        .order("name"),
      supabase
        .from("customer_product_prices")
        .select("product_id, price, is_available_to_customer")
        .eq("business_id", businessId)
        .eq("customer_id", customerId),
    ]);

  if (pErr || oErr) {
    throw new Error("טעינת המוצרים נכשלה");
  }

  const overrideMap = new Map(
    (overrides ?? []).map((o) => [o.product_id, o])
  );

  return (products ?? []).map((p) => {
    const o = overrideMap.get(p.id);
    return {
      ...p,
      default_price: Number(p.default_price),
      effective_price: Number(o?.price ?? p.default_price),
      has_special_price: o !== undefined,
      is_available_to_customer: o?.is_available_to_customer ?? true,
    };
  });
}
