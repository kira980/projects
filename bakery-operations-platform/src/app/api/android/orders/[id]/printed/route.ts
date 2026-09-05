import { authenticateDevice, jsonError } from "@/lib/android/device-auth";
import { createAuditLog } from "@/lib/db/audit";

/**
 * POST /api/android/orders/{id}/printed
 * Body: { paper?: "mm58"|"mm80", printer_name?, result?: "success"|"failure",
 *         error?, reprint?: boolean }
 *
 * Records a print event. It does NOT change the order status — printing a
 * receipt is not a business-state transition.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateDevice(request);
  if (!auth) return jsonError(401, "unauthorized", "Invalid or revoked token");
  const { device, supabase } = auth;
  const { id } = await params;

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    /* empty body is allowed */
  }

  // Confirm the order belongs to this business before logging.
  const { data: order } = await supabase
    .from("orders")
    .select("id, order_number")
    .eq("id", id)
    .eq("business_id", device.businessId)
    .maybeSingle();
  if (!order) return jsonError(404, "not_found", "Order not found");

  const paper = body.paper === "mm80" ? "mm80" : body.paper === "mm58" ? "mm58" : null;
  const result = body.result === "failure" ? "failure" : "success";
  const printerName =
    typeof body.printer_name === "string" ? body.printer_name.slice(0, 120) : null;
  const errorText =
    typeof body.error === "string" ? body.error.slice(0, 500) : null;
  const reprint = body.reprint === true;

  const { data: log, error } = await supabase
    .from("android_print_logs")
    .insert({
      business_id: device.businessId,
      device_id: device.id,
      order_id: order.id,
      order_number: order.order_number,
      printer_name: printerName,
      paper,
      result,
      error: errorText,
      reprint,
    })
    .select("id")
    .single();

  if (error) return jsonError(500, "server_error", "Could not record print");

  await createAuditLog(supabase, {
    businessId: device.businessId,
    actor: { type: "worker", id: device.workerId ?? device.id, name: device.label || "מכשיר אנדרואיד" },
    action: result === "success" ? "android.receipt_printed" : "android.receipt_print_failed",
    entityType: "order",
    entityId: order.id,
    details: { order_number: Number(order.order_number), paper, reprint, printer_name: printerName },
  });

  return Response.json({ ok: true, log_id: log.id });
}
