"use client";

import { useRouter, usePathname } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePickerButton } from "@/components/date-picker-button";
import { shiftDate } from "@/lib/calendar";
import { jerusalemToday } from "@/lib/delivery-day";
import { formatDate } from "@/lib/format";

/**
 * Minimal deliveries/takeaway filter: a single day (arrows + clickable
 * date picker + "today") and a free-text search by order code.
 */
export function DeliveriesFilterBar({
  date,
  q,
  searchPlaceholder = "חיפוש לפי מספר...",
}: {
  date: string;
  q: string;
  searchPlaceholder?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  function apply(next: { date?: string; q?: string }) {
    const merged = { date, q, ...next };
    const params = new URLSearchParams();
    if (merged.date) params.set("date", merged.date);
    if (merged.q) params.set("q", merged.q);
    router.push(`${pathname}?${params.toString()}`);
  }

  function shiftDay(delta: number) {
    apply({ date: shiftDate(date, delta) });
  }

  function today() {
    apply({ date: jerusalemToday() });
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" aria-label="יום קודם" onClick={() => shiftDay(-1)}>
          <ChevronRight className="size-5" />
        </Button>
        <DatePickerButton
          value={date}
          label={formatDate(date)}
          onPick={(picked) => apply({ date: picked })}
          today={jerusalemToday()}
          className="min-w-28"
        />
        <Button variant="outline" size="icon" aria-label="יום הבא" onClick={() => shiftDay(1)}>
          <ChevronLeft className="size-5" />
        </Button>
        <Button variant="outline" size="sm" onClick={today}>
          <CalendarDays className="size-4" />
          היום
        </Button>
      </div>

      <div className="relative min-w-48 flex-1">
        <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          defaultValue={q}
          placeholder={searchPlaceholder}
          className="h-10 ps-9"
          onKeyDown={(e) => {
            if (e.key === "Enter") apply({ q: (e.target as HTMLInputElement).value });
          }}
          onBlur={(e) => {
            if (e.target.value !== q) apply({ q: e.target.value });
          }}
        />
      </div>
    </div>
  );
}
