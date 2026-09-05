"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DAY_NAMES, monthGrid, monthLabel, shiftDate, shiftMonth } from "@/lib/calendar";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Day navigator for the workers' order screen: arrows move a day, tapping
 * the date opens a tap-friendly month calendar, "היום" jumps back to today.
 * The chosen tab (איסוף / משלוח) rides along in every link.
 */
export function OrdersDateNav({
  date,
  today,
  type,
}: {
  date: string;
  today: string;
  /** Kept across day changes so the tab doesn't reset. */
  type: "takeaway" | "delivery";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(date.slice(0, 7));
  const popoverRef = useRef<HTMLDivElement>(null);

  // Reopening lands on the selected day's month.
  function toggleOpen() {
    setMonth(date.slice(0, 7));
    setOpen((v) => !v);
  }

  // Tablet users close the calendar by tapping outside it.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!popoverRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function go(d: string) {
    setOpen(false);
    router.push(`/workers/orders?date=${d}&type=${type}`);
  }

  function shiftDay(delta: number) {
    go(shiftDate(date, delta));
  }

  return (
    <div className="relative flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        className="size-12"
        aria-label="יום קודם"
        onClick={() => shiftDay(-1)}
      >
        <ChevronRight className="size-6" />
      </Button>
      <button
        type="button"
        onClick={toggleOpen}
        className="min-w-32 flex-1 rounded-md px-2 py-2 text-center font-bold hover:bg-muted"
        aria-label="בחירת תאריך"
        aria-expanded={open}
      >
        {formatDate(date)}
      </button>
      {/* This screen keeps its own panel: full-width, larger touch targets
          and a "היום" button inside, tuned for the kiosk tablet. The
          dashboard uses the shared DatePickerButton. */}
      <Button
        variant="outline"
        size="icon"
        className="size-12"
        aria-label="יום הבא"
        onClick={() => shiftDay(1)}
      >
        <ChevronLeft className="size-6" />
      </Button>
      {date !== today && (
        <Button
          variant="outline"
          size="icon"
          className="size-12"
          aria-label="היום"
          onClick={() => go(today)}
        >
          <CalendarDays className="size-5" />
        </Button>
      )}

      {open && (
        <div
          ref={popoverRef}
          className="absolute top-full z-50 mt-2 w-full rounded-xl border bg-popover p-3 shadow-lg"
        >
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="icon"
              aria-label="חודש קודם"
              onClick={() => setMonth(shiftMonth(month, -1))}
            >
              <ChevronRight className="size-5" />
            </Button>
            <span className="font-semibold">
              {monthLabel(month)}
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="חודש הבא"
              onClick={() => setMonth(shiftMonth(month, 1))}
            >
              <ChevronLeft className="size-5" />
            </Button>
          </div>
          <div className="mt-2 grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
            {DAY_NAMES.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {monthGrid(month).map((d, i) =>
              d === null ? (
                <span key={`pad-${i}`} />
              ) : (
                <button
                  key={d}
                  type="button"
                  onClick={() => go(d)}
                  className={cn(
                    "flex h-10 items-center justify-center rounded-md text-base font-medium hover:bg-muted",
                    d === date && "bg-primary text-primary-foreground hover:bg-primary",
                    d !== date && d === today && "ring-1 ring-primary"
                  )}
                >
                  {Number(d.slice(-2))}
                </button>
              )
            )}
          </div>
          <Button
            variant="outline"
            className="mt-3 w-full"
            onClick={() => go(today)}
          >
            <CalendarDays className="size-4" />
            היום
          </Button>
        </div>
      )}
    </div>
  );
}
