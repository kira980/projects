"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { createAuditLog } from "@/lib/db/audit";
import {
  recordVendorOrder,
  resolveVendorId,
  updateVendorOrder,
  deleteVendorOrder,
  updateVendorPayment,
  deleteVendorPayment,
  parsePaymentMethod,
  type PaymentMethod,
} from "@/lib/db/vendors";
import { isVendorCategory } from "@/lib/vendor-categories";
import { jerusalemInstant } from "@/lib/db/day-lock";

export type ActionResult = { ok: boolean; error?: string };

type VendorInput = {
  name: string;
  phone: string | null;
  contact_name: string | null;
  category: string | null;
  notes: string | null;
};

function parseVendorForm(formData: FormData): VendorInput | string {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return "יש להזין שם ספק";
  // Anything outside the allowed set is stored as "no category" rather than
  // failing the DB check constraint.
  const category = String(formData.get("category") ?? "").trim();
  return {
    name,
    phone: String(formData.get("phone") ?? "").trim() || null,
    contact_name: String(formData.get("contact_name") ?? "").trim() || null,
    category: isVendorCategory(category) ? category : null,
    notes: String(formData.get("notes") ?? "").trim() || null,
  };
}

export async function createVendor(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const input = parseVendorForm(formData);
  if (typeof input === "string") return { ok: false, error: input };

  const { data: vendor, error } = await supabase
    .from("vendors")
    .insert({ business_id: admin.business_id, ...input })
    .select("id")
    .single();

  if (error) return { ok: false, error: "שמירת הספק נכשלה" };

  await createAuditLog(supabase, {
    businessId: admin.business_id,
    actor: { type: "admin", id: admin.id, name: admin.full_name },
    action: "vendor.create",
    entityType: "vendor",
    entityId: vendor.id,
    details: { name: input.name },
  });

  revalidatePath("/dashboard/vendors");
  return { ok: true };
}

export async function updateVendor(
  vendorId: string,
  formData: FormData
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const input = parseVendorForm(formData);
  if (typeof input === "string") return { ok: false, error: input };

  const { error } = await supabase
    .from("vendors")
    .update(input)
    .eq("id", vendorId)
    .eq("business_id", admin.business_id);

  if (error) return { ok: false, error: "עדכון הספק נכשל" };

  await createAuditLog(supabase, {
    businessId: admin.business_id,
    actor: { type: "admin", id: admin.id, name: admin.full_name },
    action: "vendor.update",
    entityType: "vendor",
    entityId: vendorId,
    details: { name: input.name },
  });

  revalidatePath("/dashboard/vendors");
  revalidatePath(`/dashboard/vendors/${vendorId}`);
  return { ok: true };
}

export async function setVendorActive(
  vendorId: string,
  isActive: boolean
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("vendors")
    .update({ is_active: isActive })
    .eq("id", vendorId)
    .eq("business_id", admin.business_id);

  if (error) return { ok: false, error: "עדכון הסטטוס נכשל" };

  await createAuditLog(supabase, {
    businessId: admin.business_id,
    actor: { type: "admin", id: admin.id, name: admin.full_name },
    action: isActive ? "vendor.activate" : "vendor.deactivate",
    entityType: "vendor",
    entityId: vendorId,
  });

  revalidatePath("/dashboard/vendors");
  revalidatePath(`/dashboard/vendors/${vendorId}`);
  return { ok: true };
}

