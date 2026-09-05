import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatMoney, formatDate, formatDateTime } from "@/lib/format";
import { UNIT_TYPE_LABELS } from "@/lib/order-status";
import { createQuoteSnapshot, type QuoteSnapshot } from "./quote-actions";
import { QuoteToolbar } from "./quote-client";

export const metadata = { title: "הצעת מחיר" };

export default async function QuotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = await requireAdmin();
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("id")
    .eq("id", id)
    .eq("business_id", admin.business_id)
    .single();

  if (!order) notFound();

  // First visit creates the snapshot; later visits reuse the latest one
  // so printed quotes stay stable even if prices change. The create
  // action returns the inserted row directly — re-selecting the same
  // query in this render would be served from fetch memoization (the
  // empty result above) and 404 the very first visit.
  const { data: existing } = await supabase
    .from("order_documents")
    .select("snapshot, created_at")
    .eq("order_id", id)
    .eq("doc_type", "quote")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let doc: { snapshot: QuoteSnapshot; created_at: string } | null = existing
    ? { snapshot: existing.snapshot as QuoteSnapshot, created_at: existing.created_at }
    : null;

  if (!doc) {
    const created = await createQuoteSnapshot(id, false);
    if (!created.ok || !created.doc) notFound();
    doc = created.doc;
  }

  const q = doc.snapshot as QuoteSnapshot;

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6">
      <QuoteToolbar orderId={id} />

      <div className="rounded-lg border bg-white p-8 text-black shadow-sm print:border-0 print:p-0 print:shadow-none">
        {/* Header */}
        <div className="flex items-start justify-between border-b-2 border-black pb-4">
          <div>
            <h2 className="text-3xl font-bold">{q.business.name}</h2>
            {q.business.address && <p className="text-sm">{q.business.address}</p>}
            {q.business.phone && (
              <p dir="ltr" className="text-end text-sm">
                {q.business.phone}
              </p>
            )}
          </div>
          <div className="text-start">
            <h3 className="text-xl font-bold">הצעת מחיר</h3>
            <p className="text-sm">תאריך: {formatDate(q.order_date)}</p>
          </div>
        </div>

        {/* Customer + delivery */}
        <div className="grid grid-cols-2 gap-4 border-b py-4 text-sm">
          <div>
            <p className="font-bold">לכבוד:</p>
            <p>{q.customer.name}</p>
            {q.customer.phone && <p dir="ltr" className="text-end">{q.customer.phone}</p>}
            {q.customer.address && <p>{q.customer.address}</p>}
          </div>
          <div>
            <p className="font-bold">אספקה:</p>
            <p>
              {formatDate(q.delivery_date)}
              {q.delivery_time ? ` בשעה ${q.delivery_time}` : ""}
            </p>
          </div>
        </div>

        {/* Items */}
        <table className="w-full border-collapse py-4 text-sm">
          <thead>
            <tr className="border-b-2 border-black text-start">
              <th className="py-2 text-start">מוצר</th>
              <th className="py-2 text-start">כמות</th>
              <th className="py-2 text-start">מחיר יחידה</th>
              <th className="py-2 text-start">סה&quot;כ</th>
            </tr>
          </thead>
          <tbody>
            {q.items.map((item, i) => (
              <tr key={i} className="border-b">
                <td className="py-2 font-medium">{item.product_name}</td>
                <td className="py-2">
                  {item.quantity} {UNIT_TYPE_LABELS[item.unit_type] ?? ""}
                </td>
                <td className="py-2">{formatMoney(item.unit_price)}</td>
                <td className="py-2 font-medium">{formatMoney(item.line_total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} className="py-3 text-lg font-bold">
                סה&quot;כ לתשלום
              </td>
              <td className="py-3 text-lg font-bold">{formatMoney(q.total)}</td>
            </tr>
          </tfoot>
        </table>

        {q.notes && (
          <div className="border-t pt-4 text-sm">
            <p className="font-bold">הערות:</p>
            <p>{q.notes}</p>
          </div>
        )}

        <p className="mt-8 text-center text-xs text-gray-500 print:mt-16">
          נוצר ב־{formatDateTime(doc.created_at)} · {q.business.name}
        </p>
      </div>
    </div>
  );
}
