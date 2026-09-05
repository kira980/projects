"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { createServiceClient } from "@/lib/supabase/server";
import {
  createWorkerSession,
  destroyWorkerSession,
  getWorkerSession,
} from "@/lib/kiosk/session";
import { createAuditLog } from "@/lib/db/audit";
import { assertDayIsOpen, businessToday } from "@/lib/db/day-lock";
import { uploadBusinessFile } from "@/lib/storage";
import { allocatePayment, type PayableOrder } from "@/lib/payments/allocation";
import {
  checkLoginAllowed,
  recordLoginFailure,
  recordLoginSuccess,
} from "@/lib/auth-throttle";

export type DriverResult = { ok: boolean; error?: string };

/**
 * Passcode login — only workers with the נהג (driver) permission may
 * enter the driver app. The session lasts 12h and doesn't re-prompt
 * during that window.
 */
export async function driverLogin(passcode: string): Promise<DriverResult> {
  if (!/^\d{4}$/.test(passcode)) return { ok: false, error: "קוד לא תקין" };

  const locked = await checkLoginAllowed("driver");
  if (locked) return { ok: false, error: locked };

  const supabase = createServiceClient();
  const { data: workers, error } = await supabase
    .from("workers")
    .select(
      "id, business_id, full_name, passcode_hash, can_manage_shift, is_baker"
    )
    .eq("is_active", true)
    .eq("is_driver", true)
    .not("passcode_hash", "is", null);

  if (error) return { ok: false, error: "שגיאת מערכת, נסו שוב" };

  let matched = null;
  for (const w of workers ?? []) {
    if (await bcrypt.compare(passcode, w.passcode_hash!)) {
      matched = w;
      break;
    }
  }

  if (!matched) {
    await recordLoginFailure("driver");
    return { ok: false, error: "קוד שגוי" };
  }

  await recordLoginSuccess("driver");
  await createWorkerSession("driver", matched);
  await createAuditLog(supabase, {
    businessId: matched.business_id,
    actor: { type: "worker", id: matched.id, name: matched.full_name },
    action: "driver.login",
  });
  return { ok: true };
}

export async function driverLogout(): Promise<void> {
  await destroyWorkerSession("driver");
  redirect("/driver");
}

const OUTCOMES = [
  "delivered_paid",
  "delivered_unpaid",
  "partial",
  "failed",
] as const;
type Outcome = (typeof OUTCOMES)[number];

/**
 * Driver completes a delivery stop: outcome + collected amount +
 * optional proof photo and note. Collected money is recorded as a
 * customer payment and reduces customer debt.
 *
 * Any active worker can complete any of today's open deliveries — there
 * is no assignment step. The delivery_orders row (and who delivered it,
 * from the session's own worker id) is created here, at completion.
 */
