import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getWorkerSession } from "@/lib/kiosk/session";
import { createServiceClient } from "@/lib/supabase/server";
import { businessToday, jerusalemDayRange } from "@/lib/db/day-lock";
import { formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

const METHOD_LABELS: Record<string, string> = {
  cash: "מזומן",
  card: "אשראי",
  transfer: "העברה",
  check: "צ'ק",
  other: "אחר",
};

export default async function DriverSummaryPage() {
  const session = await getWorkerSession("driver");
  if (!session) redirect("/driver");

  const supabase = createServiceClient();
  const { start, end } = jerusalemDayRange(businessToday());

  const { data: payments } = await supabase
    .from("payments")
    .select("amount, method")
    .eq("business_id", session.businessId)
    .eq("collected_by_type", "worker")
    .eq("collected_by_id", session.workerId)
    .gte("paid_at", start)
    .lt("paid_at", end);

  const byMethod = new Map<string, number>();
  let total = 0;
  for (const p of payments ?? []) {
    byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + Number(p.amount));
    total += Number(p.amount);
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild aria-label="חזרה">
          <Link href="/driver/orders">
            <ArrowRight className="size-6" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">סיכום גבייה יומי</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>סה&quot;כ נגבה היום</CardTitle>
        </CardHeader>
        <CardContent className="text-4xl font-bold">{formatMoney(total)}</CardContent>
      </Card>

      <div className="grid gap-2">
        {[...byMethod.entries()].map(([method, sum]) => (
          <div
            key={method}
            className="flex items-center justify-between rounded-xl border bg-card p-4"
          >
            <span className="text-lg">{METHOD_LABELS[method] ?? method}</span>
            <span className="text-xl font-bold">{formatMoney(sum)}</span>
          </div>
        ))}
        {byMethod.size === 0 && (
          <p className="py-8 text-center text-muted-foreground">
            עדיין לא נגבו תשלומים היום
          </p>
        )}
      </div>

      <p className="text-center text-sm text-muted-foreground">
        {payments?.length ?? 0} תשלומים · יש למסור את הכסף בקופה בסוף היום
      </p>
    </main>
  );
}
