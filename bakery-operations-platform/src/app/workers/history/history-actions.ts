"use server";

import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { getWorkerSession, type WorkerSession } from "@/lib/kiosk/session";
import { createAuditLog } from "@/lib/db/audit";
import { assertDayIsOpen, businessToday, jerusalemDayRange } from "@/lib/db/day-lock";
import { uploadBusinessFile } from "@/lib/storage";
import {
  deleteVendorOrder,
  deleteVendorPayment,
  parsePaymentMethod,
  resolveVendorId,
  updateVendorOrder,
  updateVendorPayment,
} from "@/lib/db/vendors";
import type { KioskResult } from "../actions";

/**
 * Corrections to TODAY's recorded actions — advances, vendor orders,
 * vendor debt payments — by whoever recorded them. The whole shift can
 * READ the day (see the history page); only a worker with the admin role
 * may fix or remove a line. Anything older stays a dashboard job.
 */

async function requireAdminWorker(): Promise<WorkerSession> {
  const session = await getWorkerSession("kiosk");
  if (!session) redirect("/workers");
  if (!session.canManageShift) redirect("/workers/menu");
  if (!session.isAdmin) redirect("/workers/history");
  return session;
}

function todayRange() {
  return jerusalemDayRange(businessToday());
}

function parseAmount(raw: unknown): number | null {
  const amount = Number(raw);
  if (!amount || isNaN(amount) || amount <= 0 || amount > 100000) return null;
  return amount;
}

// ── Advances ──

