import type { NextRequest } from "next/server";
import { authenticateDevice, jsonError } from "@/lib/android/device-auth";

/**
 * GET /api/android/orders
 * Query: q, status, payment_method, delivery_type, from, to, page, page_size
 *
 * Returns a paginated, business-scoped order list for the paired device.
 * The business is derived from the bearer token — never from the client.
 */

const ORDER_STATUSES = new Set([
  "new",
  "preparing",
  "ready",
  "delivering",
  "delivered",
  "problem",
  "cancelled",
]);
const PAYMENT_STATUSES = new Set(["unpaid", "partial", "paid"]);
const PAYMENT_METHODS = new Set(["cash", "card", "transfer", "check", "other"]);
const DELIVERY_TYPES = new Set(["delivery", "pickup"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
  const auth = await authenticateDevice(request);
  if (!auth) return jsonError(401, "unauthorized", "Invalid or revoked token");
  const { device, supabase } = auth;
  const businessId = device.businessId;

  const sp = request.nextUrl.searchParams;
  const q = (sp.get("q") ?? "").trim();
  const status = sp.get("status") ?? "";
  const paymentStatus = sp.get("payment_status") ?? "";
  const paymentMethod = sp.get("payment_method") ?? "";
  const deliveryType = sp.get("delivery_type") ?? "";
  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(sp.get("page_size")) || 25));
  const offset = (page - 1) * pageSize;

  // Optional payment-method pre-filter: restrict to orders that have at
  // least one payment with the requested method.
  let restrictIds: string[] | null = null;
  if (paymentMethod && PAYMENT_METHODS.has(paymentMethod)) {
    const { data } = await supabase
      .from("payments")
      .select("order_id")
      .eq("business_id", businessId)
      .eq("method", paymentMethod)
      .not("order_id", "is", null);
    restrictIds = [
      ...new Set((data ?? []).map((p) => p.order_id).filter(Boolean)),
    ] as string[];
    if (restrictIds.length === 0) {
      return Response.json({
        orders: [],
        page,
        page_size: pageSize,
        total: 0,
        total_pages: 1,
      });
    }
  }

  let query = supabase
    .from("orders")
    .select(
      "id, order_number, delivery_code, public_delivery_id, delivery_type, delivery_date, delivery_time, created_at, status, payment_status, total, updated_total, customers(name, phone)",
      { count: "exact" }
    )
    .eq("business_id", businessId);

  if (status && ORDER_STATUSES.has(status)) query = query.eq("status", status);
  if (paymentStatus && PAYMENT_STATUSES.has(paymentStatus)) {
    query = query.eq("payment_status", paymentStatus);
  }
  if (deliveryType && DELIVERY_TYPES.has(deliveryType)) {
    query = query.eq("delivery_type", deliveryType);
  }
  if (DATE_RE.test(from)) query = query.gte("delivery_date", from);
  if (DATE_RE.test(to)) query = query.lte("delivery_date", to);
  if (restrictIds) query = query.in("id", restrictIds);

  if (q) {
    // Match order number / delivery code, or a customer name/phone.
    const { data: custs } = await supabase
      .from("customers")
      .select("id")
      .eq("business_id", businessId)
      .or(`name.ilike.%${q}%,phone.ilike.%${q}%`)
      .limit(200);
    const custIds = (custs ?? []).map((c) => c.id);

    const ors: string[] = [
      `delivery_code.ilike.%${q}%`,
      `public_delivery_id.ilike.%${q}%`,
    ];
    if (/^\d+$/.test(q)) ors.push(`order_number.eq.${q}`);
    if (custIds.length) ors.push(`customer_id.in.(${custIds.join(",")})`);
    query = query.or(ors.join(","));
  }

  const { data: orders, count, error } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) return jsonError(500, "server_error", "Could not load orders");

  // Printed indicator: which of these orders have a successful print log.
  const ids = (orders ?? []).map((o) => o.id);
  const printedSet = new Set<string>();
  if (ids.length) {
    const { data: logs } = await supabase
      .from("android_print_logs")
      .select("order_id")
      .eq("business_id", businessId)
      .eq("result", "success")
      .in("order_id", ids);
    for (const l of logs ?? []) if (l.order_id) printedSet.add(l.order_id);
  }

  const items = (orders ?? []).map((o) => ({
    id: o.id,
    order_number: Number(o.order_number),
    code: o.delivery_code ?? o.public_delivery_id ?? `#${o.order_number}`,
    customer_name:
      (o.customers as unknown as { name: string; phone: string | null } | null)
        ?.name ?? null,
    customer_phone:
      (o.customers as unknown as { name: string; phone: string | null } | null)
        ?.phone ?? null,
    delivery_type: o.delivery_type,
    delivery_date: o.delivery_date,
    delivery_time: o.delivery_time,
    created_at: o.created_at,
    status: o.status,
    payment_status: o.payment_status,
    total: Number(o.updated_total ?? o.total),
    printed: printedSet.has(o.id),
  }));

  const total = count ?? items.length;
  return Response.json({
    orders: items,
    page,
    page_size: pageSize,
    total,
    total_pages: Math.max(1, Math.ceil(total / pageSize)),
  });
}
