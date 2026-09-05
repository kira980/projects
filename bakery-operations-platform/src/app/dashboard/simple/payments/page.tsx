import Link from "next/link";
import { ArrowRight, HandCoins, Receipt, Store } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { businessToday, jerusalemDayRange } from "@/lib/db/day-lock";
import { formatMoney, formatTime, formatDate } from "@/lib/format";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/db/vendors";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdvanceEditRow } from "@/app/dashboard/workers/advance-edit-row";
import { VendorPaymentActions } from "@/app/dashboard/vendors/vendor-payment-dialog";
import { ExpenseActions } from "@/app/dashboard/expenses/expense-actions";

export const metadata = { title: "פירוט תשלומים" };

type PaymentsType = "advances" | "vendors" | "other";

const TYPE_TITLES: Record<PaymentsType, string> = {
  advances: "מפרעות עובדים",
  vendors: "תשלומים לספקים",
  other: "תשלומים אחרים",
};

const methodLabel = (m: string | null) =>
  m ? (PAYMENT_METHOD_LABELS[m as PaymentMethod] ?? m) : "—";

/** Day-level drill-down for the simple dashboard's payment cards. */
export default async function SimplePaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; date?: string }>;
}) {
  const sp = await searchParams;
  const admin = await requireAdmin();
  const supabase = await createClient();

  const type: PaymentsType =
    sp.type === "vendors" ? "vendors" : sp.type === "other" ? "other" : "advances";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "")
    ? sp.date!
    : businessToday();
  const { start, end } = jerusalemDayRange(date);

  const [
    { data: advances },
    { data: vendorPayments },
    { data: expenses },
    { data: workers },
    { data: profiles },
    { data: vendors },
  ] = await Promise.all([
    type === "advances"
      ? supabase
          .from("worker_advances")
          .select("id, worker_id, amount, method, taken_at, notes")
          .eq("business_id", admin.business_id)
          .gte("taken_at", start)
          .lt("taken_at", end)
          .order("taken_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    type === "vendors"
      ? supabase
          .from("vendor_payments")
          .select(
            "id, vendor_id, vendor_order_id, amount, method, paid_by_type, paid_by_id, paid_at, notes"
          )
          .eq("business_id", admin.business_id)
          .gte("paid_at", start)
          .lt("paid_at", end)
          .order("paid_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    type === "other"
      ? supabase
          .from("expenses")
          .select("id, amount, method, description, category, spent_by_id, created_at")
          .eq("business_id", admin.business_id)
          .eq("expense_date", date)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    supabase
      .from("workers")
      .select("id, full_name")
      .eq("business_id", admin.business_id),
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("business_id", admin.business_id),
    type === "vendors"
      ? supabase
          .from("vendors")
          .select("id, name")
          .eq("business_id", admin.business_id)
      : Promise.resolve({ data: [] }),
  ]);

  // Workers and admins share the "who" lookup.
  const names = new Map<string, string>();
  for (const w of workers ?? []) names.set(w.id, w.full_name);
  for (const p of profiles ?? []) names.set(p.id, p.full_name);
  const vendorNames = new Map((vendors ?? []).map((v) => [v.id, v.name]));

  const total =
    type === "advances"
      ? (advances ?? []).reduce((s, a) => s + Number(a.amount), 0)
      : type === "vendors"
        ? (vendorPayments ?? []).reduce((s, p) => s + Number(p.amount), 0)
        : (expenses ?? []).reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon" asChild aria-label="חזרה">
          <Link href={`/dashboard/simple?date=${date}`}>
            <ArrowRight className="size-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{TYPE_TITLES[type]}</h1>
          <p className="text-muted-foreground">
            {formatDate(date)} · סה&quot;כ {formatMoney(total)}
          </p>
        </div>
      </div>

      {type === "advances" && (
        <div className="rounded-lg border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>עובד</TableHead>
                <TableHead>סכום</TableHead>
                <TableHead>אמצעי</TableHead>
                <TableHead>שעה</TableHead>
                <TableHead>הערות</TableHead>
                <TableHead className="w-24">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(advances ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="p-0">
                    <EmptyState
                      icon={HandCoins}
                      title="אין מפרעות ביום זה"
                      description="מפרעות שנלקחו ביום הנבחר יופיעו כאן."
                    />
                  </TableCell>
                </TableRow>
              )}
              {(advances ?? []).map((a) => (
                <AdvanceEditRow
                  key={a.id}
                  advance={{
                    id: a.id,
                    amount: Number(a.amount),
                    workerName: names.get(a.worker_id) ?? null,
                  }}
                  leading={
                    <TableCell>
                      <Link
                        href={`/dashboard/workers/${a.worker_id}`}
                        className="font-medium hover:underline"
                      >
                        {names.get(a.worker_id) ?? "—"}
                      </Link>
                    </TableCell>
                  }
                  trailing={
                    <>
                      <TableCell>{methodLabel(a.method)}</TableCell>
                      <TableCell>{formatTime(a.taken_at)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {a.notes ?? ""}
                      </TableCell>
                    </>
                  }
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {type === "vendors" && (
        <div className="rounded-lg border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ספק</TableHead>
                <TableHead>סכום</TableHead>
                <TableHead>אמצעי</TableHead>
                <TableHead>מי שילם</TableHead>
                <TableHead>שעה</TableHead>
                <TableHead>הערות</TableHead>
                <TableHead className="w-24">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(vendorPayments ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="p-0">
                    <EmptyState
                      icon={Store}
                      title="אין תשלומים לספקים ביום זה"
                      description="תשלומים לספקים ביום הנבחר יופיעו כאן."
                    />
                  </TableCell>
                </TableRow>
              )}
              {(vendorPayments ?? []).map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Link
                      href={`/dashboard/vendors/${p.vendor_id}`}
                      className="font-medium hover:underline"
                    >
                      {vendorNames.get(p.vendor_id) ?? "—"}
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium text-destructive">
                    {formatMoney(p.amount)}
                  </TableCell>
                  <TableCell>{methodLabel(p.method)}</TableCell>
                  <TableCell>
                    {(p.paid_by_id && names.get(p.paid_by_id)) || "—"}
                  </TableCell>
                  <TableCell>{formatTime(p.paid_at)}</TableCell>
                  <TableCell className="text-muted-foreground">{p.notes ?? ""}</TableCell>
                  <TableCell>
                    <VendorPaymentActions
                      vendors={vendors ?? []}
                      vendorName={vendorNames.get(p.vendor_id)}
                      payment={{
                        id: p.id,
                        vendor_id: p.vendor_id,
                        vendor_order_id: p.vendor_order_id,
                        amount: Number(p.amount),
                        method: p.method,
                        notes: p.notes,
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {type === "other" && (
        <div className="rounded-lg border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>תיאור</TableHead>
                <TableHead>סכום</TableHead>
                <TableHead>אמצעי</TableHead>
                <TableHead>מי שילם</TableHead>
                <TableHead>שעה</TableHead>
                <TableHead className="w-24">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(expenses ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="p-0">
                    <EmptyState
                      icon={Receipt}
                      title="אין תשלומים אחרים ביום זה"
                      description="הוצאות שנרשמו ביום הנבחר יופיעו כאן."
                    />
                  </TableCell>
                </TableRow>
              )}
              {(expenses ?? []).map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.description ?? "—"}</TableCell>
                  <TableCell className="font-medium text-destructive">
                    {formatMoney(e.amount)}
                  </TableCell>
                  <TableCell>{methodLabel(e.method)}</TableCell>
                  <TableCell>
                    {(e.spent_by_id && names.get(e.spent_by_id)) || "—"}
                  </TableCell>
                  <TableCell>{formatTime(e.created_at)}</TableCell>
                  <TableCell>
                    <ExpenseActions
                      expense={{
                        id: e.id,
                        amount: Number(e.amount),
                        method: e.method,
                        description: e.description,
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
