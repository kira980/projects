"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { createServiceClient } from "@/lib/supabase/server";
import {
  createWorkerSession,
  destroyWorkerSession,
  getWorkerSession,
  type WorkerSession,
} from "@/lib/kiosk/session";
import { createAuditLog } from "@/lib/db/audit";
import {
  checkLoginAllowed,
  recordLoginFailure,
  recordLoginSuccess,
} from "@/lib/auth-throttle";
import {
  assertDayIsOpen,
  businessToday,
  localInstantToday,
  MAX_CLOCK_BACKDATE_HOURS,
} from "@/lib/db/day-lock";
import { formatDateTime, toTimeInput } from "@/lib/format";

export type KioskResult = {
  ok: boolean;
  error?: string;
  /** For the smart shift button: what happened. */
  info?: string;
};

async function requireKioskSession(): Promise<WorkerSession> {
  const session = await getWorkerSession("kiosk");
  if (!session) redirect("/workers");
  return session;
}

/** Verify a passcode against active workers and open a kiosk session. */
export async function kioskLogin(passcode: string): Promise<KioskResult> {
  if (!/^\d{4}$/.test(passcode)) {
    return { ok: false, error: "קוד לא תקין" };
  }

  const locked = await checkLoginAllowed("kiosk");
  if (locked) return { ok: false, error: locked };

  const supabase = createServiceClient();
  const { data: workers, error } = await supabase
    .from("workers")
    .select(
      "id, business_id, full_name, passcode_hash, can_manage_shift, is_baker, is_admin"
    )
    .eq("is_active", true)
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
    await recordLoginFailure("kiosk");
    return { ok: false, error: "קוד שגוי" };
  }

  await recordLoginSuccess("kiosk");
  await createWorkerSession("kiosk", matched);
  await createAuditLog(supabase, {
    businessId: matched.business_id,
    actor: { type: "worker", id: matched.id, name: matched.full_name },
    action: "kiosk.login",
  });
  return { ok: true };
}

export async function kioskLogout(): Promise<void> {
  await destroyWorkerSession("kiosk");
  redirect("/workers");
}

/**
 * Smart shift button: ends the open shift if one exists, otherwise
 * starts a new one.
 */
