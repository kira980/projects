import { notFound, redirect } from "next/navigation";
import { getWorkerSession } from "@/lib/kiosk/session";
import { createServiceClient } from "@/lib/supabase/server";
import { formatMoney, formatDate } from "@/lib/format";
import { UNIT_TYPE_LABELS } from "@/lib/order-status";
import { PrintToolbar } from "./print-toolbar";
import { ordersBackHref } from "../back-href";

export const metadata = { title: "הצעת מחיר" };

/** Printable delivery quote for shift managers (workers app). */
export default async function WorkerQuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string; type?: string }>;
}) {
  const { id } = await params;
  const { date, type } = await searchParams;
  const session = await getWorkerSession("kiosk");
  if (!session) redirect("/workers");
  if (!session.canManageShift) redirect("/workers/menu");

  // Back goes to the day and tab the manager came from, not to today.
  const backHref = ordersBackHref(date, type);

  const supabase = createServiceClient();
  const [{ data: order }, { data: business }] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, order_number, delivery_code, created_at, delivery_date, delivery_time, address_text, total, original_total, updated_total, has_shortage, shortage_note, notes, customers(name, phone)"
      )
      .eq("id", id)
      .eq("business_id", session.businessId)
      .single(),
    supabase
      .from("businesses")
      .select("name, phone, address")
      .eq("id", session.businessId)
      .single(),
  ]);

  if (!order || !business) notFound();

  const { data: items } = await supabase
    .from("order_items")
    .select(
      "product_name, unit_type, quantity, original_quantity, prepared_quantity, missing_quantity, unit_price, line_total"
    )
    .eq("order_id", id)
    .order("created_at");

  const customer = order.customers as unknown as { name: string; phone: string | null } | null;
  const total = Number(order.updated_total ?? order.total);
  const hasShortage = Boolean(order.has_shortage);

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4 p-4" dir="rtl">
      <PrintToolbar backHref={backHref} />

      <div className="rounded-lg border bg-white p-8 text-black shadow-sm print:border-0 print:p-0 print:shadow-none">
        <div className="flex items-start justify-between border-b-2 border-black pb-4">
          <div>
            <h2 className="text-3xl font-bold">{business.name}</h2>
            {business.address && <p className="text-sm">{business.address}</p>}
            {business.phone && (
              <p dir="ltr" className="text-end text-sm">
                {business.phone}
              </p>
            )}
          </div>
          <div className="text-start">
            <h3 className="text-xl font-bold">הצעת מחיר</h3>
            <p className="text-sm">תאריך: {formatDate(order.created_at)}</p>
            {order.delivery_code && (
              <p className="font-mono text-sm font-bold">{order.delivery_code}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 border-b py-4 text-sm">
          <div>
            <p className="font-bold">לכבוד:</p>
            <p>{customer?.name ?? "—"}</p>
            {customer?.phone && (
              <p dir="ltr" className="text-end">
                {customer.phone}
              </p>
            )}
            {order.address_text && <p>{order.address_text}</p>}
          </div>
          <div>
            <p className="font-bold">אספקה:</p>
            <p>
              {formatDate(order.delivery_date)}
              {order.delivery_time ? ` בשעה ${order.delivery_time}` : ""}
            </p>
          </div>
        </div>

        <table className="w-full border-collapse py-4 text-sm">
          <thead>
            <tr className="border-b-2 border-black">
              <th className="py-2 text-start">מוצר</th>
              <th className="py-2 text-start">הוזמן</th>
              {hasShortage && <th className="py-2 text-start">הוכן</th>}
              {hasShortage && <th className="py-2 text-start">חוסר</th>}
              <th className="py-2 text-start">מחיר יחידה</th>
              <th className="py-2 text-start">סה&quot;כ</th>
            </tr>
          </thead>
          <tbody>
            {(items ?? []).map((item, i) => {
              const unit = UNIT_TYPE_LABELS[item.unit_type] ?? item.unit_type;
              const ordered = Number(item.original_quantity ?? item.quantity);
              const prepared = Number(item.prepared_quantity ?? item.quantity);
              const missing = Number(item.missing_quantity ?? 0);
              return (
                <tr key={i} className="border-b">
                  <td className="py-2 font-medium">{item.product_name}</td>
                  <td className="py-2">
                    {ordered} {unit}
                  </td>
                  {hasShortage && (
                    <td className="py-2">
                      {prepared} {unit}
                    </td>
                  )}
                  {hasShortage && (
                    <td className="py-2 text-orange-700">
                      {missing > 0 ? `${missing} ${unit}` : "—"}
                    </td>
                  )}
                  <td className="py-2">{formatMoney(item.unit_price)}</td>
                  <td className="py-2 font-medium">{formatMoney(item.line_total)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            {hasShortage && order.original_total != null && (
              <tr>
                <td colSpan={hasShortage ? 5 : 3} className="py-1 text-sm text-gray-500">
                  סה&quot;כ מקורי (לפני חוסר)
                </td>
                <td className="py-1 text-sm text-gray-500 line-through">
                  {formatMoney(Number(order.original_total))}
                </td>
              </tr>
            )}
            <tr>
              <td colSpan={hasShortage ? 5 : 3} className="py-3 text-lg font-bold">
                סה&quot;כ לתשלום
              </td>
              <td className="py-3 text-lg font-bold">{formatMoney(total)}</td>
            </tr>
          </tfoot>
        </table>

        {order.shortage_note && (
          <div className="border-t pt-4 text-sm">
            <p className="font-bold">הערת חוסר:</p>
            <p>{order.shortage_note}</p>
          </div>
        )}

        {order.notes && (
          <div className="border-t pt-4 text-sm">
            <p className="font-bold">הערות:</p>
            <p>{order.notes}</p>
          </div>
        )}

        <p className="mt-8 text-center text-xs text-gray-500 print:mt-16">
          {business.name}
        </p>
      </div>
    </div>
  );
}
