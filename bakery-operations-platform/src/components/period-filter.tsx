import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { ReportPeriod } from "@/lib/reports";

const LABELS: Record<ReportPeriod, string> = {
  daily: "יומי",
  monthly: "חודשי",
  all: "כל הזמן",
};

/** Daily/monthly/all-time toggle for report pages — preserves other query params. */
export function PeriodFilter({
  basePath,
  period,
  extraParams,
}: {
  basePath: string;
  period: ReportPeriod;
  extraParams?: Record<string, string>;
}) {
  const query = new URLSearchParams(extraParams);

  return (
    <div className="flex gap-2">
      {(["daily", "monthly", "all"] as ReportPeriod[]).map((p) => {
        const params = new URLSearchParams(query);
        params.set("period", p);
        return (
          <Button key={p} asChild size="sm" variant={period === p ? "default" : "outline"}>
            <Link href={`${basePath}?${params.toString()}`}>{LABELS[p]}</Link>
          </Button>
        );
      })}
    </div>
  );
}
