import "server-only";
import type { PostgrestError, SupabaseClient } from "@/lib/demo-backend/types";
import type { AuditActor } from "./audit";
import { formatMoney } from "@/lib/format";

export type PaymentMethod = "cash" | "card" | "transfer" | "check" | "other";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "מזומן",
  card: "אשראי",
  transfer: "העברה",
  check: "צ'ק",
  other: "אחר",
};

/**
 * Every vendor write goes through a database function (migration 0026):
 * the bill/payment row, its ledger row(s) and the audit entry land in one
 * transaction. Vendor debt is only ever the ledger sum, so a half-written
 * pair used to mis-state it with nothing to reconstruct it from.
 */

type ActorParams = {
  p_actor_type: AuditActor["type"];
  p_actor_id: string | null;
  p_actor_name: string;
};

function actorParams(actor: AuditActor): ActorParams {
  return {
    p_actor_type: actor.type,
    p_actor_id: actor.id ?? null,
    p_actor_name: actor.name,
  };
}

const METHODS: PaymentMethod[] = ["cash", "card", "transfer", "check", "other"];

export function parsePaymentMethod(value: unknown): PaymentMethod {
  return METHODS.includes(value as PaymentMethod)
    ? (value as PaymentMethod)
    : "cash";
}

/**
 * Resolves the vendor to charge/pay. For the kiosk's "other" option the
 * worker types a name — reuse an existing vendor with that name
 * (case-insensitive) or create one, so the bill/payment always links to a
 * real vendor row.
 */
export async function resolveVendorId(
  supabase: SupabaseClient,
  businessId: string,
  vendorId: string,
  vendorName: string
): Promise<string> {
  if (vendorId && vendorId !== "other") return vendorId;
  const name = vendorName.trim();
  if (!name) throw new Error("יש להזין שם ספק");

  const { data: existing } = await supabase
    .from("vendors")
    .select("id")
    .eq("business_id", businessId)
    .ilike("name", name)
    .limit(1)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("vendors")
    .insert({ business_id: businessId, name })
    .select("id")
    .single();
  if (error || !created) throw new Error("יצירת הספק נכשלה");
  return created.id;
}

/** Turns a raised plpgsql condition into the Hebrew message users see. */
function vendorRpcError(error: PostgrestError, fallback: string): Error {
  const message = error.message ?? "";

  const overpay = message.match(/DEBT_EXCEEDED:([\d.]+)/);
  if (overpay) {
    const debt = Number(overpay[1]);
    return new Error(
      debt > 0
        ? `הסכום גבוה מהחוב לספק (חוב נוכחי: ${formatMoney(debt)})`
        : "לספק אין חוב פתוח"
    );
  }
  if (message.includes("DAY_LOCKED")) {
    return new Error("היום נעול — לא ניתן לבצע פעולות כספיות. פנה למנהל.");
  }
  if (message.includes("DEBT_PAYMENT_EXISTS")) {
    return new Error(
      "לקבלה הזו נרשם תשלום חוב נפרד — יש לבטל את התשלום קודם"
    );
  }
  if (message.includes("VENDOR_NOT_FOUND")) return new Error("הספק לא נמצא");
  if (message.includes("ORDER_NOT_FOUND")) return new Error("הקבלה לא נמצאה");
  if (message.includes("PAYMENT_NOT_FOUND")) return new Error("התשלום לא נמצא");
  if (message.includes("NOT_AUTHORIZED")) return new Error("אין הרשאה לפעולה זו");
  if (error.code === "PGRST202") {
    console.error("[vendors] migration 0026 is not applied:", message);
    return new Error("המערכת אינה מעודכנת — פנה למנהל");
  }

  console.error("[vendors] rpc failed:", error.code, message);
  return new Error(fallback);
}

/**
 * קבלת סחורה — records a vendor bill. If paid at arrival, also records
 * the payment. Ledger: charge always; payment when paid.
 *
 * `receivedAt` back-dates the arrival (migration 0028): the day lock that
 * governs the write is then the lock of the day the arrival is dated to.
 * Omitted means now, which is what the kiosk always wants.
 */
export async function recordVendorOrder(
  supabase: SupabaseClient,
  opts: {
    businessId: string;
    vendorId: string;
    amount: number;
    paid: boolean;
    paymentMethod?: PaymentMethod;
    paidByWorkerId?: string | null;
    receiptFilePath?: string | null;
    notes?: string | null;
    actor: AuditActor;
    receivedByType: "worker" | "admin";
    receivedById: string;
    receivedAt?: string | null;
  }
): Promise<{ orderId: string }> {
  const { data, error } = await supabase.rpc("record_vendor_order", {
    p_business_id: opts.businessId,
    p_vendor_id: opts.vendorId,
    p_amount: opts.amount,
    p_paid: opts.paid,
    p_payment_method: opts.paid ? (opts.paymentMethod ?? "cash") : null,
    p_paid_by_worker_id: opts.paid ? (opts.paidByWorkerId ?? null) : null,
    p_received_by_type: opts.receivedByType,
    p_received_by_id: opts.receivedById,
    p_receipt_file_path: opts.receiptFilePath ?? null,
    p_notes: opts.notes ?? null,
    ...actorParams(opts.actor),
    p_received_at: opts.receivedAt ?? null,
  });

  if (error) throw vendorRpcError(error, "שמירת קבלת הסחורה נכשלה");
  return { orderId: data as string };
}

