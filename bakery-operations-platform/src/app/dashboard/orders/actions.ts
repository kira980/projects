"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { perfRequestId, timed } from "@/lib/perf";
import { requireAdmin } from "@/lib/auth";
import { createAuditLog } from "@/lib/db/audit";
import { assertDayIsOpen } from "@/lib/db/day-lock";
import {
  getPricedProductsForCustomer,
  type PricedProduct,
} from "@/lib/db/pricing";
import { takeDeliveryCode, takeTakeawayCode } from "@/lib/db/delivery-code";
import { takePublicDeliveryId } from "@/lib/deliveries/public-id";
import { sendPushToScope } from "@/lib/push/server";

export type ActionResult = { ok: boolean; error?: string; orderId?: string };

/**
 * Products priced for a customer — powers the admin order form and is
 * the same logic the future customer portal menu will use.
 */
export async function getCustomerPricedProducts(
  customerId: string
): Promise<PricedProduct[]> {
  const admin = await requireAdmin();
  const supabase = await createClient();
  return getPricedProductsForCustomer(supabase, admin.business_id, customerId);
}

export type RecentOrderSummary = {
  id: string;
  order_number: number;
  delivery_date: string;
  total: number;
  items: { product_id: string | null; product_name: string; quantity: number }[];
};

/**
 * Last orders for a customer — powers the "repeat order" picker in the
 * new-order form.
 */
export async function getCustomerRecentOrders(
  customerId: string
): Promise<RecentOrderSummary[]> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const { data: orders } = await supabase
    .from("orders")
    .select(
      "id, order_number, delivery_date, total, order_items(product_id, product_name, quantity)"
    )
    .eq("business_id", admin.business_id)
    .eq("customer_id", customerId)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(5);

  return (orders ?? []).map((o) => ({
    id: o.id,
    order_number: Number(o.order_number),
    delivery_date: o.delivery_date,
    total: Number(o.total),
    items: (
      o.order_items as unknown as {
        product_id: string | null;
        product_name: string;
        quantity: number;
      }[]
    ).map((i) => ({
      product_id: i.product_id,
      product_name: i.product_name,
      quantity: Number(i.quantity),
    })),
  }));
}

export type NewOrderItem = {
  product_id: string;
  quantity: number;
  notes?: string;
};

export type NewOrderInput = {
  customer_id: string;
  delivery_type: "delivery" | "pickup";
  delivery_date: string;
  delivery_time?: string;
  address_text?: string;
  notes?: string;
  notes_for_baker?: string;
  notes_for_driver?: string;
  /** Issue a קבלה / תעודת משלוח for this order (defaults from the customer). */
  receipt?: boolean;
  items: NewOrderItem[];
};

