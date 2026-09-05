import { randomUUID } from "crypto";
import { table, type Row } from "./store";
import type { QueryResult } from "./query";

/**
 * The stored procedures, reimplemented.
 *
 * In production these are PL/pgSQL functions, and that is the point of them:
 * order creation and every vendor-ledger write happen in one transaction so a
 * record and its ledger entry can never land apart. JavaScript is
 * single-threaded and these run to completion without awaiting, so the same
 * all-or-nothing property holds here — each one either finishes or throws
 * before it has written anything the caller can observe.
 *
 * The error codes are the ones the application already catches by name
 * (`DAY_LOCKED`, `NO_ITEMS`, `PRODUCT_NOT_FOUND`, …), so its error handling is
 * exercised unchanged.
 */

type RpcArgs = Record<string, unknown>;

/** A procedure returns a scalar, an id or a small object — not a row set. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RpcResult = QueryResult<any>;

const ok = (data: unknown): RpcResult => ({ data, error: null });
const fail = (message: string): RpcResult => ({
  data: null,
  error: { message, code: "P0001" },
});

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const now = () => new Date().toISOString();

/** Israel-local date, matching the `business_today()` the SQL used. */
function businessToday(offsetHours = 4): string {
  const shifted = new Date(Date.now() - offsetHours * 3_600_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(shifted);
}

function dayIsLocked(businessId: string, date: string): boolean {
  return table("day_locks").some(
    (row) => row.business_id === businessId && row.lock_date === date && row.is_locked === true
  );
}

function audit(entry: Row): void {
  table("audit_logs").push({
    id: randomUUID(),
    details: {},
    created_at: now(),
    ...entry,
  });
}

/* ------------------------------- sequences ------------------------------ */

const counters = new Map<string, number>();

function takeCounter(key: string, start = 1): number {
  const next = counters.get(key) ?? start;
  counters.set(key, next + 1);
  return next;
}

function formatOrderCode(seq: number): string {
  // A1..A9, B1..B9 — the code a driver reads off a box.
  return String.fromCharCode(65 + Math.floor((seq - 1) / 9)) + (((seq - 1) % 9) + 1);
}

/* ------------------------------ order creation --------------------------- */

function createOrderAdmin(args: RpcArgs): RpcResult {
  const business = table("businesses")[0];
  if (!business) return fail("NOT_AUTHORIZED");
  const businessId = String(business.id);

  if (dayIsLocked(businessId, businessToday(0))) return fail("DAY_LOCKED");

  const items = (args.p_items as { product_id: string; quantity: number; notes?: string }[]) ?? [];
  const wanted = items.filter((item) => Number(item.quantity) > 0);
  if (wanted.length === 0) return fail("NO_ITEMS");

  const products = table("products");
  const resolved = wanted.map((item) => {
    const product = products.find(
      (row) => row.id === item.product_id && row.business_id === businessId && row.is_active
    );
    return { item, product };
  });
  if (resolved.some((entry) => !entry.product)) return fail("PRODUCT_NOT_FOUND");

  const priceOverrides = table("customer_product_prices");
  const lines = resolved.map(({ item, product }) => {
    const override = priceOverrides.find(
      (row) => row.customer_id === args.p_customer_id && row.product_id === product!.id
    );
    const unitPrice = Number(override?.price ?? product!.default_price);
    return {
      product: product!,
      quantity: Number(item.quantity),
      unitPrice,
      lineTotal: round2(unitPrice * Number(item.quantity)),
      notes: item.notes?.trim() || null,
    };
  });

  const total = round2(lines.reduce((sum, line) => sum + line.lineTotal, 0));
  const isDelivery = (args.p_delivery_type ?? "delivery") !== "pickup";

  const orderNumber = takeCounter(
    `order_number:${businessId}`,
    Number(business.next_order_number ?? 1001)
  );
  business.next_order_number = orderNumber + 1;

  let deliveryCode: string | null = null;
  let publicDeliveryId: string | null = null;
  if (isDelivery) {
    deliveryCode = formatOrderCode(
      takeCounter(`delivery_code:${businessId}:${args.p_delivery_date}`)
    );
    publicDeliveryId = `D-${String(takeCounter(`delivery_public:${businessId}`)).padStart(6, "0")}`;
  }

  const orderId = randomUUID();
  const timestamp = now();
  const trimmed = (value: unknown) => String(value ?? "").trim() || null;

  table("orders").push({
    id: orderId,
    business_id: businessId,
    customer_id: args.p_customer_id,
    order_number: orderNumber,
    status: "new",
    payment_status: "unpaid",
    delivery_type: isDelivery ? "delivery" : "pickup",
    delivery_code: deliveryCode,
    public_delivery_id: publicDeliveryId,
    delivery_date: args.p_delivery_date,
    delivery_time: trimmed(args.p_delivery_time),
    address_text: trimmed(args.p_address_text),
    total,
    original_total: total,
    updated_total: total,
    has_shortage: false,
    notes: trimmed(args.p_notes),
    notes_for_baker: trimmed(args.p_notes_for_baker),
    notes_for_driver: trimmed(args.p_notes_for_driver),
    source: "admin",
    created_by_type: "admin",
    created_by_id: args.p_actor_id ?? null,
    created_at: timestamp,
    updated_at: timestamp,
  });

  for (const line of lines) {
    table("order_items").push({
      id: randomUUID(),
      business_id: businessId,
      order_id: orderId,
      product_id: line.product.id,
      product_name: line.product.name,
      product_name_ar: line.product.name_ar ?? null,
      unit_type: line.product.unit_type,
      quantity: line.quantity,
      unit_price: line.unitPrice,
      line_total: line.lineTotal,
      notes: line.notes,
      created_at: timestamp,
    });
  }

  table("customer_ledger_entries").push({
    id: randomUUID(),
    business_id: businessId,
    customer_id: args.p_customer_id,
    entry_type: "charge",
    amount: total,
    order_id: orderId,
    description: `הזמנה #${orderNumber}`,
    created_at: timestamp,
  });

  audit({
    business_id: businessId,
    actor_type: "admin",
    actor_id: args.p_actor_id ?? null,
    actor_name: args.p_actor_name ?? "",
    action: "order.create",
    entity_type: "order",
    entity_id: orderId,
    details: { order_number: orderNumber, total, items: lines.length },
  });

  return ok({ order_id: orderId, order_number: orderNumber });
}

/* ------------------------------ vendor ledger ---------------------------- */

function assertVendorWriteAllowed(businessId: string): string | null {
  if (!businessId) return "NOT_AUTHORIZED";
  if (dayIsLocked(businessId, businessToday())) return "DAY_LOCKED";
  return null;
}

function vendorExists(businessId: string, vendorId: unknown): boolean {
  return table("vendors").some((row) => row.id === vendorId && row.business_id === businessId);
}

function vendorDebt(businessId: string, vendorId: unknown, excludePaymentId?: unknown): number {
  return round2(
    table("vendor_ledger_entries")
      .filter(
        (row) =>
          row.business_id === businessId &&
          row.vendor_id === vendorId &&
          (excludePaymentId ? row.vendor_payment_id !== excludePaymentId : true)
      )
      .reduce(
        (sum, row) =>
          sum + (row.entry_type === "payment" ? -Number(row.amount) : Number(row.amount)),
        0
      )
  );
}

function recordVendorOrder(args: RpcArgs): RpcResult {
  const businessId = String(args.p_business_id ?? "");
  const blocked = assertVendorWriteAllowed(businessId);
  if (blocked) return fail(blocked);
  if (!vendorExists(businessId, args.p_vendor_id)) return fail("VENDOR_NOT_FOUND");

  const amount = Number(args.p_amount);
  const paid = Boolean(args.p_paid);
  const orderId = randomUUID();
  const receivedAt = (args.p_received_at as string) || now();

  table("vendor_orders").push({
    id: orderId,
    business_id: businessId,
    vendor_id: args.p_vendor_id,
    amount,
    status: paid ? "paid" : "unpaid",
    payment_method: paid ? (args.p_payment_method ?? "cash") : null,
    paid_by_worker_id: paid ? (args.p_paid_by_worker_id ?? null) : null,
    received_by_type: args.p_received_by_type ?? "worker",
    received_by_id: args.p_received_by_id ?? null,
    receipt_file_path: args.p_receipt_file_path ?? null,
    notes: args.p_notes ?? null,
    received_at: receivedAt,
    created_at: now(),
  });

  table("vendor_ledger_entries").push({
    id: randomUUID(),
    business_id: businessId,
    vendor_id: args.p_vendor_id,
    entry_type: "charge",
    amount,
    vendor_order_id: orderId,
    description: "קבלת סחורה",
    created_at: receivedAt,
  });

  if (paid) {
    const paymentId = randomUUID();
    table("vendor_payments").push({
      id: paymentId,
      business_id: businessId,
      vendor_id: args.p_vendor_id,
      vendor_order_id: orderId,
      amount,
      method: args.p_payment_method ?? "cash",
      paid_by_type: args.p_received_by_type ?? "worker",
      paid_by_id: args.p_paid_by_worker_id ?? args.p_received_by_id ?? null,
      at_arrival: true,
      paid_at: receivedAt,
      created_at: now(),
    });
    table("vendor_ledger_entries").push({
      id: randomUUID(),
      business_id: businessId,
      vendor_id: args.p_vendor_id,
      entry_type: "payment",
      amount,
      vendor_order_id: orderId,
      vendor_payment_id: paymentId,
      description: "תשלום בעת קבלת סחורה",
      created_at: receivedAt,
    });
  }

  audit({
    business_id: businessId,
    actor_type: args.p_actor_type ?? "worker",
    actor_id: args.p_actor_id ?? null,
    actor_name: args.p_actor_name ?? "",
    action: "vendor_order.create",
    entity_type: "vendor_order",
    entity_id: orderId,
    details: { vendor_id: args.p_vendor_id, amount, paid },
  });

  return ok(orderId);
}

function recordVendorPayment(args: RpcArgs): RpcResult {
  const businessId = String(args.p_business_id ?? "");
  const blocked = assertVendorWriteAllowed(businessId);
  if (blocked) return fail(blocked);
  if (!vendorExists(businessId, args.p_vendor_id)) return fail("VENDOR_NOT_FOUND");

  const orderId = args.p_vendor_order_id ?? null;
  if (orderId && !table("vendor_orders").some((row) => row.id === orderId)) {
    return fail("ORDER_NOT_FOUND");
  }

  const amount = Number(args.p_amount);
  if (amount > vendorDebt(businessId, args.p_vendor_id)) return fail("OVERPAYMENT");

  const paymentId = randomUUID();
  const timestamp = now();

  table("vendor_payments").push({
    id: paymentId,
    business_id: businessId,
    vendor_id: args.p_vendor_id,
    vendor_order_id: orderId,
    amount,
    method: args.p_method ?? "cash",
    paid_by_type: args.p_paid_by_type ?? "worker",
    paid_by_id: args.p_paid_by_id ?? null,
    proof_file_path: args.p_proof_file_path ?? null,
    notes: args.p_notes ?? null,
    at_arrival: false,
    paid_at: timestamp,
    created_at: timestamp,
  });

  table("vendor_ledger_entries").push({
    id: randomUUID(),
    business_id: businessId,
    vendor_id: args.p_vendor_id,
    entry_type: "payment",
    amount,
    vendor_order_id: orderId,
    vendor_payment_id: paymentId,
    description: "תשלום חוב לספק",
    created_at: timestamp,
  });

  if (orderId) {
    const order = table("vendor_orders").find((row) => row.id === orderId);
    if (order) order.status = "paid";
  }

  audit({
    business_id: businessId,
    actor_type: args.p_actor_type ?? "worker",
    actor_id: args.p_actor_id ?? null,
    actor_name: args.p_actor_name ?? "",
    action: "vendor_payment.create",
    entity_type: "vendor_payment",
    entity_id: paymentId,
    details: { vendor_id: args.p_vendor_id, amount },
  });

  return ok(paymentId);
}

function updateVendorOrder(args: RpcArgs): RpcResult {
  const businessId = String(args.p_business_id ?? "");
  const blocked = assertVendorWriteAllowed(businessId);
  if (blocked) return fail(blocked);

  const order = table("vendor_orders").find(
    (row) => row.id === args.p_order_id && row.business_id === businessId
  );
  if (!order) return fail("ORDER_NOT_FOUND");

  const amount = Number(args.p_amount);
  const paid = Boolean(args.p_paid);
  const receivedAt = (args.p_received_at as string) || order.received_at;

  Object.assign(order, {
    vendor_id: args.p_vendor_id ?? order.vendor_id,
    amount,
    status: paid ? "paid" : "unpaid",
    payment_method: paid ? (args.p_payment_method ?? "cash") : null,
    paid_by_worker_id: paid ? (args.p_paid_by_worker_id ?? null) : null,
    receipt_file_path: args.p_receipt_file_path ?? null,
    notes: args.p_notes ?? null,
    received_at: receivedAt,
  });

  // Rewrite the arrival's own ledger rows and at-arrival payment, never the
  // separate debt payments someone made later.
  const ledger = table("vendor_ledger_entries");
  for (let i = ledger.length - 1; i >= 0; i--) {
    const row = ledger[i]!;
    if (row.vendor_order_id === order.id && (row.entry_type === "charge" || row.vendor_payment_id)) {
      const payment = table("vendor_payments").find((p) => p.id === row.vendor_payment_id);
      if (row.entry_type === "charge" || payment?.at_arrival) ledger.splice(i, 1);
    }
  }
  const payments = table("vendor_payments");
  for (let i = payments.length - 1; i >= 0; i--) {
    if (payments[i]!.vendor_order_id === order.id && payments[i]!.at_arrival) payments.splice(i, 1);
  }

  ledger.push({
    id: randomUUID(),
    business_id: businessId,
    vendor_id: order.vendor_id,
    entry_type: "charge",
    amount,
    vendor_order_id: order.id,
    description: "קבלת סחורה",
    created_at: receivedAt,
  });

  if (paid) {
    const paymentId = randomUUID();
    payments.push({
      id: paymentId,
      business_id: businessId,
      vendor_id: order.vendor_id,
      vendor_order_id: order.id,
      amount,
      method: args.p_payment_method ?? "cash",
      paid_by_type: "worker",
      paid_by_id: args.p_paid_by_worker_id ?? null,
      at_arrival: true,
      paid_at: receivedAt,
      created_at: now(),
    });
    ledger.push({
      id: randomUUID(),
      business_id: businessId,
      vendor_id: order.vendor_id,
      entry_type: "payment",
      amount,
      vendor_order_id: order.id,
      vendor_payment_id: paymentId,
      description: "תשלום בעת קבלת סחורה",
      created_at: receivedAt,
    });
  }

  audit({
    business_id: businessId,
    actor_type: args.p_actor_type ?? "worker",
    actor_id: args.p_actor_id ?? null,
    actor_name: args.p_actor_name ?? "",
    action: "vendor_order.update",
    entity_type: "vendor_order",
    entity_id: order.id,
    details: { amount, paid },
  });

  return ok(null);
}

function updateVendorPayment(args: RpcArgs): RpcResult {
  const businessId = String(args.p_business_id ?? "");
  const blocked = assertVendorWriteAllowed(businessId);
  if (blocked) return fail(blocked);

  const payment = table("vendor_payments").find(
    (row) => row.id === args.p_payment_id && row.business_id === businessId
  );
  if (!payment) return fail("PAYMENT_NOT_FOUND");

  const amount = Number(args.p_amount);
  if (amount > vendorDebt(businessId, payment.vendor_id, payment.id)) return fail("OVERPAYMENT");

  Object.assign(payment, {
    vendor_order_id: args.p_vendor_order_id ?? null,
    amount,
    method: args.p_method ?? payment.method,
    paid_by_id: args.p_paid_by_id ?? null,
    proof_file_path: args.p_proof_file_path ?? null,
    notes: args.p_notes ?? null,
  });

  const entry = table("vendor_ledger_entries").find((row) => row.vendor_payment_id === payment.id);
  if (entry) {
    entry.amount = amount;
    entry.vendor_order_id = args.p_vendor_order_id ?? null;
  }

  audit({
    business_id: businessId,
    actor_type: args.p_actor_type ?? "worker",
    actor_id: args.p_actor_id ?? null,
    actor_name: args.p_actor_name ?? "",
    action: "vendor_payment.update",
    entity_type: "vendor_payment",
    entity_id: payment.id,
    details: { amount },
  });

  return ok(null);
}

function deleteVendorOrder(args: RpcArgs): RpcResult {
  const businessId = String(args.p_business_id ?? "");
  const blocked = assertVendorWriteAllowed(businessId);
  if (blocked) return fail(blocked);

  const orders = table("vendor_orders");
  const order = orders.find((row) => row.id === args.p_order_id && row.business_id === businessId);
  if (!order) return fail("ORDER_NOT_FOUND");

  // A later debt payment against this bill is somebody's cash on a separate
  // occasion; deleting the bill must not silently delete it too.
  const hasDebtPayment = table("vendor_payments").some(
    (row) => row.vendor_order_id === order.id && !row.at_arrival
  );
  if (hasDebtPayment) return fail("DEBT_PAYMENT_EXISTS");

  const ledger = table("vendor_ledger_entries");
  for (let i = ledger.length - 1; i >= 0; i--) {
    if (ledger[i]!.vendor_order_id === order.id) ledger.splice(i, 1);
  }
  const payments = table("vendor_payments");
  for (let i = payments.length - 1; i >= 0; i--) {
    if (payments[i]!.vendor_order_id === order.id) payments.splice(i, 1);
  }
  orders.splice(orders.indexOf(order), 1);

  audit({
    business_id: businessId,
    actor_type: args.p_actor_type ?? "worker",
    actor_id: args.p_actor_id ?? null,
    actor_name: args.p_actor_name ?? "",
    action: "vendor_order.delete",
    entity_type: "vendor_order",
    entity_id: order.id,
    details: { amount: order.amount },
  });

  return ok(null);
}

function deleteVendorPayment(args: RpcArgs): RpcResult {
  const businessId = String(args.p_business_id ?? "");
  const blocked = assertVendorWriteAllowed(businessId);
  if (blocked) return fail(blocked);

  const payments = table("vendor_payments");
  const payment = payments.find(
    (row) => row.id === args.p_payment_id && row.business_id === businessId
  );
  if (!payment) return fail("PAYMENT_NOT_FOUND");

  const ledger = table("vendor_ledger_entries");
  for (let i = ledger.length - 1; i >= 0; i--) {
    if (ledger[i]!.vendor_payment_id === payment.id) ledger.splice(i, 1);
  }
  if (payment.vendor_order_id) {
    const order = table("vendor_orders").find((row) => row.id === payment.vendor_order_id);
    if (order) order.status = "unpaid";
  }
  payments.splice(payments.indexOf(payment), 1);

  audit({
    business_id: businessId,
    actor_type: args.p_actor_type ?? "worker",
    actor_id: args.p_actor_id ?? null,
    actor_name: args.p_actor_name ?? "",
    action: "vendor_payment.delete",
    entity_type: "vendor_payment",
    entity_id: payment.id,
    details: { amount: payment.amount },
  });

  return ok(null);
}

/* --------------------------------- table -------------------------------- */

export function callRpc(name: string, args: RpcArgs): RpcResult {
  switch (name) {
    case "create_order_admin":
      return createOrderAdmin(args);
    case "record_vendor_order":
      return recordVendorOrder(args);
    case "record_vendor_payment":
      return recordVendorPayment(args);
    case "update_vendor_order":
      return updateVendorOrder(args);
    case "update_vendor_payment":
      return updateVendorPayment(args);
    case "delete_vendor_order":
      return deleteVendorOrder(args);
    case "delete_vendor_payment":
      return deleteVendorPayment(args);

    case "take_order_number": {
      const business = table("businesses").find((row) => row.id === args.p_business_id);
      if (!business) return fail("BUSINESS_NOT_FOUND");
      const next = Number(business.next_order_number ?? 1001);
      business.next_order_number = next + 1;
      return ok(next);
    }
    case "take_delivery_code_seq":
      return ok(takeCounter(`delivery_code:${args.p_business_id}:${args.p_delivery_date}`));
    case "take_takeaway_code_seq":
      return ok(takeCounter(`takeaway_code:${args.p_business_id}:${args.p_delivery_date}`));
    case "take_delivery_public_seq":
      return ok(takeCounter(`delivery_public:${args.p_business_id}`));

    case "get_customer_product_price": {
      const override = table("customer_product_prices").find(
        (row) => row.customer_id === args.p_customer_id && row.product_id === args.p_product_id
      );
      if (override) return ok(Number(override.price));
      const product = table("products").find((row) => row.id === args.p_product_id);
      return ok(product ? Number(product.default_price) : null);
    }

    default:
      return fail(`Unknown function "${name}" in the demo backend`);
  }
}
