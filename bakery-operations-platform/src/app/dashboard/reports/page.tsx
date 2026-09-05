import { ViewToggle } from "@/components/view-toggle";
import { DailyReport } from "./daily-report";
import { MonthlyReport } from "./monthly-report";

export const metadata = { title: "דוחות" };

/**
 * Financial reports: daily (default) / monthly, switched by a toggle.
 * Per-entity reports (customers, workers, vendors, products) live on
 * their own sections' pages.
 */
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string; month?: string }>;
}) {
  const sp = await searchParams;
  const view = sp.view === "monthly" ? "monthly" : "daily";

  return (
    <div className="grid gap-5">
      <ViewToggle
        basePath="/dashboard/reports"
        current={view}
        options={[
          { value: "daily", label: "דוח יומי" },
          { value: "monthly", label: "דוח חודשי" },
        ]}
      />
      {view === "monthly" ? (
        <MonthlyReport searchParams={searchParams} />
      ) : (
        <DailyReport searchParams={searchParams} />
      )}
    </div>
  );
}
