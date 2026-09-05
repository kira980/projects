"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { createAuditLog } from "@/lib/db/audit";
import { assertDayIsOpen, businessToday } from "@/lib/db/day-lock";
import { uploadBusinessFile } from "@/lib/storage";

export type ActionResult = { ok: boolean; error?: string };

const METHODS = ["cash", "card", "transfer", "check", "other"];

export async function createExpense(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const amount = Number(formData.get("amount"));
  const description = String(formData.get("description") ?? "").trim();
  const methodRaw = String(formData.get("method") ?? "cash");
  const method = METHODS.includes(methodRaw) ? methodRaw : "cash";
  const expenseDate = String(formData.get("expense_date") ?? "").trim();
  const receipt = formData.get("receipt") as File | null;

  if (!amount || isNaN(amount) || amount <= 0) {
    return { ok: false, error: "סכום לא תקין" };
  }
  if (!description) {
    return { ok: false, error: "יש לכתוב על מה ההוצאה" };
  }

  try {
    await assertDayIsOpen(supabase, admin.business_id, expenseDate || undefined);

    const receiptPath = await uploadBusinessFile(supabase, {
      businessId: admin.business_id,
      bucket: "receipts",
      folder: "expenses",
      file: receipt,
      entityType: "expense",
      uploadedByType: "admin",
      uploadedById: admin.id,
    });

    const { data: expense, error } = await supabase
      .from("expenses")
      .insert({
        business_id: admin.business_id,
        amount,
        method,
        description,
        receipt_file_path: receiptPath,
        spent_by_type: "admin",
        spent_by_id: admin.id,
        expense_date: expenseDate || businessToday(),
      })
      .select("id")
      .single();

    if (error) return { ok: false, error: "שמירת ההוצאה נכשלה" };

    await createAuditLog(supabase, {
      businessId: admin.business_id,
      actor: { type: "admin", id: admin.id, name: admin.full_name },
      action: "expense.create",
      entityType: "expense",
      entityId: expense.id,
      details: { amount, description },
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  revalidatePath("/dashboard/expenses");
  return { ok: true };
}

/**
 * Admin corrections to an expense already on the books. Money out of the
 * register, so both edits obey the day lock of the expense's own day —
 * not today's. The receipt on file is left untouched.
 */
async function findExpense(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  expenseId: string
) {
  const { data } = await supabase
    .from("expenses")
    .select("id, amount, description, expense_date")
    .eq("id", expenseId)
    .eq("business_id", businessId)
    .maybeSingle();
  return data;
}

function revalidateExpense() {
  revalidatePath("/dashboard/expenses");
  revalidatePath("/dashboard/simple");
  revalidatePath("/dashboard/simple/payments");
}

export async function updateExpense(
  expenseId: string,
  formData: FormData
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const amount = Number(formData.get("amount"));
  const description = String(formData.get("description") ?? "").trim();
  const methodRaw = String(formData.get("method") ?? "cash");
  const method = METHODS.includes(methodRaw) ? methodRaw : "cash";

  if (!amount || isNaN(amount) || amount <= 0) {
    return { ok: false, error: "סכום לא תקין" };
  }
  if (!description) return { ok: false, error: "יש לכתוב על מה ההוצאה" };

  const expense = await findExpense(supabase, admin.business_id, expenseId);
  if (!expense) return { ok: false, error: "ההוצאה לא נמצאה" };

  try {
    await assertDayIsOpen(supabase, admin.business_id, expense.expense_date);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const { error } = await supabase
    .from("expenses")
    .update({ amount, method, description })
    .eq("id", expense.id)
    .eq("business_id", admin.business_id);

  if (error) return { ok: false, error: "עדכון ההוצאה נכשל" };

  await createAuditLog(supabase, {
    businessId: admin.business_id,
    actor: { type: "admin", id: admin.id, name: admin.full_name },
    action: "expense.update",
    entityType: "expense",
    entityId: expense.id,
    details: {
      from: { amount: Number(expense.amount), description: expense.description },
      to: { amount, description },
    },
  });

  revalidateExpense();
  return { ok: true };
}

export async function deleteExpense(expenseId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const expense = await findExpense(supabase, admin.business_id, expenseId);
  if (!expense) return { ok: false, error: "ההוצאה לא נמצאה" };

  try {
    await assertDayIsOpen(supabase, admin.business_id, expense.expense_date);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const { error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", expense.id)
    .eq("business_id", admin.business_id);

  if (error) return { ok: false, error: "מחיקת ההוצאה נכשלה" };

  await createAuditLog(supabase, {
    businessId: admin.business_id,
    actor: { type: "admin", id: admin.id, name: admin.full_name },
    action: "expense.delete",
    entityType: "expense",
    entityId: expense.id,
    details: {
      amount: Number(expense.amount),
      description: expense.description,
      expense_date: expense.expense_date,
    },
  });

  revalidateExpense();
  return { ok: true };
}
