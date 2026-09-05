"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { createAuditLog } from "@/lib/db/audit";

export type ActionResult = { ok: boolean; error?: string };

type CustomerInput = {
  name: string;
  phone: string | null;
  customer_type: string;
  payment_terms: string;
  notes: string | null;
  can_order_online: boolean;
  show_debt_in_portal: boolean;
  receipt: boolean;
};

function parseCustomerForm(formData: FormData): CustomerInput | string {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return "יש להזין שם לקוח";
  const type = String(formData.get("customer_type") ?? "business");
  const terms = String(formData.get("payment_terms") ?? "immediate");
  return {
    name,
    phone: String(formData.get("phone") ?? "").trim() || null,
    customer_type: ["business", "private"].includes(type) ? type : "business",
    payment_terms: ["immediate", "monthly", "custom"].includes(terms)
      ? terms
      : "immediate",
    notes: String(formData.get("notes") ?? "").trim() || null,
    can_order_online: formData.get("can_order_online") === "on",
    show_debt_in_portal: formData.get("show_debt_in_portal") === "on",
    // Whether this customer's orders default to being issued a קבלה.
    receipt: formData.get("receipt") === "on",
  };
}

/**
 * Upserts the customer's default address from the form's address fields
 * (set by the Google Places autocomplete). No-op when no address was
 * entered, so editing a customer without touching the address leaves it
 * untouched.
 */
async function upsertDefaultAddress(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  customerId: string,
  formData: FormData
): Promise<void> {
  const addressText = String(formData.get("address_text") ?? "").trim();
  if (!addressText) return;
  const city = String(formData.get("city") ?? "").trim() || null;
  const latStr = String(formData.get("latitude") ?? "");
  const lngStr = String(formData.get("longitude") ?? "");
  const latitude = latStr ? Number(latStr) : null;
  const longitude = lngStr ? Number(lngStr) : null;

  const { data: existing } = await supabase
    .from("customer_addresses")
    .select("id")
    .eq("business_id", businessId)
    .eq("customer_id", customerId)
    .eq("is_default", true)
    .limit(1)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("customer_addresses")
      .update({ address_text: addressText, city, latitude, longitude })
      .eq("id", existing.id)
      .eq("business_id", businessId);
  } else {
    await supabase.from("customer_addresses").insert({
      business_id: businessId,
      customer_id: customerId,
      address_text: addressText,
      city,
      latitude,
      longitude,
      is_default: true,
    });
  }
}

export async function createCustomer(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const input = parseCustomerForm(formData);
  if (typeof input === "string") return { ok: false, error: input };

  const { data: customer, error } = await supabase
    .from("customers")
    .insert({ business_id: admin.business_id, ...input })
    .select("id")
    .single();

  if (error) return { ok: false, error: "שמירת הלקוח נכשלה" };

  await upsertDefaultAddress(supabase, admin.business_id, customer.id, formData);

  await createAuditLog(supabase, {
    businessId: admin.business_id,
    actor: { type: "admin", id: admin.id, name: admin.full_name },
    action: "customer.create",
    entityType: "customer",
    entityId: customer.id,
    details: { name: input.name },
  });

  revalidatePath("/dashboard/customers");
  return { ok: true };
}

export async function updateCustomer(
  customerId: string,
  formData: FormData
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const input = parseCustomerForm(formData);
  if (typeof input === "string") return { ok: false, error: input };

  const { error } = await supabase
    .from("customers")
    .update(input)
    .eq("id", customerId)
    .eq("business_id", admin.business_id);

  if (error) return { ok: false, error: "עדכון הלקוח נכשל" };

  await upsertDefaultAddress(supabase, admin.business_id, customerId, formData);

  await createAuditLog(supabase, {
    businessId: admin.business_id,
    actor: { type: "admin", id: admin.id, name: admin.full_name },
    action: "customer.update",
    entityType: "customer",
    entityId: customerId,
    details: { name: input.name },
  });

  revalidatePath("/dashboard/customers");
  revalidatePath(`/dashboard/customers/${customerId}`);
  return { ok: true };
}

