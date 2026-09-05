import { Wallet } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { normalizeMonth, addMonths, monthDateRange } from "@/lib/reports";
import { formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ReportNav } from "@/components/report-nav";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  PaymentDialog,
  PaymentRow,
  type PrivatePayment,
} from "./payment-dialog";

export const metadata = { title: "תשלומים פרטיים" };

/**
 * תשלומים פרטיים — the owner's own payments, kept apart from the bakery's
 * books on purpose.
 *
 * Nothing here reaches מבט יומי, the daily totals or any report, and no
 * day lock applies: these are not the business's expenses, they are the
 * owner's private record of money he paid out. The whole dashboard is
 * behind requireAdmin, so no worker can reach this page.
 */
export default async function PrivatePaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const sp = await searchParams;
  const admin = await requireAdmin();
  const supabase = await createClient();

  const month = normalizeMonth(sp.month);
  const { start, end } = monthDateRange(month);

  const { data: payments } = await supabase
    .from("private_payments")
    .select("id, amount, paid_to, paid_on, notes")
    .eq("business_id", admin.business_id)
    .gte("paid_on", start)
    .lt("paid_on", end)
    .order("paid_on", { ascending: false })
    .order("created_at", { ascending: false });

  const rows: PrivatePayment[] = (payments ?? []).map((p) => ({
    id: p.id,
    amount: Number(p.amount),
    paid_to: p.paid_to,
    paid_on: p.paid_on,
    notes: p.notes,
  }));
  const total = rows.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="grid gap-5">
      <PageHeader
        title="תשלומים פרטיים"
        description="רישום אישי של הבעלים — לא נכלל בקופה, בדוחות או בסיכומי היום"
      >
        <div className="flex flex-wrap items-center gap-3">
          <ReportNav
            basePath="/dashboard/private-payments"
            param="month"
            current={month}
            prev={addMonths(month, -1)}
            next={addMonths(month, 1)}
            label={month}
          />
          <PaymentDialog />
        </div>
      </PageHeader>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">תאריך</TableHead>
              <TableHead>למי שולם</TableHead>
              <TableHead className="w-32">סכום</TableHead>
              <TableHead>הערות</TableHead>
              <TableHead className="w-24">פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="p-0">
                  <EmptyState
                    icon={Wallet}
                    title="אין תשלומים בחודש זה"
                    description="כאן נרשמים תשלומים פרטיים של הבעלים — סכום, למי, מתי והערה."
                  />
                </TableCell>
              </TableRow>
            )}
            {rows.map((p) => (
              <PaymentRow key={p.id} payment={p} />
            ))}
          </TableBody>
          {rows.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2}>סה&quot;כ לחודש</TableCell>
                <TableCell className="font-bold">{formatMoney(total)}</TableCell>
                <TableCell colSpan={2} />
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </div>
  );
}
