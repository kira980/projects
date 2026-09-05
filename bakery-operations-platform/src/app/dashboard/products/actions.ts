"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { createAuditLog } from "@/lib/db/audit";

export type ActionResult = { ok: boolean; error?: string };

const UNIT_TYPES = ["unit", "kg", "tray", "box", "package"];

export async function createCategory(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "יש להזין שם קטגוריה" };

  const { error } = await supabase.from("product_categories").insert({
    business_id: admin.business_id,
    name,
  });

  if (error) return { ok: false, error: "שמירת הקטגוריה נכשלה" };

  revalidatePath("/dashboard/products");
  return { ok: true };
}

type ProductInput = {
  name: string;
  name_ar: string;
  category_id: string | null;
  unit_type: string;
  default_price: number;
};

function parseProductForm(formData: FormData): ProductInput | string {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return "יש להזין שם מוצר";
  // The baker and prep screens read in Arabic, so every product carries an
  // Arabic name — order items snapshot it at order time.
  const nameAr = String(formData.get("name_ar") ?? "").trim();
  if (!nameAr) return "יש להזין שם בערבית";
  const price = Number(formData.get("default_price"));
  if (isNaN(price) || price < 0) return "מחיר לא תקין";
  const unitType = String(formData.get("unit_type") ?? "unit");
  // Online availability is no longer a per-product toggle — every active
  // product is online. Deactivating a product is what hides it.
  return {
    name,
    name_ar: nameAr,
    category_id: String(formData.get("category_id") ?? "") || null,
    unit_type: UNIT_TYPES.includes(unitType) ? unitType : "unit",
    default_price: price,
  };
}

export async function createProduct(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const input = parseProductForm(formData);
  if (typeof input === "string") return { ok: false, error: input };

  const { data: product, error } = await supabase
    .from("products")
    .insert({ business_id: admin.business_id, ...input })
    .select("id")
    .single();

  if (error) return { ok: false, error: "שמירת המוצר נכשלה" };

  await createAuditLog(supabase, {
    businessId: admin.business_id,
    actor: { type: "admin", id: admin.id, name: admin.full_name },
    action: "product.create",
    entityType: "product",
    entityId: product.id,
    details: { name: input.name, price: input.default_price },
  });

  revalidatePath("/dashboard/products");
  return { ok: true };
}

export async function updateProduct(
  productId: string,
  formData: FormData
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const input = parseProductForm(formData);
  if (typeof input === "string") return { ok: false, error: input };

  const { error } = await supabase
    .from("products")
    .update(input)
    .eq("id", productId)
    .eq("business_id", admin.business_id);

  if (error) return { ok: false, error: "עדכון המוצר נכשל" };

  await createAuditLog(supabase, {
    businessId: admin.business_id,
    actor: { type: "admin", id: admin.id, name: admin.full_name },
    action: "product.update",
    entityType: "product",
    entityId: productId,
    details: { name: input.name, price: input.default_price },
  });

  revalidatePath("/dashboard/products");
  return { ok: true };
}

export async function deleteProduct(
  productId: string
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const { data: product } = await supabase
    .from("products")
    .select("name")
    .eq("id", productId)
    .eq("business_id", admin.business_id)
    .single();

  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", productId)
    .eq("business_id", admin.business_id);

  if (error)
    return {
      ok: false,
      error: "מחיקת המוצר נכשלה — ייתכן שהוא משויך להזמנות קיימות",
    };

  await createAuditLog(supabase, {
    businessId: admin.business_id,
    actor: { type: "admin", id: admin.id, name: admin.full_name },
    action: "product.delete",
    entityType: "product",
    entityId: productId,
    details: { name: product?.name },
  });

  revalidatePath("/dashboard/products");
  return { ok: true };
}

export async function setProductActive(
  productId: string,
  isActive: boolean
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("products")
    .update({ is_active: isActive })
    .eq("id", productId)
    .eq("business_id", admin.business_id);

  if (error) return { ok: false, error: "עדכון הסטטוס נכשל" };

  await createAuditLog(supabase, {
    businessId: admin.business_id,
    actor: { type: "admin", id: admin.id, name: admin.full_name },
    action: isActive ? "product.activate" : "product.deactivate",
    entityType: "product",
    entityId: productId,
  });

  revalidatePath("/dashboard/products");
  return { ok: true };
}