/**
 * Edits a goods arrival end to end — vendor, amount, paid flag, method,
 * who paid, receipt photo, note and the arrival time itself. A null
 * `receiptFilePath` keeps the photo already on file; a null `receivedAt`
 * keeps the day the arrival is already on.
 */
export async function updateVendorOrder(
  supabase: SupabaseClient,
  opts: {
    businessId: string;
    orderId: string;
    vendorId: string;
    amount: number;
    paid: boolean;
    paymentMethod?: PaymentMethod;
    paidByWorkerId?: string | null;
    receiptFilePath?: string | null;
    notes?: string | null;
    actor: AuditActor;
    receivedAt?: string | null;
  }
): Promise<void> {
  const { error } = await supabase.rpc("update_vendor_order", {
    p_business_id: opts.businessId,
    p_order_id: opts.orderId,
    p_vendor_id: opts.vendorId,
    p_amount: opts.amount,
    p_paid: opts.paid,
    p_payment_method: opts.paid ? (opts.paymentMethod ?? "cash") : null,
    p_paid_by_worker_id: opts.paid ? (opts.paidByWorkerId ?? null) : null,
    p_receipt_file_path: opts.receiptFilePath ?? null,
    p_notes: opts.notes ?? null,
    ...actorParams(opts.actor),
    p_received_at: opts.receivedAt ?? null,
  });

  if (error) throw vendorRpcError(error, "העדכון נכשל");
}

export async function deleteVendorOrder(
  supabase: SupabaseClient,
  opts: { businessId: string; orderId: string; actor: AuditActor }
): Promise<void> {
  const { error } = await supabase.rpc("delete_vendor_order", {
    p_business_id: opts.businessId,
    p_order_id: opts.orderId,
    ...actorParams(opts.actor),
  });

  if (error) throw vendorRpcError(error, "המחיקה נכשלה");
}

/**
 * תשלום חוב לספק — pays a specific unpaid vendor order (marks it paid)
 * or a custom amount toward total debt. Rejected when it would pay a
 * billed vendor more than it is owed.
 */
export async function recordVendorPayment(
  supabase: SupabaseClient,
  opts: {
    businessId: string;
    vendorId: string;
    amount: number;
    method: PaymentMethod;
    vendorOrderId?: string | null;
    paidByType: "worker" | "admin";
    paidById: string;
    proofFilePath?: string | null;
    notes?: string | null;
    actor: AuditActor;
  }
): Promise<{ paymentId: string }> {
  const { data, error } = await supabase.rpc("record_vendor_payment", {
    p_business_id: opts.businessId,
    p_vendor_id: opts.vendorId,
    p_vendor_order_id: opts.vendorOrderId ?? null,
    p_amount: opts.amount,
    p_method: opts.method,
    p_paid_by_type: opts.paidByType,
    p_paid_by_id: opts.paidById,
    p_proof_file_path: opts.proofFilePath ?? null,
    p_notes: opts.notes ?? null,
    ...actorParams(opts.actor),
  });

  if (error) throw vendorRpcError(error, "שמירת התשלום נכשלה");
  return { paymentId: data as string };
}

/**
 * Edits a debt payment end to end — vendor, invoice, amount, method, who
 * paid, proof and note. A null `proofFilePath` keeps the proof already on
 * file. The debt cap is re-checked ignoring this payment's own rows.
 */
export async function updateVendorPayment(
  supabase: SupabaseClient,
  opts: {
    businessId: string;
    paymentId: string;
    vendorId: string;
    vendorOrderId?: string | null;
    amount: number;
    method: PaymentMethod;
    paidById?: string | null;
    proofFilePath?: string | null;
    notes?: string | null;
    actor: AuditActor;
  }
): Promise<void> {
  const { error } = await supabase.rpc("update_vendor_payment", {
    p_business_id: opts.businessId,
    p_payment_id: opts.paymentId,
    p_vendor_id: opts.vendorId,
    p_vendor_order_id: opts.vendorOrderId ?? null,
    p_amount: opts.amount,
    p_method: opts.method,
    p_paid_by_id: opts.paidById ?? null,
    p_proof_file_path: opts.proofFilePath ?? null,
    p_notes: opts.notes ?? null,
    ...actorParams(opts.actor),
  });

  if (error) throw vendorRpcError(error, "העדכון נכשל");
}

export async function deleteVendorPayment(
  supabase: SupabaseClient,
  opts: { businessId: string; paymentId: string; actor: AuditActor }
): Promise<void> {
  const { error } = await supabase.rpc("delete_vendor_payment", {
    p_business_id: opts.businessId,
    p_payment_id: opts.paymentId,
    ...actorParams(opts.actor),
  });

  if (error) throw vendorRpcError(error, "המחיקה נכשלה");
}