type VendorOrderInput = {
  /** "other" → a name was typed instead of picking from the list. */
  vendorId: string;
  vendorName: string;
  amount: number;
  paid: boolean;
  paymentMethod: PaymentMethod;
  paidByWorkerId: string | null;
  notes: string | null;
  /** UTC instant of the arrival, or null to leave it to the server. */
  receivedAt: string | null;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function parseVendorOrderForm(formData: FormData): VendorOrderInput | string {
  const vendorId = String(formData.get("vendor_id") ?? "").trim();
  if (!vendorId) return "יש לבחור ספק";
  const amount = Number(String(formData.get("amount") ?? "").trim());
  if (!amount || isNaN(amount) || amount <= 0) return "סכום לא תקין";
  const methodRaw = String(formData.get("payment_method") ?? "cash");

  // Date and time of the arrival. The form always sends the date; an empty
  // time means the arrival is dated to that day at midday, which is enough
  // for a day-scoped book and never lands on the wrong business day.
  const date = String(formData.get("received_date") ?? "").trim();
  const time = String(formData.get("received_time") ?? "").trim();
  if (date && !DATE_RE.test(date)) return "תאריך לא תקין";
  if (time && !TIME_RE.test(time)) return "שעה לא תקינה";

  return {
    vendorId,
    vendorName: String(formData.get("vendor_name") ?? "").trim(),
    amount,
    receivedAt: date ? jerusalemInstant(date, time || "12:00") : null,
    paid: formData.get("paid") === "on",
    paymentMethod: (["cash", "card", "transfer", "check", "other"].includes(
      methodRaw
    )
      ? methodRaw
      : "cash") as PaymentMethod,
    // Kept as-is when the admin edits an arrival a worker paid for.
    paidByWorkerId:
      String(formData.get("paid_by_worker_id") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
  };
}

/** Every screen that lists arrivals shows today's numbers too. */
function revalidateVendorOrder(vendorId: string) {
  revalidatePath("/dashboard/vendors");
  revalidatePath(`/dashboard/vendors/${vendorId}`);
  revalidatePath("/dashboard/simple");
  revalidatePath("/dashboard/simple/payments");
}

export async function createVendorOrderAdmin(
  formData: FormData
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const input = parseVendorOrderForm(formData);
  if (typeof input === "string") return { ok: false, error: input };

  // A typed name reuses a vendor already on file (case-insensitive) or
  // creates one; a picked id is verified to belong to this business.
  let vendorId: string;
  try {
    vendorId = await resolveVendorId(
      supabase,
      admin.business_id,
      input.vendorId,
      input.vendorName
    );
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  if (input.vendorId !== "other") {
    const { data: vendor } = await supabase
      .from("vendors")
      .select("id")
      .eq("id", vendorId)
      .eq("business_id", admin.business_id)
      .single();
    if (!vendor) return { ok: false, error: "הספק לא נמצא" };
  }

  try {
    await recordVendorOrder(supabase, {
      businessId: admin.business_id,
      vendorId,
      amount: input.amount,
      paid: input.paid,
      paymentMethod: input.paymentMethod,
      paidByWorkerId: null,
      notes: input.notes,
      actor: { type: "admin", id: admin.id, name: admin.full_name },
      receivedByType: "admin",
      receivedById: admin.id,
      receivedAt: input.receivedAt,
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  revalidateVendorOrder(vendorId);
  return { ok: true };
}

/**
 * Corrects an arrival already on the books — vendor, amount, paid flag,
 * method and note. The bill, its ledger rows and the payment recorded at
 * arrival all move together (migration 0026); the receipt photo on file is
 * left untouched.
 */
export async function updateVendorOrderAdmin(
  orderId: string,
  formData: FormData
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const input = parseVendorOrderForm(formData);
  if (typeof input === "string") return { ok: false, error: input };

  let vendorId: string;
  try {
    vendorId = await resolveVendorId(
      supabase,
      admin.business_id,
      input.vendorId,
      input.vendorName
    );
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  try {
    await updateVendorOrder(supabase, {
      businessId: admin.business_id,
      orderId,
      vendorId,
      amount: input.amount,
      paid: input.paid,
      paymentMethod: input.paymentMethod,
      paidByWorkerId: input.paidByWorkerId,
      receiptFilePath: null,
      notes: input.notes,
      actor: { type: "admin", id: admin.id, name: admin.full_name },
      receivedAt: input.receivedAt,
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  revalidateVendorOrder(vendorId);
  return { ok: true };
}

export async function deleteVendorOrderAdmin(
  orderId: string
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("vendor_orders")
    .select("vendor_id")
    .eq("id", orderId)
    .eq("business_id", admin.business_id)
    .maybeSingle();
  if (!order) return { ok: false, error: "הקבלה לא נמצאה" };

  try {
    await deleteVendorOrder(supabase, {
      businessId: admin.business_id,
      orderId,
      actor: { type: "admin", id: admin.id, name: admin.full_name },
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  revalidateVendorOrder(order.vendor_id);
  return { ok: true };
}

/**
 * תשלום חוב לספק — the admin can fix the amount, the method, the vendor
 * and the note. Moving a payment to another vendor drops the invoice it
 * covered (that bill goes back to unpaid); the RPC still caps the amount
 * at what the vendor is owed, this payment aside.
 */
export async function updateVendorPaymentAdmin(
  paymentId: string,
  formData: FormData
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const vendorId = String(formData.get("vendor_id") ?? "").trim();
  if (!vendorId) return { ok: false, error: "יש לבחור ספק" };
  const amount = Number(String(formData.get("amount") ?? "").trim());
  if (!amount || isNaN(amount) || amount <= 0) {
    return { ok: false, error: "סכום לא תקין" };
  }
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const { data: payment } = await supabase
    .from("vendor_payments")
    .select("vendor_id, vendor_order_id")
    .eq("id", paymentId)
    .eq("business_id", admin.business_id)
    .maybeSingle();
  if (!payment) return { ok: false, error: "התשלום לא נמצא" };

  try {
    await updateVendorPayment(supabase, {
      businessId: admin.business_id,
      paymentId,
      vendorId,
      vendorOrderId:
        vendorId === payment.vendor_id ? payment.vendor_order_id : null,
      amount,
      method: parsePaymentMethod(formData.get("method")),
      paidById: null,
      proofFilePath: null,
      notes,
      actor: { type: "admin", id: admin.id, name: admin.full_name },
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  revalidateVendorOrder(vendorId);
  revalidatePath(`/dashboard/vendors/${payment.vendor_id}`);
  return { ok: true };
}

export async function deleteVendorPaymentAdmin(
  paymentId: string
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const { data: payment } = await supabase
    .from("vendor_payments")
    .select("vendor_id")
    .eq("id", paymentId)
    .eq("business_id", admin.business_id)
    .maybeSingle();
  if (!payment) return { ok: false, error: "התשלום לא נמצא" };

  try {
    await deleteVendorPayment(supabase, {
      businessId: admin.business_id,
      paymentId,
      actor: { type: "admin", id: admin.id, name: admin.full_name },
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  revalidateVendorOrder(payment.vendor_id);
  return { ok: true };
}
