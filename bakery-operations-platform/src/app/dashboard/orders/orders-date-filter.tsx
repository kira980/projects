"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { jerusalemToday, jerusalemTomorrow } from "@/lib/delivery-day";

/**
 * Delivery-date filter for the orders list: a date input plus quick
 * chips. Preserves the current status filter; "כל התאריכים" clears it.
 */
export function OrdersDateFilter({ date }: { date: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function apply(next: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set("date", next);
    else params.set("date", "all");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        type="date"
        dir="ltr"
        value={date === "all" ? "" : date}
        onChange={(e) => {
          // Blur first: picking a date navigates, and the picker would
          // otherwise stay open over the filtered list.
          e.target.blur();
          apply(e.target.value || null);
        }}
        className="w-40"
        aria-label="סינון לפי תאריך אספקה"
      />
      <Button
        type="button"
        size="sm"
        variant={date === jerusalemToday() ? "default" : "outline"}
        onClick={() => apply(jerusalemToday())}
      >
        היום
      </Button>
      <Button
        type="button"
        size="sm"
        variant={date === jerusalemTomorrow() ? "default" : "outline"}
        onClick={() => apply(jerusalemTomorrow())}
      >
        מחר
      </Button>
      <Button
        type="button"
        size="sm"
        variant={date === "all" ? "default" : "outline"}
        onClick={() => apply(null)}
      >
        כל התאריכים
      </Button>
    </div>
  );
}
