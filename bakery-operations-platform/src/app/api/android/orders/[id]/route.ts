import { authenticateDevice, jsonError } from "@/lib/android/device-auth";

/**
 * GET /api/android/orders/{id}
 *
 * Full order detail for the receipt, scoped to the device's business. The
 * shape mirrors the dashboard "הצעת מחיר" (quotation) page: business header,
 * customer, delivery, line items with ordered/prepared/missing quantities,
 * original vs. final total, payment, and notes.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateDevice(request);
  if (!auth) return jsonError(401, "unauthorized", "Invalid or revoked token");
  const { device, supabase } = auth;
  const { id } = await params;

  const { data: order, error } = await supabase
    .from("orders")
    .select(
      "id, order_number, delivery_code, public_delivery_id, status, payment_status, delivery_type, delivery_date, delivery_time, address_text, total, original_total, updated_total, has_shortage, shortage_note, notes, notes_for_driver, created_at, created_by_type, customer_id, customers(name, phone)"
    )
    .eq("id", id)
    .eq("business_id", device.businessId)
    .maybeSingle();

  if (error) return jsonError(500, "server_error", "Could not load order");
  if (!order) return jsonError(404, "not_found", "Order not found");

  const [{ data: items }, { data: business }, { data: payments }, { data: prints }] =
    await Promise.all([
      supabase
        .from("order_items")
        .select(
          "product_name, product_name_ar, unit_type, quantity, original_quantity, prepared_quantity, missing_quantity, unit_price, line_total, notes"
        )
        .eq("order_id", id)
        .eq("business_id", device.businessId)
        .order("created_at"),
      supabase
        .from("businesses")
        .select("name, phone, address, logo_url")
        .eq("id", device.businessId)
        .single(),
      supabase
        .from("payments")
        .select("method, amount, paid_at")
        .eq("business_id", device.businessId)
        .eq("order_id", id)
        .order("paid_at", { ascending: false }),
      supabase
        .from("android_print_logs")
        .select("printer_name, paper, result, error, reprint, printed_at")
        .eq("business_id", device.businessId)
        .eq("order_id", id)
        .order("printed_at", { ascending: false })
        .limit(20),
    ]);

  const customer = order.customers as unknown as {
    name: string;
    phone: string | null;
  } | null;

  const paymentsList = (payments ?? []).map((p) => ({
    method: p.method,
    amount: Number(p.amount),
    paid_at: p.paid_at,
  }));
  // Primary method = most recent payment's method, if any.
  const paymentMethod = paymentsList[0]?.method ?? null;

  const originalTotal =
    order.original_total != null ? Number(order.original_total) : null;
  const finalTotal = Number(order.updated_total ?? order.total);

  return Response.json({
    business: {
      name: business?.name ?? "",
      phone: business?.phone ?? null,
      address: business?.address ?? null,
      logo_url: business?.logo_url ?? null,
    },
    order: {
      id: order.id,
      order_number: Number(order.order_number),
      code: order.delivery_code ?? order.public_delivery_id ?? `#${order.order_number}`,
      status: order.status,
      payment_status: order.payment_status,
      payment_method: paymentMethod,
      delivery_type: order.delivery_type,
      delivery_date: order.delivery_date,
      delivery_time: order.delivery_time,
      address_text: order.address_text,
      created_at: order.created_at,
      created_by_type: order.created_by_type,
      has_shortage: Boolean(order.has_shortage),
      shortage_note: order.shortage_note,
      notes: order.notes,
      original_total: originalTotal,
      total: finalTotal,
    },
    customer: {
      name: customer?.name ?? null,
      phone: customer?.phone ?? null,
    },
    items: (items ?? []).map((i) => ({
      product_name: i.product_name,
      product_name_ar: i.product_name_ar,
      unit_type: i.unit_type,
      quantity: Number(i.quantity),
      original_quantity:
        i.original_quantity != null ? Number(i.original_quantity) : null,
      prepared_quantity:
        i.prepared_quantity != null ? Number(i.prepared_quantity) : null,
      missing_quantity:
        i.missing_quantity != null ? Number(i.missing_quantity) : 0,
      unit_price: Number(i.unit_price),
      line_total: Number(i.line_total),
      notes: i.notes,
    })),
    payments: paymentsList,
    print_history: (prints ?? []).map((p) => ({
      printer_name: p.printer_name,
      paper: p.paper,
      result: p.result,
      error: p.error,
      reprint: p.reprint,
      printed_at: p.printed_at,
    })),
  });
}
