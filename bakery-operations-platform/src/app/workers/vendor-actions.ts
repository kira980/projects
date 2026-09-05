"use server";

import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { getWorkerSession } from "@/lib/kiosk/session";
import { uploadBusinessFile } from "@/lib/storage";
import {
  parsePaymentMethod,
  recordVendorOrder,
  recordVendorPayment,
  resolveVendorId,
} from "@/lib/db/vendors";
import type { KioskResult } from "./actions";

/** קבלת סחורה from the kiosk. */
export async function submitVendorArrival(
  formData: FormData
): Promise<KioskResult> {
  const session = await getWorkerSession("kiosk");
  if (!session) redirect("/workers");

  const vendorIdRaw = String(formData.get("vendor_id") ?? "");
  const vendorName = String(formData.get("vendor_name") ?? "");
  const amount = Number(formData.get("amount"));
  const paid = formData.get("paid") === "true";
  const paidByWorkerId =
    String(formData.get("paid_by_worker_id") ?? "") || session.workerId;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const receipt = formData.get("receipt") as File | null;

  if (!vendorIdRaw) return { ok: false, error: "יש לבחור ספק" };
  if (!amount || isNaN(amount) || amount <= 0) {
    return { ok: false, error: "סכום לא תקין" };
  }

  const supabase = createServiceClient();

  try {
    const vendorId = await resolveVendorId(
      supabase,
      session.businessId,
      vendorIdRaw,
      vendorName
    );

    const receiptPath = await uploadBusinessFile(supabase, {
      businessId: session.businessId,
      bucket: "receipts",
      folder: "vendor-orders",
      file: receipt,
      entityType: "vendor_order",
      uploadedByType: "worker",
      uploadedById: session.workerId,
    });

    await recordVendorOrder(supabase, {
      businessId: session.businessId,
      vendorId,
      amount,
      paid,
      paymentMethod: paid ? parsePaymentMethod(formData.get("method")) : undefined,
      paidByWorkerId: paid ? paidByWorkerId : null,
      receiptFilePath: receiptPath,
      notes,
      actor: { type: "worker", id: session.workerId, name: session.name },
      receivedByType: "worker",
      receivedById: session.workerId,
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  return { ok: true, info: "קבלת הסחורה נרשמה" };
}

/** תשלום חוב לספק from the kiosk. */
export async function submitVendorDebtPayment(
  formData: FormData
): Promise<KioskResult> {
  const session = await getWorkerSession("kiosk");
  if (!session) redirect("/workers");

  const vendorIdRaw = String(formData.get("vendor_id") ?? "");
  const vendorName = String(formData.get("vendor_name") ?? "");
  const vendorOrderId = String(formData.get("vendor_order_id") ?? "") || null;
  const amount = Number(formData.get("amount"));
  const paidByWorkerId =
    String(formData.get("paid_by_worker_id") ?? "") || session.workerId;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const proof = formData.get("proof") as File | null;

  if (!vendorIdRaw) return { ok: false, error: "יש לבחור ספק" };
  if (!amount || isNaN(amount) || amount <= 0) {
    return { ok: false, error: "סכום לא תקין" };
  }

  const supabase = createServiceClient();

  try {
    const vendorId = await resolveVendorId(
      supabase,
      session.businessId,
      vendorIdRaw,
      vendorName
    );

    const proofPath = await uploadBusinessFile(supabase, {
      businessId: session.businessId,
      bucket: "proofs",
      folder: "vendor-payments",
      file: proof,
      entityType: "vendor_payment",
      uploadedByType: "worker",
      uploadedById: session.workerId,
    });

    await recordVendorPayment(supabase, {
      businessId: session.businessId,
      vendorId,
      amount,
      method: parsePaymentMethod(formData.get("method")),
      // A manually-typed ("other") vendor has no specific invoice.
      vendorOrderId: vendorIdRaw === "other" ? null : vendorOrderId,
      paidByType: "worker",
      paidById: paidByWorkerId,
      proofFilePath: proofPath,
      notes,
      actor: { type: "worker", id: session.workerId, name: session.name },
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  return { ok: true, info: "התשלום נרשם" };
}
