"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney, formatDateTime } from "@/lib/format";

export type DeliveryRow = {
  order_id: string;
  public_delivery_id: string | null;
  delivery_code: string | null;
  order_number: number;
  customer_name: string;
  address_text: string | null;
  status: string;
  payment_status: string;
  collected_amount: number;
  /** Worker who actually completed the delivery — set only once done. */
  delivered_by: string | null;
  total: number;
  payment_method: string | null;
  shortage_note: string | null;
};

export type DebtPaymentRow = {
  id: string;
  paid_at: string;
  customer_name: string;
  order_number: number | null;
  amount: number;
  method: string;
  collected_by_name: string;
};

const DO_STATUS_LABELS: Record<string, string> = {
  pending: "ממתין",
  delivered_paid: "נמסר ושולם",
  delivered_unpaid: "נמסר ללא תשלום",
  partial: "שולם חלקית",
  failed: "נכשל",
};

const DO_STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  delivered_paid: "secondary",
  delivered_unpaid: "destructive",
  partial: "default",
  failed: "destructive",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid: "לא שולם",
  partial: "שולם חלקית",
  paid: "שולם",
};

const METHOD_LABELS: Record<string, string> = {
  cash: "מזומן",
  card: "אשראי",
  transfer: "העברה",
  check: "צ'ק",
  other: "אחר",
};

export function DeliveriesClient({
  deliveryRows,
  debtPayments,
}: {
  deliveryRows: DeliveryRow[];
  debtPayments: DebtPaymentRow[];
}) {
  return (
    <div className="grid gap-6">
      <div className="grid gap-3">
        <h2 className="text-lg font-semibold">משלוחי היום</h2>
        <p className="text-sm text-muted-foreground">
          כל הזמנת משלוח פתוחה גלויה לכל עובד באפליקציית הנהג — אין שיוך
          מראש. &quot;נמסר ע&quot;י&quot; מתמלא אוטומטית לפי מי שהשלים את
          המשלוח בקוד האישי שלו.
        </p>
        <div className="rounded-lg border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>מס&apos; משלוח</TableHead>
                <TableHead>לקוח</TableHead>
                <TableHead>כתובת</TableHead>
                <TableHead>סטטוס</TableHead>
                <TableHead>תשלום</TableHead>
                <TableHead>נגבה</TableHead>
                <TableHead>נמסר ע&quot;י</TableHead>
                <TableHead>סה&quot;כ הזמנה</TableHead>
                <TableHead>אמצעי</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deliveryRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                    אין הזמנות משלוח שתואמות את הסינון
                  </TableCell>
                </TableRow>
              )}
              {deliveryRows.map((r) => (
                <TableRow key={r.order_id}>
                  <TableCell className="font-mono font-bold">
                    <Link
                      href={`/dashboard/deliveries/${r.order_id}`}
                      className="text-primary hover:underline"
                    >
                      {r.delivery_code ?? r.public_delivery_id ?? `#${r.order_number}`}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/dashboard/deliveries/${r.order_id}`}
                      className="font-medium hover:underline"
                    >
                      {r.customer_name}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-48 truncate">
                    {r.address_text ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={DO_STATUS_VARIANT[r.status] ?? "outline"}>
                      {DO_STATUS_LABELS[r.status] ?? r.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        r.payment_status === "paid"
                          ? "secondary"
                          : r.payment_status === "partial"
                            ? "outline"
                            : "destructive"
                      }
                    >
                      {PAYMENT_STATUS_LABELS[r.payment_status] ?? r.payment_status}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatMoney(r.collected_amount)}</TableCell>
                  <TableCell>{r.delivered_by ?? "—"}</TableCell>
                  <TableCell className="font-medium">{formatMoney(r.total)}</TableCell>
                  <TableCell>
                    {r.payment_method ? (METHOD_LABELS[r.payment_method] ?? r.payment_method) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="grid gap-3">
        <h2 className="text-lg font-semibold">תשלומי חוב קודמים</h2>
        <div className="rounded-lg border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>תאריך</TableHead>
                <TableHead>לקוח</TableHead>
                <TableHead>הזמנה קודמת</TableHead>
                <TableHead>סכום</TableHead>
                <TableHead>אמצעי</TableHead>
                <TableHead>נגבה ע&quot;י</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {debtPayments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-20 text-center text-muted-foreground">
                    אין תשלומי חוב קודמים היום
                  </TableCell>
                </TableRow>
              )}
              {debtPayments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{formatDateTime(p.paid_at)}</TableCell>
                  <TableCell className="font-medium">{p.customer_name}</TableCell>
                  <TableCell>{p.order_number ? `#${p.order_number}` : "--"}</TableCell>
                  <TableCell className="font-medium">{formatMoney(p.amount)}</TableCell>
                  <TableCell>{METHOD_LABELS[p.method] ?? p.method}</TableCell>
                  <TableCell>{p.collected_by_name}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
