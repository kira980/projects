import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getWorkerSession } from "@/lib/kiosk/session";
import { createServiceClient } from "@/lib/supabase/server";
import { businessToday } from "@/lib/db/day-lock";
import { formatDate } from "@/lib/format";
import { getLocale } from "@/lib/i18n/locale-actions";
import { t, unitLabel } from "@/lib/i18n/dictionary";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function TomorrowSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; type?: string }>;
}) {
  const session = await getWorkerSession("production");
  if (!session) redirect("/production");

  const sp = await searchParams;
  const locale = await getLocale();
  const tomorrow = addDays(businessToday(), 1);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : tomorrow;
  // The prep screen's type filter carries over: both kinds together by
  // default, or just משלוח / איסוף עצמי.
  const type =
    sp.type === "takeaway" ? "takeaway" : sp.type === "delivery" ? "delivery" : "all";
  const dayName = new Intl.DateTimeFormat(locale === "ar" ? "ar" : "he-IL", {
    timeZone: "Asia/Jerusalem",
    weekday: "long",
  }).format(new Date(`${date}T12:00:00Z`));

  const supabase = createServiceClient();
  let query = supabase
    .from("orders")
    .select("id, order_items(product_name, product_name_ar, quantity, unit_type)")
    .eq("business_id", session.businessId)
    .eq("delivery_date", date)
    .in("status", ["new", "preparing", "ready", "problem", "shortage"]);
  if (type !== "all") {
    query = query.eq("delivery_type", type === "takeaway" ? "pickup" : "delivery");
  }
  const { data: orders } = await query;

  // Group by product + unit.
  const totals = new Map<string, { name: string; unit: string; qty: number }>();
  let orderCount = 0;
  for (const o of orders ?? []) {
    orderCount++;
    const items = o.order_items as unknown as {
      product_name: string;
      product_name_ar: string | null;
      quantity: number;
      unit_type: string;
    }[];
    for (const item of items) {
      // Baker screen reads in Arabic; fall back to the Hebrew name.
      const name = item.product_name_ar?.trim() || item.product_name;
      const key = `${name}|${item.unit_type}`;
      const existing = totals.get(key);
      if (existing) existing.qty += Number(item.quantity);
      else
        totals.set(key, {
          name,
          unit: item.unit_type,
          qty: Number(item.quantity),
        });
    }
  }

  const rows = [...totals.values()].sort((a, b) => b.qty - a.qty);

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild aria-label={t("back", locale)}>
          <Link href={`/production/orders?date=${date}&type=${type}`}>
            <ArrowRight className="size-6" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{t("day_summary", locale)}</h1>
          <p className="text-sm text-muted-foreground">
            {dayName} · {formatDate(date)} · {orderCount} {t("orders_word", locale)} ·{" "}
            {t(
              type === "all"
                ? "type_all"
                : type === "takeaway"
                  ? "type_takeaway"
                  : "type_delivery",
              locale
            )}
          </p>
        </div>
      </div>

      <div className="grid gap-2">
        {rows.length === 0 && (
          <p className="py-16 text-center text-lg text-muted-foreground">
            {t("no_orders_day", locale)}
          </p>
        )}
        {rows.map((row) => (
          <div
            key={`${row.name}|${row.unit}`}
            className="flex items-center justify-between rounded-xl border bg-card p-4"
          >
            <span className="text-xl font-semibold">{row.name}</span>
            <span className="text-2xl font-bold">
              {row.qty}{" "}
              <span className="text-base font-normal text-muted-foreground">
                {unitLabel(row.unit, locale)}
              </span>
            </span>
          </div>
        ))}
      </div>
    </main>
  );
}