export async function completeDeliveryOrder(
  formData: FormData
): Promise<DriverResult> {
  const session = await getWorkerSession("driver");
  if (!session) redirect("/driver");

  const orderId = String(formData.get("order_id") ?? "");
  const outcome = String(formData.get("outcome") ?? "") as Outcome;
  const collected = Number(formData.get("collected_amount") ?? 0) || 0;
  const method = String(formData.get("method") ?? "cash");
  const notes = String(formData.get("driver_notes") ?? "").trim() || null;
  const proof = formData.get("proof") as File | null;

  if (!OUTCOMES.includes(outcome)) return { ok: false, error: "יש לבחור תוצאה" };
  if ((outcome === "delivered_paid" || outcome === "partial") && collected <= 0) {
    return { ok: false, error: "יש להזין סכום שנגבה" };
  }

  const supabase = createServiceClient();

  const { data: order } = await supabase
    .from("orders")
    .select("id, customer_id, total, order_number, delivery_type, status")
    .eq("id", orderId)
    .eq("business_id", session.businessId)
    .single();
  if (!order) return { ok: false, error: "ההזמנה לא נמצאה" };
  if (order.delivery_type !== "delivery") {
    return { ok: false, error: "ההזמנה אינה הזמנת משלוח" };
  }

  const { data: existing } = await supabase
    .from("delivery_orders")
    .select("id")
    .eq("order_id", orderId)
    .maybeSingle();
  if (existing) return { ok: false, error: "המשלוח כבר הושלם" };

  const today = businessToday();
  let { data: container } = await supabase
    .from("deliveries")
    .select("id")
    .eq("business_id", session.businessId)
    .eq("delivery_date", today)
    .is("driver_worker_id", null)
    .maybeSingle();

  if (!container) {
    const { data: created, error: containerErr } = await supabase
      .from("deliveries")
      .insert({ business_id: session.businessId, delivery_date: today })
      .select("id")
      .single();
    if (containerErr || !created) {
      console.error("deliveries insert failed", containerErr);
      return { ok: false, error: "שמירת המשלוח נכשלה" };
    }
    container = created;
  }

  try {
    if (collected > 0) {
      await assertDayIsOpen(supabase, session.businessId);
    }

    const proofPath = await uploadBusinessFile(supabase, {
      businessId: session.businessId,
      bucket: "proofs",
      folder: "deliveries",
      file: proof,
      entityType: "delivery_order",
      entityId: order.id,
      uploadedByType: "worker",
      uploadedById: session.workerId,
    });

    const validMethod = ["cash", "card", "transfer", "check", "other"].includes(
      method
    )
      ? method
      : "cash";

    const { data: deliveryOrder, error: insertErr } = await supabase
      .from("delivery_orders")
      .insert({
        business_id: session.businessId,
        delivery_id: container.id,
        order_id: order.id,
        status: outcome,
        collected_amount: collected,
        payment_method: collected > 0 ? validMethod : null,
        proof_file_path: proofPath,
        driver_notes: notes,
        completed_at: new Date().toISOString(),
        completed_by_worker_id: session.workerId,
      })
      .select("id, delivery_id")
      .single();

    if (insertErr || !deliveryOrder) {
      console.error("delivery_orders insert failed", insertErr);
      return { ok: false, error: "שמירת המשלוח נכשלה" };
    }

    // Record collected money as a customer payment.
    if (collected > 0) {
      const { data: payment } = await supabase
        .from("payments")
        .insert({
          business_id: session.businessId,
          customer_id: order.customer_id,
          order_id: order.id,
          delivery_id: deliveryOrder.delivery_id,
          amount: collected,
          method: validMethod,
          collected_by_type: "worker",
          collected_by_id: session.workerId,
          proof_file_path: proofPath,
          notes,
        })
        .select("id")
        .single();

      await supabase.from("customer_ledger_entries").insert({
        business_id: session.businessId,
        customer_id: order.customer_id,
        entry_type: "payment",
        amount: collected,
        order_id: order.id,
        payment_id: payment?.id ?? null,
        description: `גבייה במשלוח — הזמנה #${order.order_number}`,
      });

      const { data: allPayments } = await supabase
        .from("payments")
        .select("amount")
        .eq("order_id", order.id);
      const paidSum = (allPayments ?? []).reduce(
        (sum, p) => sum + Number(p.amount),
        0
      );
      await supabase
        .from("orders")
        .update({
          payment_status:
            paidSum >= Number(order.total)
              ? "paid"
              : paidSum > 0
                ? "partial"
                : "unpaid",
        })
        .eq("id", order.id);
    }

    // Update the order's delivery status.
    await supabase
      .from("orders")
      .update({ status: outcome === "failed" ? "problem" : "delivered" })
      .eq("id", order.id);

    await createAuditLog(supabase, {
      businessId: session.businessId,
      actor: { type: "worker", id: session.workerId, name: session.name },
      action: `delivery.${outcome}`,
      entityType: "delivery_order",
      entityId: deliveryOrder.id,
      details: {
        order_number: order.order_number,
        collected,
        method: collected > 0 ? validMethod : null,
      },
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  return { ok: true };
}

export type DriverDebtOrder = {
  id: string;
  order_number: number;
  delivery_date: string;
  total: number;
  paid: number;
  remaining: number;
};

/** Customer's unpaid/partial orders — used for the "pay against old debt" flow. */
export async function getCustomerDebtOrders(
  customerId: string
): Promise<DriverDebtOrder[]> {
  const session = await getWorkerSession("driver");
  if (!session) redirect("/driver");

  const supabase = createServiceClient();
  const { data: orders } = await supabase
    .from("orders")
    .select("id, order_number, delivery_date, total, payment_status")
    .eq("business_id", session.businessId)
    .eq("customer_id", customerId)
    .in("payment_status", ["unpaid", "partial"])
    .order("created_at", { ascending: false });

  if (!orders || orders.length === 0) return [];

  const orderIds = orders.map((o) => o.id);
  const [{ data: payments }, { data: allocations }] = await Promise.all([
    supabase.from("payments").select("order_id, amount").in("order_id", orderIds),
    supabase
      .from("payment_allocations")
      .select("order_id, amount")
      .in("order_id", orderIds),
  ]);

  const paidByOrder = new Map<string, number>();
  for (const p of payments ?? []) {
    paidByOrder.set(p.order_id, (paidByOrder.get(p.order_id) ?? 0) + Number(p.amount));
  }
  for (const a of allocations ?? []) {
    paidByOrder.set(a.order_id, (paidByOrder.get(a.order_id) ?? 0) + Number(a.amount));
  }

  return orders
    .map((o) => {
      const paid = paidByOrder.get(o.id) ?? 0;
      return {
        id: o.id,
        order_number: Number(o.order_number),
        delivery_date: o.delivery_date,
        total: Number(o.total),
        paid,
        remaining: Math.max(0, Number(o.total) - paid),
      };
    })
    .filter((o) => o.remaining > 0);
}

export type DebtOrderItem = {
  product_name: string;
  quantity: number;
  line_total: number;
};

/** Items of one debt order — shown when the driver expands it. */
export async function getDebtOrderItems(
  orderId: string
): Promise<DebtOrderItem[]> {
  const session = await getWorkerSession("driver");
  if (!session) redirect("/driver");

  const supabase = createServiceClient();
  const { data: items } = await supabase
    .from("order_items")
    .select("product_name, quantity, line_total")
    .eq("order_id", orderId)
    .eq("business_id", session.businessId)
    .order("created_at");

  return (items ?? []).map((i) => ({
    product_name: i.product_name,
    quantity: Number(i.quantity),
    line_total: Number(i.line_total),
  }));
}

/**
 * Record one debt payment that covers multiple unpaid / partially-paid
 * orders. The allocation across orders is computed and validated on the
 * server from authoritative balances — this prevents overpaying and
 * paying already-settled orders regardless of client state.
 */
export async function recordMultiOrderDebtPayment(
  formData: FormData
): Promise<DriverResult> {
  const session = await getWorkerSession("driver");
  if (!session) redirect("/driver");

  const customerId = String(formData.get("customer_id") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const method = String(formData.get("method") ?? "cash");
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const proof = formData.get("proof") as File | null;
  const selectedIds = String(formData.get("order_ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!customerId) return { ok: false, error: "יש לבחור לקוח" };
  if (selectedIds.length === 0) return { ok: false, error: "יש לבחור לפחות הזמנה אחת" };

  const supabase = createServiceClient();

  const { data: customer } = await supabase
    .from("customers")
    .select("id, name")
    .eq("id", customerId)
    .eq("business_id", session.businessId)
    .single();
  if (!customer) return { ok: false, error: "הלקוח לא נמצא" };

  // Re-fetch authoritative balances for the selected orders.
  const { data: orders } = await supabase
    .from("orders")
    .select("id, order_number, total")
    .eq("business_id", session.businessId)
    .eq("customer_id", customerId)
    .in("id", selectedIds);
  if (!orders || orders.length !== selectedIds.length) {
    return { ok: false, error: "אחת ההזמנות לא נמצאה" };
  }

  const orderIds = orders.map((o) => o.id);
  const [{ data: payments }, { data: allocs }] = await Promise.all([
    supabase.from("payments").select("order_id, amount").in("order_id", orderIds),
    supabase.from("payment_allocations").select("order_id, amount").in("order_id", orderIds),
  ]);
  const paidByOrder = new Map<string, number>();
  for (const p of payments ?? [])
    paidByOrder.set(p.order_id, (paidByOrder.get(p.order_id) ?? 0) + Number(p.amount));
  for (const a of allocs ?? [])
    paidByOrder.set(a.order_id, (paidByOrder.get(a.order_id) ?? 0) + Number(a.amount));

  const payable: PayableOrder[] = orders.map((o) => ({
    id: o.id,
    orderNumber: Number(o.order_number),
    total: Number(o.total),
    paid: paidByOrder.get(o.id) ?? 0,
  }));

  const allocation = allocatePayment(payable, selectedIds, amount);
  if (!allocation.ok) return { ok: false, error: allocation.error };

  try {
    await assertDayIsOpen(supabase, session.businessId);

    const proofPath = await uploadBusinessFile(supabase, {
      businessId: session.businessId,
      bucket: "proofs",
      folder: "debt-payments",
      file: proof,
      entityType: "customer_debt_payment",
      uploadedByType: "worker",
      uploadedById: session.workerId,
    });

    const validMethod = ["cash", "card", "transfer", "check", "other"].includes(method)
      ? method
      : "cash";

    const { data: payment, error } = await supabase
      .from("payments")
      .insert({
        business_id: session.businessId,
        customer_id: customerId,
        order_id: null,
        amount: allocation.total,
        method: validMethod,
        collected_by_type: "worker",
        collected_by_id: session.workerId,
        proof_file_path: proofPath,
        notes,
      })
      .select("id")
      .single();
    if (error || !payment) return { ok: false, error: "שמירת התשלום נכשלה" };

    const orderNumberById = new Map(payable.map((o) => [o.id, o.orderNumber]));

    for (const alloc of allocation.allocations) {
      await supabase.from("payment_allocations").insert({
        business_id: session.businessId,
        payment_id: payment.id,
        order_id: alloc.orderId,
        amount: alloc.amount,
      });
      await supabase.from("customer_ledger_entries").insert({
        business_id: session.businessId,
        customer_id: customerId,
        entry_type: "payment",
        amount: alloc.amount,
        order_id: alloc.orderId,
        payment_id: payment.id,
        description: `תשלום חוב — הזמנה #${orderNumberById.get(alloc.orderId)}`,
      });

      // Recompute this order's payment_status from all sources.
      const [{ data: op }, { data: oa }, { data: ord }] = await Promise.all([
        supabase.from("payments").select("amount").eq("order_id", alloc.orderId),
        supabase.from("payment_allocations").select("amount").eq("order_id", alloc.orderId),
        supabase.from("orders").select("total").eq("id", alloc.orderId).single(),
      ]);
      const paidSum =
        (op ?? []).reduce((s, p) => s + Number(p.amount), 0) +
        (oa ?? []).reduce((s, a) => s + Number(a.amount), 0);
      const total = Number(ord?.total ?? 0);
      await supabase
        .from("orders")
        .update({
          payment_status: paidSum >= total ? "paid" : paidSum > 0 ? "partial" : "unpaid",
        })
        .eq("id", alloc.orderId);
    }

    await createAuditLog(supabase, {
      businessId: session.businessId,
      actor: { type: "worker", id: session.workerId, name: session.name },
      action: "payment.driver_collect_multi",
      entityType: "payment",
      entityId: payment.id,
      details: {
        customer_id: customerId,
        amount: allocation.total,
        order_ids: allocation.allocations.map((a) => a.orderId),
      },
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  return { ok: true };
}

/**
 * Driver collects a payment toward a customer's debt — either a
 * specific old order, or an unassociated payment on account ("--").
 * Mirrors recordVendorPayment's optional-order pattern.
 */
export async function recordCustomerDebtPayment(
  formData: FormData
): Promise<DriverResult> {
  const session = await getWorkerSession("driver");
  if (!session) redirect("/driver");

  const customerId = String(formData.get("customer_id") ?? "");
  const orderId = String(formData.get("order_id") ?? "") || null;
  const amount = Number(formData.get("amount") ?? 0);
  const method = String(formData.get("method") ?? "cash");
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const proof = formData.get("proof") as File | null;

  if (!customerId) return { ok: false, error: "יש לבחור לקוח" };
  if (!amount || amount <= 0) return { ok: false, error: "יש להזין סכום" };

  const supabase = createServiceClient();

  const { data: customer } = await supabase
    .from("customers")
    .select("id, name")
    .eq("id", customerId)
    .eq("business_id", session.businessId)
    .single();
  if (!customer) return { ok: false, error: "הלקוח לא נמצא" };

  let order: { id: string; order_number: number; total: number } | null = null;
  if (orderId) {
    const { data } = await supabase
      .from("orders")
      .select("id, order_number, total")
      .eq("id", orderId)
      .eq("business_id", session.businessId)
      .eq("customer_id", customerId)
      .single();
    if (!data) return { ok: false, error: "ההזמנה לא נמצאה" };
    order = { id: data.id, order_number: Number(data.order_number), total: Number(data.total) };
  }

  try {
    await assertDayIsOpen(supabase, session.businessId);

    const proofPath = await uploadBusinessFile(supabase, {
      businessId: session.businessId,
      bucket: "proofs",
      folder: "debt-payments",
      file: proof,
      entityType: "customer_debt_payment",
      uploadedByType: "worker",
      uploadedById: session.workerId,
    });

    const validMethod = ["cash", "card", "transfer", "check", "other"].includes(method)
      ? method
      : "cash";

    const { data: payment, error } = await supabase
      .from("payments")
      .insert({
        business_id: session.businessId,
        customer_id: customerId,
        order_id: order?.id ?? null,
        amount,
        method: validMethod,
        collected_by_type: "worker",
        collected_by_id: session.workerId,
        proof_file_path: proofPath,
        notes,
      })
      .select("id")
      .single();

    if (error) return { ok: false, error: "שמירת התשלום נכשלה" };

    await supabase.from("customer_ledger_entries").insert({
      business_id: session.businessId,
      customer_id: customerId,
      entry_type: "payment",
      amount,
      order_id: order?.id ?? null,
      payment_id: payment.id,
      description: order
        ? `תשלום להזמנה #${order.order_number}`
        : "תשלום על חשבון חוב",
    });

    if (order) {
      const { data: allPayments } = await supabase
        .from("payments")
        .select("amount")
        .eq("order_id", order.id);
      const paidSum = (allPayments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
      await supabase
        .from("orders")
        .update({
          payment_status:
            paidSum >= order.total ? "paid" : paidSum > 0 ? "partial" : "unpaid",
        })
        .eq("id", order.id);
    }

    await createAuditLog(supabase, {
      businessId: session.businessId,
      actor: { type: "worker", id: session.workerId, name: session.name },
      action: "payment.driver_collect",
      entityType: "payment",
      entityId: payment.id,
      details: { customer_id: customerId, amount, order_id: order?.id ?? null },
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  return { ok: true };
}

export type PushSubscriptionInput = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

/**
 * Stores this browser's Web Push subscription under the "driver" scope so
 * the server can send a refresh-only (silent) push when a delivery order
 * is created — the open driver screen updates without an OS banner.
 */
export async function saveDriverPushSubscription(
  sub: PushSubscriptionInput
): Promise<DriverResult> {
  const session = await getWorkerSession("driver");
  if (!session) return { ok: false, error: "אין הרשאה" };
  if (!sub?.endpoint || !sub.p256dh || !sub.auth) {
    return { ok: false, error: "מנוי לא תקין" };
  }

  const supabase = createServiceClient();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      business_id: session.businessId,
      scope: "driver",
      endpoint: sub.endpoint,
      p256dh: sub.p256dh,
      auth: sub.auth,
      worker_id: session.workerId,
    },
    { onConflict: "endpoint" }
  );

  if (error) {
    console.error("[push] saveDriverPushSubscription failed:", error.message);
    return { ok: false, error: "שמירת ההתראות נכשלה" };
  }
  return { ok: true };
}
