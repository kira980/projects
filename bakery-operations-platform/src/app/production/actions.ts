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
import { computeShortageOrder, isValidPrepared } from "@/lib/production/shortage";
import {
  checkLoginAllowed,
  recordLoginFailure,
  recordLoginSuccess,
} from "@/lib/auth-throttle";

export type ProductionResult = { ok: boolean; error?: string };

export type ShortageEntry = { itemId: string; preparedQuantity: number };

/**
 * Report a production shortage (ناقص): the baker prepared fewer units than
 * ordered for some items. Saves original/prepared/missing per item,
 * recomputes line totals and the order total, and marks the order.
 * Prepared quantity must be between 0 and the ordered quantity.
 */
export async function reportShortage(
  orderId: string,
  entries: ShortageEntry[],
  note?: string
): Promise<ProductionResult> {
  const session = await getWorkerSession("production");
  if (!session) redirect("/production");

  const supabase = createServiceClient();

  const { data: order } = await supabase
    .from("orders")
    .select("id, order_number, status")
    .eq("id", orderId)
    .eq("business_id", session.businessId)
    .single();
  if (!order) return { ok: false, error: "ההזמנה לא נמצאה" };

  const { data: items } = await supabase
    .from("order_items")
    .select("id, quantity, original_quantity, unit_price")
    .eq("order_id", orderId)
    .eq("business_id", session.businessId);
  if (!items || items.length === 0) return { ok: false, error: "אין פריטים בהזמנה" };

  const preparedById = new Map(entries.map((e) => [e.itemId, e.preparedQuantity]));

  // Validate every entry against its ordered quantity before writing.
  const rows = items.map((it) => {
    const ordered = Number(it.original_quantity ?? it.quantity);
    const prepared = preparedById.has(it.id)
      ? Number(preparedById.get(it.id))
      : ordered;
    return { id: it.id, ordered, prepared, unitPrice: Number(it.unit_price) };
  });

  for (const r of rows) {
    if (!isValidPrepared(r.prepared, r.ordered)) {
      return { ok: false, error: "כמות מוכנה חייבת להיות בין 0 לכמות שהוזמנה" };
    }
  }

  const computed = computeShortageOrder(
    rows.map((r) => ({
      orderedQuantity: r.ordered,
      preparedQuantity: r.prepared,
      unitPrice: r.unitPrice,
    }))
  );

  // Persist per-item shortage numbers.
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const c = computed.items[i];
    const { error } = await supabase
      .from("order_items")
      .update({
        original_quantity: c.originalQuantity,
        prepared_quantity: c.preparedQuantity,
        missing_quantity: c.missingQuantity,
        quantity: c.preparedQuantity,
        line_total: c.lineTotal,
      })
      .eq("id", r.id)
      .eq("business_id", session.businessId);
    if (error) return { ok: false, error: "עדכון הפריטים נכשל" };
  }

  const { error: orderErr } = await supabase
    .from("orders")
    .update({
      original_total: computed.originalTotal,
      updated_total: computed.updatedTotal,
      total: computed.updatedTotal,
      has_shortage: computed.hasShortage,
      shortage_note: note?.trim() || null,
      status: computed.hasShortage ? "shortage" : order.status,
    })
    .eq("id", orderId)
    .eq("business_id", session.businessId);
  if (orderErr) return { ok: false, error: "עדכון ההזמנה נכשל" };

  await createAuditLog(supabase, {
    businessId: session.businessId,
    actor: { type: "worker", id: session.workerId, name: session.name },
    action: "order.shortage",
    entityType: "order",
    entityId: orderId,
    details: {
      order_number: order.order_number,
      original_total: computed.originalTotal,
      updated_total: computed.updatedTotal,
      note: note?.trim() || null,
    },
  });

  return { ok: true };
}

/** Passcode login limited to workers flagged as bakers. */
export async function productionLogin(
  passcode: string
): Promise<ProductionResult> {
  if (!/^\d{4}$/.test(passcode)) return { ok: false, error: "קוד לא תקין" };

  const locked = await checkLoginAllowed("production");
  if (locked) return { ok: false, error: locked };

  const supabase = createServiceClient();
  const { data: workers, error } = await supabase
    .from("workers")
    .select(
      "id, business_id, full_name, passcode_hash, can_manage_shift, is_baker"
    )
    .eq("is_active", true)
    .eq("is_baker", true)
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
    await recordLoginFailure("production");
    return { ok: false, error: "קוד שגוי או שאין הרשאת אופה" };
  }

  await recordLoginSuccess("production");
  await createWorkerSession("production", matched);
  await createAuditLog(supabase, {
    businessId: matched.business_id,
    actor: { type: "worker", id: matched.id, name: matched.full_name },
    action: "production.login",
  });
  return { ok: true };
}