export async function setCustomerActive(
  customerId: string,
  isActive: boolean
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("customers")
    .update({ is_active: isActive })
    .eq("id", customerId)
    .eq("business_id", admin.business_id);

  if (error) return { ok: false, error: "עדכון הסטטוס נכשל" };

  await createAuditLog(supabase, {
    businessId: admin.business_id,
    actor: { type: "admin", id: admin.id, name: admin.full_name },
    action: isActive ? "customer.activate" : "customer.deactivate",
    entityType: "customer",
    entityId: customerId,
  });

  revalidatePath("/dashboard/customers");
  revalidatePath(`/dashboard/customers/${customerId}`);
  return { ok: true };
}

/** Toggle whether a customer's orders are issued with a קבלה by default. */
export async function setCustomerReceipt(
  customerId: string,
  receipt: boolean
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("customers")
    .update({ receipt })
    .eq("id", customerId)
    .eq("business_id", admin.business_id);

  if (error) return { ok: false, error: "עדכון הקבלה נכשל" };

  await createAuditLog(supabase, {
    businessId: admin.business_id,
    actor: { type: "admin", id: admin.id, name: admin.full_name },
    action: receipt ? "customer.receipt_on" : "customer.receipt_off",
    entityType: "customer",
    entityId: customerId,
  });

  revalidatePath("/dashboard/customers");
  return { ok: true };
}

export async function addCustomerAddress(
  customerId: string,
  formData: FormData
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const addressText = String(formData.get("address_text") ?? "").trim();
  if (!addressText) return { ok: false, error: "יש להזין כתובת" };

  const { error } = await supabase.from("customer_addresses").insert({
    business_id: admin.business_id,
    customer_id: customerId,
    label: String(formData.get("label") ?? "").trim() || null,
    address_text: addressText,
    city: String(formData.get("city") ?? "").trim() || null,
    is_default: formData.get("is_default") === "on",
    notes: String(formData.get("notes") ?? "").trim() || null,
  });

  if (error) return { ok: false, error: "שמירת הכתובת נכשלה" };

  revalidatePath(`/dashboard/customers/${customerId}`);
  return { ok: true };
}

export async function deleteCustomerAddress(
  customerId: string,
  addressId: string
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("customer_addresses")
    .delete()
    .eq("id", addressId)
    .eq("business_id", admin.business_id);

  if (error) return { ok: false, error: "מחיקת הכתובת נכשלה" };

  revalidatePath(`/dashboard/customers/${customerId}`);
  return { ok: true };
}

/** Upsert a customer-specific price / availability for a product. */
export async function setCustomerPrice(
  customerId: string,
  productId: string,
  price: number | null,
  isAvailable: boolean
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  if (price === null) {
    // Remove the override — customer falls back to the default price.
    const { error } = await supabase
      .from("customer_product_prices")
      .delete()
      .eq("customer_id", customerId)
      .eq("product_id", productId)
      .eq("business_id", admin.business_id);
    if (error) return { ok: false, error: "מחיקת המחיר נכשלה" };
  } else {
    if (isNaN(price) || price < 0) return { ok: false, error: "מחיר לא תקין" };
    const { error } = await supabase.from("customer_product_prices").upsert(
      {
        business_id: admin.business_id,
        customer_id: customerId,
        product_id: productId,
        price,
        is_available_to_customer: isAvailable,
      },
      { onConflict: "customer_id,product_id" }
    );
    if (error) return { ok: false, error: "שמירת המחיר נכשלה" };
  }

  await createAuditLog(supabase, {
    businessId: admin.business_id,
    actor: { type: "admin", id: admin.id, name: admin.full_name },
    action: "customer_price.set",
    entityType: "customer",
    entityId: customerId,
    details: { product_id: productId, price, is_available: isAvailable },
  });

  revalidatePath(`/dashboard/customers/${customerId}/prices`);
  return { ok: true };
}