export async function createOrder(input: NewOrderInput): Promise<ActionResult> {
  const reqId = perfRequestId();
  const totalStart = performance.now();
  const admin = await timed(reqId, "auth (requireAdmin)", requireAdmin);
  const supabase = await createClient();

  if (!input.customer_id) return { ok: false, error: "יש לבחור לקוח" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.delivery_date)) {
    return { ok: false, error: "תאריך אספקה לא תקין" };
  }
  const items = (input.items ?? []).filter((i) => i.quantity > 0);
  if (items.length === 0) return { ok: false, error: "יש להוסיף פריטים להזמנה" };

  // Single round trip: day-lock check, server-side pricing, sequence
  // takes, and all four inserts run in one DB transaction (migration
  // 0014). RLS applies — the function runs as the caller.
  const { data, error } = await timed(reqId, "create_order_admin rpc", async () =>
    supabase.rpc("create_order_admin", {
      p_customer_id: input.customer_id,
      p_delivery_type: input.delivery_type,
      p_delivery_date: input.delivery_date,
      p_delivery_time: input.delivery_time?.trim() || null,
      p_address_text: input.address_text?.trim() || null,
      p_notes: input.notes?.trim() || null,
      p_notes_for_baker: input.notes_for_baker?.trim() || null,
      p_notes_for_driver: input.notes_for_driver?.trim() || null,
      p_items: items.map((i) => ({
        product_id: i.product_id,
        quantity: i.quantity,
        notes: i.notes?.trim() || null,
      })),
      p_actor_id: admin.id,
      p_actor_name: admin.full_name,
      p_receipt: input.receipt ?? false,
    })
  );

  if (error) {
    // Function not deployed yet (migration 0014 pending) — fall back to
    // the previous multi-query path so order creation keeps working.
    if (error.code === "PGRST202") {
      console.warn(
        "[orders] create_order_admin missing — using legacy path; apply migration 0014"
      );
      return createOrderLegacy(reqId, totalStart, admin, supabase, input, items);
    }
    if (error.message.includes("DAY_LOCKED")) {
      return {
        ok: false,
        error: "היום נעול — לא ניתן לבצע פעולות כספיות. פנה למנהל.",
      };
    }
    if (error.message.includes("PRODUCT_NOT_FOUND")) {
      return { ok: false, error: "מוצר לא נמצא" };
    }
    console.error(
      "[orders] create_order_admin failed:",
      error.code,
      error.message
    );
    return { ok: false, error: "שמירת ההזמנה נכשלה" };
  }

  const created = data as { order_id: string; order_number: number };

  // Notify the production (baker) screen — best-effort, after the
  // response is sent; never blocks or fails the order.
  const isDelivery = input.delivery_type !== "pickup";
  after(async () => {
    try {
      await timed(reqId, "push notification", () =>
        Promise.all([
          sendPushToScope(admin.business_id, "production", {
            title: "🥖 طلب جديد",
            body: `وصل طلب جديد #${created.order_number}`,
            url: "/production/orders",
            tag: `order-${created.order_id}`,
          }),
          // Delivery orders also refresh the driver screen — silent, so no
          // OS banner while the driver app is open.
          isDelivery
            ? sendPushToScope(admin.business_id, "driver", {
                title: "🚚 توصيلة جديدة",
                body: `وصلت توصيلة جديدة #${created.order_number}`,
                url: "/driver/orders",
                tag: `delivery-${created.order_id}`,
                silent: true,
              })
            : Promise.resolve(),
        ])
      );
    } catch {
      /* ignore push failures */
    }
  });

  revalidatePath("/dashboard/orders");
  console.info(
    `[perf] ${reqId} total createOrder: ${(performance.now() - totalStart).toFixed(0)} ms`
  );
  return { ok: true, orderId: created.order_id };
}

/**
 * Pre-0014 multi-query creation path. Kept only as a fallback while the
 * create_order_admin migration hasn't been applied — delete once it has.
 */
