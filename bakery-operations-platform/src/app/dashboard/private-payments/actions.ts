"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { createAuditLog } from "@/lib/db/audit";

export type ActionResult = { ok: boolean; error?: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type PaymentInput = {
  amount: number;
  paid_to: string;
  paid_on: string;
  notes: string | null;
};

function parseForm(formData: FormData): PaymentInput | string {
  const amount = Number(String(formData.get("amount") ?? "").trim());
  if (!amount || isNaN(amount) || amount <= 0) return "סכום לא תקין";
  const paid_to = String(formData.get("paid_to") ?? "").trim();
  if (!paid_to) return "יש להזין למי שולם";
  const paid_on = String(formData.get("paid_on") ?? "").trim();
  if (!DATE_RE.test(paid_on)) return "תאריך לא תקין";
  return {
    amount,
    paid_to,
    paid_on,
    notes: String(formData.get("notes") ?? "").trim() || null,
  };
}

/**
 * These are the owner's own payments, not the bakery's, so there is no day
 * lock check here: a locked day closes the business books, and nothing in
 * this table was ever in them.
 */
export async function createPrivatePayment(
  formData: FormData
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const input = parseForm(formData);
  if (typeof input === "string") return { ok: false, error: input };

  const { data: payment, error } = await supabase
    .from("private_payments")
    .insert({ business_id: admin.business_id, ...input, created_by: admin.id })
    .select("id")
    .single();

  if (error) return { ok: false, error: "שמירת התשלום נכשלה" };

  await createAuditLog(supabase, {
    businessId: admin.business_id,
    actor: { type: "admin", id: admin.id, name: admin.full_name },
    action: "private_payment.create",
    entityType: "private_payment",
    entityId: payment.id,
    details: { amount: input.amount, paid_to: input.paid_to, date: input.paid_on },
  });

  revalidatePath("/dashboard/private-payments");
  return { ok: true };
}

export async function updatePrivatePayment(
  paymentId: string,
  formData: FormData
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const input = parseForm(formData);
  if (typeof input === "string") return { ok: false, error: input };

  const { data: before } = await supabase
    .from("private_payments")
    .select("amount, paid_to, paid_on")
    .eq("id", paymentId)
    .eq("business_id", admin.business_id)
    .maybeSingle();
  if (!before) return { ok: false, error: "התשלום לא נמצא" };

  const { error } = await supabase
    .from("private_payments")
    .update(input)
    .eq("id", paymentId)
    .eq("business_id", admin.business_id);

  if (error) return { ok: false, error: "עדכון התשלום נכשל" };

  await createAuditLog(supabase, {
    businessId: admin.business_id,
    actor: { type: "admin", id: admin.id, name: admin.full_name },
    action: "private_payment.update",
    entityType: "private_payment",
    entityId: paymentId,
    details: {
      from: {
        amount: Number(before.amount),
        paid_to: before.paid_to,
        date: before.paid_on,
      },
      to: { amount: input.amount, paid_to: input.paid_to, date: input.paid_on },
    },
  });

  revalidatePath("/dashboard/private-payments");
  return { ok: true };
}

export async function deletePrivatePayment(
  paymentId: string
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const { data: payment } = await supabase
    .from("private_payments")
    .select("amount, paid_to")
    .eq("id", paymentId)
    .eq("business_id", admin.business_id)
    .maybeSingle();
  if (!payment) return { ok: false, error: "התשלום לא נמצא" };

  const { error } = await supabase
    .from("private_payments")
    .delete()
    .eq("id", paymentId)
    .eq("business_id", admin.business_id);

  if (error) return { ok: false, error: "מחיקת התשלום נכשלה" };

  await createAuditLog(supabase, {
    businessId: admin.business_id,
    actor: { type: "admin", id: admin.id, name: admin.full_name },
    action: "private_payment.delete",
    entityType: "private_payment",
    entityId: paymentId,
    details: { amount: Number(payment.amount), paid_to: payment.paid_to },
  });

  revalidatePath("/dashboard/private-payments");
  return { ok: true };
}
