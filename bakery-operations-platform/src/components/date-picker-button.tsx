"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DAY_NAMES,
  MONTH_NAMES,
  monthGrid,
  monthLabel,
  shiftMonth,
} from "@/lib/calendar";
import { cn } from "@/lib/utils";

/**
 * Tap a label, get a calendar, tap a day: it navigates and closes.
 *
 * Two things this deliberately does NOT do:
 *
 * 1. Use the platform picker via showPicker(). That picker is anchored to an
 *    input which never receives focus, so nothing can dismiss it — it stayed
 *    open on top of the page the pick had just navigated to.
 *
 * 2. Position itself inside the layout. The dashboard shell's <main> is
 *    overflow-y-auto (which makes overflow-x compute to auto as well) and the
 *    report tables sit in overflow-x-auto wrappers, so a panel wider than its
 *    trigger got clipped mid-grid. It is rendered in a portal on <body> with
 *    fixed positioning, clamped to the viewport, so no ancestor can cut it.
 */

const PANEL_WIDTH = 288;
const VIEWPORT_MARGIN = 8;
const GAP = 8;

export function DatePickerButton({
  value,
  onPick,
  label,
  mode = "date",
  today,
  className,
  ariaLabel = "בחירת תאריך",
}: {
  /** YYYY-MM-DD, or YYYY-MM when mode is "month". */
  value: string;
  onPick: (value: string) => void;
  /** What the trigger shows — usually the formatted value. */
  label: string;
  mode?: "date" | "month";
  /** YYYY-MM-DD of today, outlined in the grid when given. */
  today?: string;
  className?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  // Which month the day grid shows / which year the month grid shows.
  const [view, setView] = useState(value.slice(0, 7));
  const [pos, setPos] = useState<{ top: number; left: number; width: number }>();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  /** Centre the panel under the trigger, kept fully on screen. */
  const place = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const r = trigger.getBoundingClientRect();
    const width = Math.min(PANEL_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2);

    const centred = r.left + r.width / 2 - width / 2;
    const left = Math.max(
      VIEWPORT_MARGIN,
      Math.min(centred, window.innerWidth - width - VIEWPORT_MARGIN)
    );

    // Flip above the trigger when there isn't room below it.
    const height = panelRef.current?.offsetHeight ?? 330;
    const below = r.bottom + GAP;
    const top =
      below + height > window.innerHeight - VIEWPORT_MARGIN && r.top - GAP > height
        ? r.top - GAP - height
        : below;

    setPos({ top, left, width });
  }, []);

  function toggle() {
    // Reopening lands on the selected value, not wherever we browsed to.
    setView(value.slice(0, 7));
    setOpen((v) => !v);
  }

  function pick(picked: string) {
    setOpen(false);
    onPick(picked);
  }

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      // The trigger handles its own toggle.
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    // Capture, so scrolling any ancestor keeps the panel on its trigger.
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  // Placed from the panel's real height, and again when the grid's row count
  // changes (a month can need five rows or six).
  useEffect(() => {
    if (open) place();
  }, [open, view, mode, place]);

  const viewYear = view.slice(0, 4);

  const panel = (
    <div
      ref={panelRef}
      // Width is set before the first measurement, so the height that decides
      // "below or above the trigger" is the height it will actually have.
      style={{ top: pos?.top ?? 0, left: pos?.left ?? 0, width: pos?.width ?? PANEL_WIDTH }}
      className={cn(
        "fixed z-50 max-w-[calc(100vw-1rem)] rounded-xl border bg-popover p-3 text-popover-foreground shadow-lg",
        // Hidden until measured, so it never flashes in the wrong place.
        pos ? "visible" : "invisible"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label={mode === "month" ? "שנה קודמת" : "חודש קודם"}
          onClick={() => setView(shiftMonth(view, mode === "month" ? -12 : -1))}
        >
          <ChevronRight className="size-5" />
        </Button>
        <span className="font-semibold">
          {mode === "month" ? viewYear : monthLabel(view)}
        </span>
        <Button
          variant="ghost"
          size="icon"
          aria-label={mode === "month" ? "שנה הבאה" : "חודש הבא"}
          onClick={() => setView(shiftMonth(view, mode === "month" ? 12 : 1))}
        >
          <ChevronLeft className="size-5" />
        </Button>
      </div>

      {mode === "month" ? (
        <div className="mt-2 grid grid-cols-3 gap-1">
          {MONTH_NAMES.map((name, i) => {
            const ym = `${viewYear}-${String(i + 1).padStart(2, "0")}`;
            return (
              <button
                key={ym}
                type="button"
                onClick={() => pick(ym)}
                className={cn(
                  "flex h-10 min-w-0 items-center justify-center rounded-md text-sm font-medium hover:bg-muted",
                  ym === value && "bg-primary text-primary-foreground hover:bg-primary",
                  ym !== value && today?.startsWith(ym) && "ring-1 ring-primary"
                )}
              >
                {name}
              </button>
            );
          })}
        </div>
      ) : (
        <>
          {/* Seven equal columns, so no day can be squeezed out of view. */}
          <div className="mt-2 grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
            {DAY_NAMES.map((d) => (
              <span key={d} className="min-w-0">
                {d}
              </span>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {monthGrid(view).map((d, i) =>
              d === null ? (
                <span key={`pad-${i}`} />
              ) : (
                <button
                  key={d}
                  type="button"
                  onClick={() => pick(d)}
                  className={cn(
                    "flex h-9 min-w-0 items-center justify-center rounded-md text-sm font-medium hover:bg-muted",
                    d === value && "bg-primary text-primary-foreground hover:bg-primary",
                    d !== value && d === today && "ring-1 ring-primary"
                  )}
                >
                  {Number(d.slice(-2))}
                </button>
              )
            )}
          </div>
        </>
      )}
    </div>
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        className={cn(
          "rounded-md px-2 py-1 text-center font-medium hover:bg-muted",
          className
        )}
        aria-label={ariaLabel}
        aria-expanded={open}
      >
        {label}
      </button>
      {open && createPortal(panel, document.body)}
    </>
  );
}