async function createOrderLegacy(
  reqId: string,
  totalStart: number,
  admin: Awaited<ReturnType<typeof requireAdmin>>,
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: NewOrderInput,
  items: NewOrderItem[]
): Promise<ActionResult> {
  // Day-lock check and pricing are independent reads — run together.
  // Server-side pricing: customer-specific price, fallback to default.
  // Never trust client prices.
  let priced: PricedProduct[];
  try {
    [, priced] = await timed(reqId, "day lock + load products", () =>
      Promise.all([
        assertDayIsOpen(supabase, admin.business_id),
        getPricedProductsForCustomer(
          supabase,
          admin.business_id,
          input.customer_id
        ),
      ])
    );
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const priceMap = new Map(priced.map((p) => [p.id, p]));

  const rows = [];
  let total = 0;
  for (const item of items) {
    const product = priceMap.get(item.product_id);
    if (!product) return { ok: false, error: "מוצר לא נמצא" };
    const lineTotal =
      Math.round(product.effective_price * item.quantity * 100) / 100;
    total += lineTotal;
    rows.push({
      product_id: product.id,
      product_name: product.name,
      product_name_ar: product.name_ar || null,
      unit_type: product.unit_type,
      quantity: item.quantity,
      unit_price: product.effective_price,
      line_total: lineTotal,
      notes: item.notes?.trim() || null,
    });
  }
  total = Math.round(total * 100) / 100;

  // The three sequence takes are independent of each other — run together.
  // As before, a failure after this point leaves harmless sequence gaps.
  const isDelivery = input.delivery_type !== "pickup";
  const [{ data: orderNumber, error: numErr }, deliveryCode, publicDeliveryId] =
    await timed(reqId, "take sequences (order#/code/public id)", () =>
      Promise.all([
        supabase.rpc("take_order_number", { p_business_id: admin.business_id }),
        isDelivery
          ? takeDeliveryCode(supabase, admin.business_id, input.delivery_date)
          : takeTakeawayCode(supabase, admin.business_id, input.delivery_date),
        isDelivery
          ? takePublicDeliveryId(supabase, admin.business_id)
          : Promise.resolve(null),
      ])
    );
  if (numErr || orderNumber === null) {
    return { ok: false, error: "יצירת מספר הזמנה נכשלה" };
  }

  const insertStart = performance.now();
  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      business_id: admin.business_id,
      customer_id: input.customer_id,
      order_number: orderNumber,
      delivery_type: isDelivery ? "delivery" : "pickup",
      delivery_code: deliveryCode,
      public_delivery_id: publicDeliveryId,
      delivery_date: input.delivery_date,
      delivery_time: input.delivery_time?.trim() || null,
      address_text: input.address_text?.trim() || null,
      total,
      original_total: total,
      updated_total: total,
      notes: input.notes?.trim() || null,
      notes_for_baker: input.notes_for_baker?.trim() || null,
      notes_for_driver: input.notes_for_driver?.trim() || null,
      receipt: input.receipt ?? false,
      created_by_type: "admin",
      created_by_id: admin.id,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: "שמירת ההזמנה נכשלה" };

  const { error: itemsErr } = await supabase.from("order_items").insert(
    rows.map((r) => ({
      business_id: admin.business_id,
      order_id: order.id,
      ...r,
    }))
  );
  if (itemsErr) {
    await supabase.from("orders").delete().eq("id", order.id);
    return { ok: false, error: "שמירת הפריטים נכשלה" };
  }
  console.info(
    `[perf] ${reqId} insert order + items: ${(performance.now() - insertStart).toFixed(0)} ms`
  );

  // Ledger charge and audit log are independent of each other.
  // Customer debt: charge at order creation, reversed on cancellation.
  await timed(reqId, "ledger + audit", () =>
    Promise.all([
      supabase.from("customer_ledger_entries").insert({
        business_id: admin.business_id,
        customer_id: input.customer_id,
        entry_type: "charge",
        amount: total,
        order_id: order.id,
        description: `הזמנה #${orderNumber}`,
      }),
      createAuditLog(supabase, {
        businessId: admin.business_id,
        actor: { type: "admin", id: admin.id, name: admin.full_name },
        action: "order.create",
        entityType: "order",
        entityId: order.id,
        details: { order_number: orderNumber, total, items: rows.length },
      }),
    ])
  );

  // Notify the production (baker) screen — best-effort, never blocks the
  // order. Runs after the response is sent; sendPushToScope swallows its
  // own errors, but guard anyway.
  after(async () => {
    try {
      await timed(reqId, "push notification", () =>
        Promise.all([
          sendPushToScope(admin.business_id, "production", {
            title: "🥖 طلب جديد",
            body: `وصل طلب جديد #${orderNumber}`,
            url: "/production/orders",
            tag: `order-${order.id}`,
          }),
          isDelivery
            ? sendPushToScope(admin.business_id, "driver", {
                title: "🚚 توصيلة جديدة",
                body: `وصلت توصيلة جديدة #${orderNumber}`,
                url: "/driver/orders",
                tag: `delivery-${order.id}`,
                silent: true,
              })
            : Promise.resolve(),
        ])
      );
    } catch {
      /* ignore push failures */
    }
  });

  revalidatePath("/dashboard/orders");
  console.info(
    `[perf] ${reqId} total createOrder: ${(performance.now() - totalStart).toFixed(0)} ms`
  );
  return { ok: true, orderId: order.id };
}

/**
 * Cancel = delete. The order and everything hanging off it go away: items,
 * documents, its delivery/takeaway record, payments taken against it, and
 * its debt-ledger entries — so the customer's debt lands exactly where it
 * was before the order existed. Statuses otherwise move on their own
 * (production marks ready; the delivery / pickup marks delivered).
 */