export async function toggleShift(): Promise<KioskResult> {
  const session = await requireKioskSession();
  const supabase = createServiceClient();

  const { data: openShift, error: findErr } = await supabase
    .from("worker_shifts")
    .select("id, started_at")
    .eq("worker_id", session.workerId)
    .is("ended_at", null)
    .maybeSingle();

  if (findErr) return { ok: false, error: "שגיאת מערכת, נסו שוב" };

  if (openShift) {
    const { error } = await supabase
      .from("worker_shifts")
      .update({
        ended_at: new Date().toISOString(),
        ended_by_type: "worker",
        ended_by_id: session.workerId,
      })
      .eq("id", openShift.id);
    if (error) return { ok: false, error: "סיום המשמרת נכשל" };

    await createAuditLog(supabase, {
      businessId: session.businessId,
      actor: { type: "worker", id: session.workerId, name: session.name },
      action: "shift.end",
      entityType: "worker_shift",
      entityId: openShift.id,
    });
    return { ok: true, info: "המשמרת הסתיימה. עבודה נעימה!" };
  }

  const { data: shift, error } = await supabase
    .from("worker_shifts")
    .insert({
      business_id: session.businessId,
      worker_id: session.workerId,
      started_by_type: "worker",
      started_by_id: session.workerId,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: "פתיחת המשמרת נכשלה" };

  await createAuditLog(supabase, {
    businessId: session.businessId,
    actor: { type: "worker", id: session.workerId, name: session.name },
    action: "shift.start",
    entityType: "worker_shift",
    entityId: shift.id,
  });
  return { ok: true, info: "המשמרת נפתחה. בהצלחה!" };
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Shift manager clocks another worker in or out.
 *
 * `time` is an Israel-local HH:MM the manager may correct on the
 * confirmation box — someone clocked out at 22:00 and only got to the
 * tablet at 22:20. Omitted means now. It is always read as TODAY's
 * occurrence: a reading still ahead of the clock is refused with the
 * current time in the message, rather than quietly taken to mean
 * yesterday (which used to file the shift a day early).
 *
 * A clock-in is refused if it resolves to more than
 * MAX_CLOCK_BACKDATE_HOURS ago, because signing someone in "now" can
 * never mean half a day back. Genuine back-dating is the dashboard's job,
 * where the date is on screen.
 *
 * Audit: actor = the shift manager, affected worker = the target.
 */
export async function clockOtherWorker(
  targetWorkerId: string,
  direction: "in" | "out",
  time?: string
): Promise<KioskResult> {
  const session = await requireKioskSession();
  if (!session.canManageShift) {
    return { ok: false, error: "אין לך הרשאת אחראי משמרת" };
  }

  if (time && !TIME_RE.test(time)) {
    return { ok: false, error: "שעה לא תקינה" };
  }

  let at: string;
  if (time) {
    const resolved = localInstantToday(time);
    if (!resolved) {
      return {
        ok: false,
        error: `השעה ${time} עוד לא הגיעה — השעה עכשיו ${toTimeInput(new Date())}`,
      };
    }
    at = resolved;
  } else {
    at = new Date().toISOString();
  }

  if (
    direction === "in" &&
    Date.now() - Date.parse(at) > MAX_CLOCK_BACKDATE_HOURS * 3600_000
  ) {
    return {
      ok: false,
      error: `שעת כניסה רחוקה מדי (${toTimeInput(at)}) — לרישום משמרת מתאריך אחר יש לפנות למנהל`,
    };
  }

  const supabase = createServiceClient();

  const { data: target } = await supabase
    .from("workers")
    .select("id, full_name, business_id, is_active")
    .eq("id", targetWorkerId)
    .eq("business_id", session.businessId)
    .single();

  if (!target || !target.is_active) {
    return { ok: false, error: "העובד לא נמצא" };
  }

  const { data: openShift } = await supabase
    .from("worker_shifts")
    .select("id, started_at")
    .eq("worker_id", target.id)
    .is("ended_at", null)
    .maybeSingle();

  if (direction === "in") {
    if (openShift) {
      return { ok: false, error: `ל${target.full_name} כבר יש משמרת פתוחה` };
    }
    const { data: shift, error } = await supabase
      .from("worker_shifts")
      .insert({
        business_id: session.businessId,
        worker_id: target.id,
        started_at: at,
        started_by_type: "worker",
        started_by_id: session.workerId,
      })
      .select("id")
      .single();
    if (error) return { ok: false, error: "פתיחת המשמרת נכשלה" };

    await createAuditLog(supabase, {
      businessId: session.businessId,
      actor: { type: "worker", id: session.workerId, name: session.name },
      action: "shift.start_by_manager",
      entityType: "worker_shift",
      entityId: shift.id,
      affectedWorkerId: target.id,
      details: { worker_name: target.full_name, started_at: at },
    });
    return {
      ok: true,
      info: `${target.full_name} הוחתם/ה לכניסה ב־${formatDateTime(at)}`,
    };
  }

  if (!openShift) {
    return { ok: false, error: `ל${target.full_name} אין משמרת פתוחה` };
  }
  if (Date.parse(at) <= Date.parse(openShift.started_at)) {
    return {
      ok: false,
      error: `שעת היציאה לפני הכניסה (${toTimeInput(openShift.started_at)})`,
    };
  }
  const { error } = await supabase
    .from("worker_shifts")
    .update({
      ended_at: at,
      ended_by_type: "worker",
      ended_by_id: session.workerId,
    })
    .eq("id", openShift.id);
  if (error) return { ok: false, error: "סיום המשמרת נכשל" };

  await createAuditLog(supabase, {
    businessId: session.businessId,
    actor: { type: "worker", id: session.workerId, name: session.name },
    action: "shift.end_by_manager",
    entityType: "worker_shift",
    entityId: openShift.id,
    affectedWorkerId: target.id,
    details: { worker_name: target.full_name, ended_at: at },
  });
  return {
    ok: true,
    info: `${target.full_name} הוחתם/ה ליציאה ב־${formatDateTime(at)}`,
  };
}

/**
 * Hands an order to the customer from the counter: איסוף עצמי orders are
 * marked נאסף, delivery orders נמסר. The order becomes "delivered" only
 * here (or when the driver completes the delivery) — never by hand in the
 * dashboard. Paid orders also record the outstanding amount as a cash
 * payment against the customer's debt.
 */
export async function collectOrder(
  orderId: string,
  paid: boolean
): Promise<KioskResult> {
  const session = await requireKioskSession();
  if (!session.canManageShift) {
    return { ok: false, error: "אין לך הרשאת אחראי משמרת" };
  }

  const supabase = createServiceClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id, order_number, customer_id, total, delivery_type, status")
    .eq("id", orderId)
    .eq("business_id", session.businessId)
    .single();

  if (!order) return { ok: false, error: "ההזמנה לא נמצאה" };

  const isDelivery = order.delivery_type === "delivery";
  const handedLabel = isDelivery ? "נמסרה" : "נאספה";

  // What is still owed on this order right now.
  const { data: existingPayments } = await supabase
    .from("payments")
    .select("amount")
    .eq("order_id", orderId);
  const paidSoFar = (existingPayments ?? []).reduce(
    (sum, p) => sum + Number(p.amount),
    0
  );
  const remaining = Math.max(0, Number(order.total) - paidSoFar);

  if (paid && remaining > 0) {
    try {
      await assertDayIsOpen(supabase, session.businessId);
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }

    const { data: payment, error: payErr } = await supabase
      .from("payments")
      .insert({
        business_id: session.businessId,
        customer_id: order.customer_id,
        order_id: orderId,
        amount: remaining,
        method: "cash",
        collected_by_type: "worker",
        collected_by_id: session.workerId,
        notes: isDelivery ? "נמסר בדלפק" : "נאסף בבית העסק",
      })
      .select("id")
      .single();
    if (payErr) return { ok: false, error: "רישום התשלום נכשל" };

    const { error: ledgerErr } = await supabase
      .from("customer_ledger_entries")
      .insert({
        business_id: session.businessId,
        customer_id: order.customer_id,
        entry_type: "payment",
        amount: remaining,
        order_id: orderId,
        payment_id: payment.id,
        description: `תשלום להזמנה #${order.order_number}`,
      });
    if (ledgerErr) return { ok: false, error: "רישום החוב נכשל" };
  }

  // Delivery orders get the same delivery record the driver app writes, so
  // the order has a delivery attached however it was handed over.
  if (isDelivery) {
    const { data: alreadyDelivered } = await supabase
      .from("delivery_orders")
      .select("id")
      .eq("order_id", orderId)
      .maybeSingle();

    if (!alreadyDelivered) {
      const day = businessToday();
      let { data: container } = await supabase
        .from("deliveries")
        .select("id")
        .eq("business_id", session.businessId)
        .eq("delivery_date", day)
        .is("driver_worker_id", null)
        .maybeSingle();

      if (!container) {
        const { data: created } = await supabase
          .from("deliveries")
          .insert({ business_id: session.businessId, delivery_date: day })
          .select("id")
          .single();
        container = created;
      }

      if (container) {
        await supabase.from("delivery_orders").insert({
          business_id: session.businessId,
          delivery_id: container.id,
          order_id: orderId,
          status: paid ? "delivered_paid" : "delivered_unpaid",
          collected_amount: paid ? remaining : 0,
          payment_method: paid && remaining > 0 ? "cash" : null,
          completed_at: new Date().toISOString(),
          completed_by_worker_id: session.workerId,
        });
      }
    }
  }

  // Payment status is recomputed from all payments, not assumed.
  const { data: allPayments } = await supabase
    .from("payments")
    .select("amount")
    .eq("order_id", orderId);
  const paidSum = (allPayments ?? []).reduce(
    (sum, p) => sum + Number(p.amount),
    0
  );

  const { error: orderErr } = await supabase
    .from("orders")
    .update({
      status: "delivered",
      payment_status:
        paidSum >= Number(order.total) ? "paid" : paidSum > 0 ? "partial" : "unpaid",
    })
    .eq("id", orderId)
    .eq("business_id", session.businessId);
  if (orderErr) return { ok: false, error: "עדכון ההזמנה נכשל" };

  await createAuditLog(supabase, {
    businessId: session.businessId,
    actor: { type: "worker", id: session.workerId, name: session.name },
    action: isDelivery ? "order.handed_delivery" : "order.picked_up",
    entityType: "order",
    entityId: orderId,
    details: {
      order_number: order.order_number,
      paid,
      collected: paid ? remaining : 0,
    },
  });

  return {
    ok: true,
    info: `הזמנה #${order.order_number} ${handedLabel}${paid ? " ושולמה" : ""}`,
  };
}

/**
 * End of day (shift managers): records what was left in the register
 * (נשאר בקופה) for the current business day. Workers still on shift are
 * clocked out from the same screen — this only stores the register amount,
 * which the daily dashboard reads for its totals.
 */
export async function endDay(amountRaw: string): Promise<KioskResult> {
  const session = await requireKioskSession();
  if (!session.canManageShift) {
    return { ok: false, error: "אין לך הרשאת אחראי משמרת" };
  }

  const amount = Number(String(amountRaw).trim());
  if (!String(amountRaw).trim() || isNaN(amount) || amount < 0) {
    return { ok: false, error: "סכום נשאר בקופה לא תקין" };
  }

  const supabase = createServiceClient();
  try {
    await assertDayIsOpen(supabase, session.businessId);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const day = businessToday();
  // Only left_in_register is written, so an existing row keeps the
  // counter sales the admin already entered for the day.
  const { error } = await supabase.from("daily_sales").upsert(
    {
      business_id: session.businessId,
      sales_date: day,
      left_in_register: amount,
    },
    { onConflict: "business_id,sales_date" }
  );

  if (error) return { ok: false, error: "שמירת סיום היום נכשלה" };

  const { count: stillOpen } = await supabase
    .from("worker_shifts")
    .select("id", { count: "exact", head: true })
    .eq("business_id", session.businessId)
    .is("ended_at", null);

  await createAuditLog(supabase, {
    businessId: session.businessId,
    actor: { type: "worker", id: session.workerId, name: session.name },
    action: "day.end",
    entityType: "daily_sales",
    details: {
      sales_date: day,
      left_in_register: amount,
      open_shifts_left: stillOpen ?? 0,
    },
  });

  return { ok: true, info: "היום הסתיים ונשמר. תודה!" };
}

export type AdvanceWorker = {
  id: string;
  full_name: string;
  /** Whether the worker currently has an open shift. */
  on_shift: boolean;
};

/**
 * Worker lists for the advance screen (shift managers only): workers on an
 * active shift, plus every eligible active worker for the "Other Worker"
 * search.
 */
export async function getAdvanceWorkers(): Promise<{
  ok: boolean;
  error?: string;
  shiftWorkers?: AdvanceWorker[];
  allWorkers?: AdvanceWorker[];
}> {
  const session = await requireKioskSession();
  if (!session.canManageShift) {
    return { ok: false, error: "אין לך הרשאת אחראי משמרת" };
  }
  const supabase = createServiceClient();

  const [{ data: workers }, { data: openShifts }] = await Promise.all([
    supabase
      .from("workers")
      .select("id, full_name")
      .eq("business_id", session.businessId)
      .eq("is_active", true)
      .order("full_name"),
    supabase
      .from("worker_shifts")
      .select("worker_id")
      .eq("business_id", session.businessId)
      .is("ended_at", null),
  ]);

  const onShift = new Set((openShifts ?? []).map((s) => s.worker_id));
  const all: AdvanceWorker[] = (workers ?? []).map((w) => ({
    id: w.id,
    full_name: w.full_name,
    on_shift: onShift.has(w.id),
  }));

  return {
    ok: true,
    shiftWorkers: all.filter((w) => w.on_shift),
    allWorkers: all,
  };
}

/**
 * Shift manager gives an advance to a worker. Only shift managers may
 * create advances. Saves the target worker, amount, time, the target's
 * open shift, the giving manager (given_by_worker_id), and how the worker
 * was selected (from the active shift vs. "other worker" search).
 */
export async function giveAdvance(
  targetWorkerId: string,
  amount: number,
  source: "shift" | "other",
  notes?: string
): Promise<KioskResult> {
  const session = await requireKioskSession();
  if (!session.canManageShift) {
    return { ok: false, error: "אין לך הרשאת אחראי משמרת" };
  }
  const supabase = createServiceClient();

  if (!amount || isNaN(amount) || amount <= 0 || amount > 10000) {
    return { ok: false, error: "סכום לא תקין" };
  }
  if (source !== "shift" && source !== "other") {
    return { ok: false, error: "מקור בחירה לא תקין" };
  }

  const { data: target } = await supabase
    .from("workers")
    .select("id, full_name, is_active")
    .eq("id", targetWorkerId)
    .eq("business_id", session.businessId)
    .single();
  if (!target || !target.is_active) {
    return { ok: false, error: "העובד לא נמצא" };
  }

  try {
    await assertDayIsOpen(supabase, session.businessId);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const { data: openShift } = await supabase
    .from("worker_shifts")
    .select("id")
    .eq("worker_id", target.id)
    .is("ended_at", null)
    .maybeSingle();

  const { data: advance, error } = await supabase
    .from("worker_advances")
    .insert({
      business_id: session.businessId,
      worker_id: target.id,
      amount,
      method: "cash",
      given_by_type: "worker",
      given_by_id: session.workerId,
      given_by_worker_id: session.workerId,
      worker_source: source,
      shift_id: openShift?.id ?? null,
      notes: notes || null,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: "שמירת המפרעה נכשלה" };

  await createAuditLog(supabase, {
    businessId: session.businessId,
    actor: { type: "worker", id: session.workerId, name: session.name },
    action: "advance.give",
    entityType: "worker_advance",
    entityId: advance.id,
    affectedWorkerId: target.id,
    details: { amount, worker_name: target.full_name, source },
  });
  return { ok: true, info: `נרשמה מפרעה ל${target.full_name}` };
}