export async function updateTodayAdvance(
  advanceId: string,
  amountRaw: number
): Promise<KioskResult> {
  const session = await requireAdminWorker();
  const amount = parseAmount(amountRaw);
  if (amount === null) return { ok: false, error: "סכום לא תקין" };

  const supabase = createServiceClient();
  const { start, end } = todayRange();
  const { data: advance } = await supabase
    .from("worker_advances")
    .select("id, amount, worker_id")
    .eq("id", advanceId)
    .eq("business_id", session.businessId)
        .gte("taken_at", start)
    .lt("taken_at", end)
    .maybeSingle();
  if (!advance) return { ok: false, error: "המפרעה לא נמצאה" };

  try {
    await assertDayIsOpen(supabase, session.businessId);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const { error } = await supabase
    .from("worker_advances")
    .update({ amount })
    .eq("id", advance.id);
  if (error) return { ok: false, error: "העדכון נכשל" };

  await createAuditLog(supabase, {
    businessId: session.businessId,
    actor: { type: "worker", id: session.workerId, name: session.name },
    action: "advance.update",
    entityType: "worker_advance",
    entityId: advance.id,
    affectedWorkerId: advance.worker_id,
    details: { from: Number(advance.amount), to: amount },
  });
  return { ok: true, info: "המפרעה עודכנה" };
}

export async function deleteTodayAdvance(advanceId: string): Promise<KioskResult> {
  const session = await requireAdminWorker();
  const supabase = createServiceClient();
  const { start, end } = todayRange();
  const { data: advance } = await supabase
    .from("worker_advances")
    .select("id, amount, worker_id")
    .eq("id", advanceId)
    .eq("business_id", session.businessId)
        .gte("taken_at", start)
    .lt("taken_at", end)
    .maybeSingle();
  if (!advance) return { ok: false, error: "המפרעה לא נמצאה" };

  try {
    await assertDayIsOpen(supabase, session.businessId);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const { error } = await supabase
    .from("worker_advances")
    .delete()
    .eq("id", advance.id);
  if (error) return { ok: false, error: "המחיקה נכשלה" };

  await createAuditLog(supabase, {
    businessId: session.businessId,
    actor: { type: "worker", id: session.workerId, name: session.name },
    action: "advance.delete",
    entityType: "worker_advance",
    entityId: advance.id,
    affectedWorkerId: advance.worker_id,
    details: { amount: Number(advance.amount) },
  });
  return { ok: true, info: "המפרעה נמחקה" };
}

// ── Vendor orders (קבלת סחורה) ──

/** Any arrival recorded today, or null. */
async function findTodayVendorOrder(
  supabase: ReturnType<typeof createServiceClient>,
  session: WorkerSession,
  orderId: string
) {
  const { start, end } = todayRange();
  const { data } = await supabase
    .from("vendor_orders")
    .select("id")
    .eq("id", orderId)
    .eq("business_id", session.businessId)
        .gte("received_at", start)
    .lt("received_at", end)
    .maybeSingle();
  return data;
}

/**
 * Corrects an arrival from the same form that recorded it — vendor,
 * amount, paid flag, method, who paid, receipt photo and note. The ledger
 * follows in the same transaction (see migration 0026).
 */
export async function updateTodayVendorOrder(
  orderId: string,
  formData: FormData
): Promise<KioskResult> {
  const session = await requireAdminWorker();
  const supabase = createServiceClient();

  const order = await findTodayVendorOrder(supabase, session, orderId);
  if (!order) return { ok: false, error: "הקבלה לא נמצאה" };

  const vendorIdRaw = String(formData.get("vendor_id") ?? "");
  const vendorName = String(formData.get("vendor_name") ?? "");
  const amount = parseAmount(formData.get("amount"));
  const paid = formData.get("paid") === "true";
  const paidByWorkerId =
    String(formData.get("paid_by_worker_id") ?? "") || session.workerId;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const receipt = formData.get("receipt") as File | null;

  if (!vendorIdRaw) return { ok: false, error: "יש לבחור ספק" };
  if (amount === null) return { ok: false, error: "סכום לא תקין" };

  try {
    const vendorId = await resolveVendorId(
      supabase,
      session.businessId,
      vendorIdRaw,
      vendorName
    );

    // Null unless a new photo was taken — the old one stays.
    const receiptPath = await uploadBusinessFile(supabase, {
      businessId: session.businessId,
      bucket: "receipts",
      folder: "vendor-orders",
      file: receipt,
      entityType: "vendor_order",
      entityId: order.id,
      uploadedByType: "worker",
      uploadedById: session.workerId,
    });

    await updateVendorOrder(supabase, {
      businessId: session.businessId,
      orderId: order.id,
      vendorId,
      amount,
      paid,
      paymentMethod: paid ? parsePaymentMethod(formData.get("method")) : undefined,
      paidByWorkerId: paid ? paidByWorkerId : null,
      receiptFilePath: receiptPath,
      notes,
      actor: { type: "worker", id: session.workerId, name: session.name },
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  return { ok: true, info: "הקבלה עודכנה" };
}

export async function deleteTodayVendorOrder(orderId: string): Promise<KioskResult> {
  const session = await requireAdminWorker();
  const supabase = createServiceClient();

  const order = await findTodayVendorOrder(supabase, session, orderId);
  if (!order) return { ok: false, error: "הקבלה לא נמצאה" };

  try {
    await deleteVendorOrder(supabase, {
      businessId: session.businessId,
      orderId: order.id,
      actor: { type: "worker", id: session.workerId, name: session.name },
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  return { ok: true, info: "הקבלה נמחקה" };
}

// ── Vendor debt payments ──

/** Any debt payment recorded today, or null. */
async function findTodayVendorPayment(
  supabase: ReturnType<typeof createServiceClient>,
  session: WorkerSession,
  paymentId: string
) {
  const { start, end } = todayRange();
  const { data } = await supabase
    .from("vendor_payments")
    .select("id")
    .eq("id", paymentId)
    .eq("business_id", session.businessId)
        .gte("paid_at", start)
    .lt("paid_at", end)
    .maybeSingle();
  return data;
}

/**
 * Corrects a debt payment from the same form that recorded it — vendor,
 * invoice, amount, method, who paid, proof and note. The amount is capped
 * at what the vendor is still owed (this payment aside).
 */
export async function updateTodayVendorPayment(
  paymentId: string,
  formData: FormData
): Promise<KioskResult> {
  const session = await requireAdminWorker();
  const supabase = createServiceClient();

  const payment = await findTodayVendorPayment(supabase, session, paymentId);
  if (!payment) return { ok: false, error: "התשלום לא נמצא" };

  const vendorIdRaw = String(formData.get("vendor_id") ?? "");
  const vendorName = String(formData.get("vendor_name") ?? "");
  const vendorOrderId = String(formData.get("vendor_order_id") ?? "") || null;
  const amount = parseAmount(formData.get("amount"));
  const paidByWorkerId =
    String(formData.get("paid_by_worker_id") ?? "") || session.workerId;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const proof = formData.get("proof") as File | null;

  if (!vendorIdRaw) return { ok: false, error: "יש לבחור ספק" };
  if (amount === null) return { ok: false, error: "סכום לא תקין" };

  try {
    const vendorId = await resolveVendorId(
      supabase,
      session.businessId,
      vendorIdRaw,
      vendorName
    );

    // Null unless a new photo was taken — the old one stays.
    const proofPath = await uploadBusinessFile(supabase, {
      businessId: session.businessId,
      bucket: "proofs",
      folder: "vendor-payments",
      file: proof,
      entityType: "vendor_payment",
      entityId: payment.id,
      uploadedByType: "worker",
      uploadedById: session.workerId,
    });

    await updateVendorPayment(supabase, {
      businessId: session.businessId,
      paymentId: payment.id,
      vendorId,
      // A manually-typed ("other") vendor has no specific invoice.
      vendorOrderId: vendorIdRaw === "other" ? null : vendorOrderId,
      amount,
      method: parsePaymentMethod(formData.get("method")),
      paidById: paidByWorkerId,
      proofFilePath: proofPath,
      notes,
      actor: { type: "worker", id: session.workerId, name: session.name },
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  return { ok: true, info: "התשלום עודכן" };
}

export async function deleteTodayVendorPayment(
  paymentId: string
): Promise<KioskResult> {
  const session = await requireAdminWorker();
  const supabase = createServiceClient();

  const payment = await findTodayVendorPayment(supabase, session, paymentId);
  if (!payment) return { ok: false, error: "התשלום לא נמצא" };

  try {
    await deleteVendorPayment(supabase, {
      businessId: session.businessId,
      paymentId: payment.id,
      actor: { type: "worker", id: session.workerId, name: session.name },
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  return { ok: true, info: "התשלום נמחק" };
}

// ── Other payments (תשלום אחר) ──

/**
 * An expense recorded today, or null. Expenses are filed by business day
 * rather than by timestamp, so this matches on the date column instead of
 * a range — the same day the history page lists.
 */
async function findTodayExpense(
  supabase: ReturnType<typeof createServiceClient>,
  session: WorkerSession,
  expenseId: string
) {
  const { data } = await supabase
    .from("expenses")
    .select("id, amount, description")
    .eq("id", expenseId)
    .eq("business_id", session.businessId)
    .eq("expense_date", businessToday())
    .maybeSingle();
  return data;
}

export async function updateTodayExpense(
  expenseId: string,
  amountRaw: number
): Promise<KioskResult> {
  const session = await requireAdminWorker();
  const amount = parseAmount(amountRaw);
  if (amount === null) return { ok: false, error: "סכום לא תקין" };

  const supabase = createServiceClient();
  const expense = await findTodayExpense(supabase, session, expenseId);
  if (!expense) return { ok: false, error: "התשלום לא נמצא" };

  try {
    await assertDayIsOpen(supabase, session.businessId);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const { error } = await supabase
    .from("expenses")
    .update({ amount })
    .eq("id", expense.id);
  if (error) return { ok: false, error: "העדכון נכשל" };

  await createAuditLog(supabase, {
    businessId: session.businessId,
    actor: { type: "worker", id: session.workerId, name: session.name },
    action: "expense.update",
    entityType: "expense",
    entityId: expense.id,
    details: {
      from: { amount: Number(expense.amount) },
      to: { amount },
    },
  });
  return { ok: true, info: "התשלום עודכן" };
}

export async function deleteTodayExpense(
  expenseId: string
): Promise<KioskResult> {
  const session = await requireAdminWorker();
  const supabase = createServiceClient();
  const expense = await findTodayExpense(supabase, session, expenseId);
  if (!expense) return { ok: false, error: "התשלום לא נמצא" };

  try {
    await assertDayIsOpen(supabase, session.businessId);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const { error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", expense.id);
  if (error) return { ok: false, error: "המחיקה נכשלה" };

  await createAuditLog(supabase, {
    businessId: session.businessId,
    actor: { type: "worker", id: session.workerId, name: session.name },
    action: "expense.delete",
    entityType: "expense",
    entityId: expense.id,
    details: {
      amount: Number(expense.amount),
      description: expense.description,
    },
  });
  return { ok: true, info: "התשלום נמחק" };
}
