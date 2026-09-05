"use server";

import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { getWorkerSession } from "@/lib/kiosk/session";
import { uploadBusinessFile } from "@/lib/storage";
import { createAuditLog } from "@/lib/db/audit";
import { assertDayIsOpen, businessToday } from "@/lib/db/day-lock";
import type { KioskResult } from "../actions";

export async function submitExpense(formData: FormData): Promise<KioskResult> {
  const session = await getWorkerSession("kiosk");
  if (!session) redirect("/workers");

  const amount = Number(formData.get("amount"));
  const description = String(formData.get("description") ?? "").trim();
  const receipt = formData.get("receipt") as File | null;

  if (!amount || isNaN(amount) || amount <= 0) {
    return { ok: false, error: "סכום לא תקין" };
  }
  if (!description) {
    return { ok: false, error: "יש לכתוב על מה ההוצאה" };
  }

  const supabase = createServiceClient();

  try {
    await assertDayIsOpen(supabase, session.businessId);

    const receiptPath = await uploadBusinessFile(supabase, {
      businessId: session.businessId,
      bucket: "receipts",
      folder: "expenses",
      file: receipt,
      entityType: "expense",
      uploadedByType: "worker",
      uploadedById: session.workerId,
    });

    const { data: expense, error } = await supabase
      .from("expenses")
      .insert({
        business_id: session.businessId,
        amount,
        method: "cash",
        description,
        receipt_file_path: receiptPath,
        spent_by_type: "worker",
        spent_by_id: session.workerId,
        // The column defaults to the calendar date, which disagrees with
        // every other money record between midnight and 02:00 — an expense
        // taken at 01:00 belongs to the night that is still trading.
        expense_date: businessToday(),
      })
      .select("id")
      .single();

    if (error) return { ok: false, error: "שמירת ההוצאה נכשלה" };

    await createAuditLog(supabase, {
      businessId: session.businessId,
      actor: { type: "worker", id: session.workerId, name: session.name },
      action: "expense.create",
      entityType: "expense",
      entityId: expense.id,
      details: { amount, description },
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  return { ok: true, info: "ההוצאה נרשמה" };
}
