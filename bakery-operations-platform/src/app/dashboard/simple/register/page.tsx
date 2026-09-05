import Link from "next/link";
import { ArrowRight, Vault } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { businessToday } from "@/lib/db/day-lock";
import { addDays } from "@/lib/reports";
import { formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RegisterRow, type RegisterDay } from "./register-row";

export const metadata = { title: "כסף בקופה" };

/** How many days back the table goes. */
const DAYS = 60;

/**
 * כסף בקופה — the closing till for every day, in one editable list.
 *
 * The takings are not here: they are encrypted in the owner's browser and
 * readable only in /secret. What remains is the till the shift manager
 * counts at סיום יום, where a night nobody closed shows up as a hole.
 */
export default async function RegisterHistoryPage() {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const today = businessToday();
  const first = addDays(today, -(DAYS - 1));

  const [{ data: sales }, { data: locks }] = await Promise.all([
    supabase
      .from("daily_sales")
      .select("sales_date, left_in_register")
      .eq("business_id", admin.business_id)
      .gte("sales_date", first)
      .lte("sales_date", today),
    supabase
      .from("day_locks")
      .select("lock_date, is_locked")
      .eq("business_id", admin.business_id)
      .gte("lock_date", first)
      .lte("lock_date", today),
  ]);

  const byDate = new Map((sales ?? []).map((s) => [s.sales_date, s]));
  const lockedDates = new Set(
    (locks ?? []).filter((l) => l.is_locked).map((l) => l.lock_date)
  );

  const days: RegisterDay[] = [];
  for (let d = today; d >= first; d = addDays(d, -1)) {
    const row = byDate.get(d);
    days.push({
      date: d,
      left: row?.left_in_register != null ? Number(row.left_in_register) : null,
      locked: lockedDates.has(d),
    });
  }

  const missing = days.filter((d) => d.left === null).length;
  const totalLeft = days.reduce((sum, d) => sum + (d.left ?? 0), 0);

  return (
    <div className="grid gap-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild aria-label="חזרה">
          <Link href="/dashboard/simple">
            <ArrowRight className="size-5" />
          </Link>
        </Button>
        <PageHeader
          title="כסף בקופה"
          description={`${DAYS} הימים האחרונים${
            missing > 0 ? ` · ${missing} ימים ללא רישום קופה` : ""
          }`}
        />
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>תאריך</TableHead>
              <TableHead>
                <span className="flex items-center gap-1">
                  <Vault className="size-4" />
                  נשאר בקופה
                </span>
              </TableHead>
              <TableHead className="w-20">עריכה</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {days.map((day) => (
              <RegisterRow key={day.date} day={day} />
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="text-sm text-muted-foreground">
        סך הכל שנרשם בקופה בתקופה: {formatMoney(totalLeft)}
      </p>
    </div>
  );
}