export async function productionLogout(): Promise<void> {
  await destroyWorkerSession("production");
  redirect("/production");
}

export type PushSubscriptionInput = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

/**
 * Stores this browser's Web Push subscription so the server can notify
 * the production screen when a new order is created. Scoped to the
 * baker's business via the signed production session.
 */
export async function savePushSubscription(
  sub: PushSubscriptionInput
): Promise<ProductionResult> {
  const session = await getWorkerSession("production");
  if (!session) return { ok: false, error: "אין הרשאה" };
  if (!sub?.endpoint || !sub.p256dh || !sub.auth) {
    return { ok: false, error: "מנוי לא תקין" };
  }

  const supabase = createServiceClient();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      business_id: session.businessId,
      scope: "production",
      endpoint: sub.endpoint,
      p256dh: sub.p256dh,
      auth: sub.auth,
      worker_id: session.workerId,
    },
    { onConflict: "endpoint" }
  );

  if (error) {
    console.error("[push] savePushSubscription failed:", error.message);
    return { ok: false, error: "שמירת ההתראות נכשלה" };
  }
  return { ok: true };
}

/** Removes a browser's push subscription (e.g. when alerts are turned off). */
export async function removePushSubscription(
  endpoint: string
): Promise<ProductionResult> {
  const session = await getWorkerSession("production");
  if (!session) return { ok: false, error: "אין הרשאה" };
  if (!endpoint) return { ok: true };

  const supabase = createServiceClient();
  await supabase
    .from("push_subscriptions")
    .delete()
    .eq("business_id", session.businessId)
    .eq("endpoint", endpoint);
  return { ok: true };
}

const PRODUCTION_STATUSES = ["preparing", "ready", "problem"] as const;
type ProductionStatus = (typeof PRODUCTION_STATUSES)[number];

export async function setProductionStatus(
  orderId: string,
  status: ProductionStatus
): Promise<ProductionResult> {
  const session = await getWorkerSession("production");
  if (!session) redirect("/production");

  if (!PRODUCTION_STATUSES.includes(status)) {
    return { ok: false, error: "סטטוס לא תקין" };
  }

  const supabase = createServiceClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id, status, order_number")
    .eq("id", orderId)
    .eq("business_id", session.businessId)
    .single();

  if (!order) return { ok: false, error: "ההזמנה לא נמצאה" };

  const { error } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", orderId);

  if (error) return { ok: false, error: "עדכון הסטטוס נכשל" };

  await createAuditLog(supabase, {
    businessId: session.businessId,
    actor: { type: "worker", id: session.workerId, name: session.name },
    action: "order.production_status",
    entityType: "order",
    entityId: orderId,
    details: { from: order.status, to: status, order_number: order.order_number },
  });

  return { ok: true };
}

/** "הכל מוכן" — bulk-marks the given orders ready (only if currently new/preparing). */
export async function markAllReady(orderIds: string[]): Promise<ProductionResult> {
  const session = await getWorkerSession("production");
  if (!session) redirect("/production");

  if (orderIds.length === 0) return { ok: true };

  const supabase = createServiceClient();
  // Every prep status the screen shows, so "הכל מוכן" clears exactly what
  // it counted — including orders left in problem / shortage.
  const { data: orders } = await supabase
    .from("orders")
    .select("id, order_number")
    .eq("business_id", session.businessId)
    .in("id", orderIds)
    .in("status", ["new", "preparing", "problem", "shortage"]);

  if (!orders || orders.length === 0) return { ok: true };

  const { error } = await supabase
    .from("orders")
    .update({ status: "ready" })
    .in(
      "id",
      orders.map((o) => o.id)
    );

  if (error) return { ok: false, error: "עדכון ההזמנות נכשל" };

  await createAuditLog(supabase, {
    businessId: session.businessId,
    actor: { type: "worker", id: session.workerId, name: session.name },
    action: "order.mark_all_ready",
    details: { order_ids: orders.map((o) => o.id), count: orders.length },
  });

  return { ok: true };
}
