"use client";

import { useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePickerButton } from "@/components/date-picker-button";
import { shiftDate } from "@/lib/calendar";
import { formatDate } from "@/lib/format";

/**
 * Day navigator for the simple dashboard: arrows move a day back/forward,
 * clicking the date opens a picker, "היום" jumps back to today.
 */
export function SimpleDateNav({ date, today }: { date: string; today: string }) {
  const router = useRouter();

  function go(d: string) {
    router.push(d === today ? "/dashboard/simple" : `/dashboard/simple?date=${d}`);
  }

  function shiftDay(delta: number) {
    go(shiftDate(date, delta));
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" aria-label="יום קודם" onClick={() => shiftDay(-1)}>
        <ChevronRight className="size-5" />
      </Button>
      <DatePickerButton
        value={date}
        label={formatDate(date)}
        onPick={go}
        today={today}
        className="min-w-28"
      />
      <Button variant="outline" size="icon" aria-label="יום הבא" onClick={() => shiftDay(1)}>
        <ChevronLeft className="size-5" />
      </Button>
      {date !== today && (
        <Button variant="outline" size="sm" onClick={() => go(today)}>
          <CalendarDays className="size-4" />
          היום
        </Button>
      )}
    </div>
  );
}
