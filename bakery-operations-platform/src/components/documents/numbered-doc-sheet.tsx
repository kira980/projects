import { formatMoney, formatDate, formatDateTime } from "@/lib/format";
import { UNIT_TYPE_LABELS } from "@/lib/order-status";
import {
  BUSINESS_VAT_ID,
  type NumberedDocSnapshot,
} from "@/lib/documents/numbered-doc";

/**
 * Printable sheet for a numbered document (קבלה / תעודת משלוח). Same layout
 * for the admin and workers apps — a white A4-ish sheet with the business's
 * VAT id and the document's unique number.
 */
export function NumberedDocSheet({
  title,
  numberLabel,
  snapshot,
  docNumber,
  createdAt,
}: {
  title: string;
  numberLabel: string;
  snapshot: NumberedDocSnapshot;
  docNumber: number;
  createdAt: string;
}) {
  const q = snapshot;
  return (
    <div className="rounded-lg border bg-white p-8 text-black shadow-sm print:border-0 print:p-0 print:shadow-none">
      {/* Header */}
      <div className="flex items-start justify-between border-b-2 border-black pb-4">
        <div>
          <h2 className="text-3xl font-bold">{q.business.name}</h2>
          <p className="text-sm">עוסק מורשה {BUSINESS_VAT_ID}</p>
          {q.business.address && <p className="text-sm">{q.business.address}</p>}
          {q.business.phone && (
            <p dir="ltr" className="text-end text-sm">
              {q.business.phone}
            </p>
          )}
        </div>
        <div className="text-start">
          <h3 className="text-xl font-bold">{title}</h3>
          <p className="text-sm font-semibold">
            {numberLabel}: {docNumber}
          </p>
          <p className="text-sm">תאריך: {formatDate(createdAt)}</p>
          <p className="text-sm">הזמנה: #{q.order_number}</p>
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
        נוצר ב־{formatDateTime(createdAt)} · {q.business.name} · עוסק מורשה{" "}
        {BUSINESS_VAT_ID}
      </p>
    </div>
  );
}

/** Shared type→title/label map for receipt / delivery-note routes. */
export const DOC_DEFS: Record<
  string,
  { dbType: "receipt" | "delivery_note"; title: string; numberLabel: string }
> = {
  receipt: { dbType: "receipt", title: "קבלה", numberLabel: "מספר קבלה" },
  "delivery-note": {
    dbType: "delivery_note",
    title: "תעודת משלוח",
    numberLabel: "מספר תעודת משלוח",
  },
};