export async function deleteOrder(orderId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, status, total, customer_id, order_number, delivery_code, delivery_type, delivery_date"
    )
    .eq("id", orderId)
    .eq("business_id", admin.business_id)
    .single();

  if (!order) return { ok: false, error: "ההזמנה לא נמצאה" };

  // Issued קבלה / תעודת משלוח numbers are a legal series — record which
  // ones this deletion voids before they go with the order.
  const { data: docs } = await supabase
    .from("order_documents")
    .select("doc_type, doc_number")
    .eq("order_id", orderId)
    .eq("business_id", admin.business_id)
    .not("doc_number", "is", null);

  // Ledger first: leaving these behind would keep the debt on the customer,
  // since orders.id only nulls out of the ledger's order_id on delete.
  const { error: ledgerErr } = await supabase
    .from("customer_ledger_entries")
    .delete()
    .eq("order_id", orderId)
    .eq("business_id", admin.business_id);
  if (ledgerErr) return { ok: false, error: "מחיקת רישומי החוב נכשלה" };

  // Payments taken for this order (allocations cascade with them).
  const { error: payErr } = await supabase
    .from("payments")
    .delete()
    .eq("order_id", orderId)
    .eq("business_id", admin.business_id);
  if (payErr) return { ok: false, error: "מחיקת התשלומים נכשלה" };

  // The attached delivery / takeaway record. Cascades on the order delete
  // too, but done explicitly so a failure here stops the whole thing.
  const { error: deliveryErr } = await supabase
    .from("delivery_orders")
    .delete()
    .eq("order_id", orderId)
    .eq("business_id", admin.business_id);
  if (deliveryErr) return { ok: false, error: "מחיקת המשלוח נכשלה" };

  // Items and documents cascade with the order.
  const { error } = await supabase
    .from("orders")
    .delete()
    .eq("id", orderId)
    .eq("business_id", admin.business_id);

  if (error) return { ok: false, error: "מחיקת ההזמנה נכשלה" };

  await createAuditLog(supabase, {
    businessId: admin.business_id,
    actor: { type: "admin", id: admin.id, name: admin.full_name },
    action: "order.delete",
    entityType: "order",
    entityId: orderId,
    details: {
      order_number: order.order_number,
      delivery_code: order.delivery_code,
      delivery_type: order.delivery_type,
      delivery_date: order.delivery_date,
      total: Number(order.total),
      status_before: order.status,
      customer_id: order.customer_id,
      voided_documents: (docs ?? []).map((d) => ({
        type: d.doc_type,
        number: d.doc_number,
      })),
    },
  });

  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/deliveries");
  revalidatePath(`/dashboard/customers/${order.customer_id}`);
  return { ok: true };
}

export async function recordOrderPayment(
  orderId: string,
  amount: number,
  method: string,
  notes?: string
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  if (!amount || isNaN(amount) || amount <= 0) {
    return { ok: false, error: "סכום לא תקין" };
  }

  const { data: order } = await supabase
    .from("orders")
    .select("id, customer_id, total, order_number")
    .eq("id", orderId)
    .eq("business_id", admin.business_id)
    .single();

  if (!order) return { ok: false, error: "ההזמנה לא נמצאה" };

  try {
    await assertDayIsOpen(supabase, admin.business_id);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const validMethod = ["cash", "card", "transfer", "check", "other"].includes(
    method
  )
    ? method
    : "cash";

  const { data: payment, error } = await supabase
    .from("payments")
    .insert({
      business_id: admin.business_id,
      customer_id: order.customer_id,
      order_id: orderId,
      amount,
      method: validMethod,
      collected_by_type: "admin",
      collected_by_id: admin.id,
      notes: notes?.trim() || null,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: "שמירת התשלום נכשלה" };

  await supabase.from("customer_ledger_entries").insert({
    business_id: admin.business_id,
    customer_id: order.customer_id,
    entry_type: "payment",
    amount,
    order_id: orderId,
    payment_id: payment.id,
    description: `תשלום להזמנה #${order.order_number}`,
  });

  // Recompute the order's payment status from all its payments.
  const { data: allPayments } = await supabase
    .from("payments")
    .select("amount")
    .eq("order_id", orderId);
  const paidSum = (allPayments ?? []).reduce(
    (sum, p) => sum + Number(p.amount),
    0
  );
  const paymentStatus =
    paidSum >= Number(order.total) ? "paid" : paidSum > 0 ? "partial" : "unpaid";
  await supabase
    .from("orders")
    .update({ payment_status: paymentStatus })
    .eq("id", orderId);

  await createAuditLog(supabase, {
    businessId: admin.business_id,
    actor: { type: "admin", id: admin.id, name: admin.full_name },
    action: "payment.record",
    entityType: "payment",
    entityId: payment.id,
    details: { order_id: orderId, amount, method: validMethod },
  });

  revalidatePath(`/dashboard/orders/${orderId}`);
  revalidatePath("/dashboard/orders");
  return { ok: true };
}
