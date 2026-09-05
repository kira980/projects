"use client";

import { useState } from "react";
import { toast } from "sonner";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { TimeField, TIME_RE } from "@/components/ui/time-field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toTimeInput } from "@/lib/format";
import { stopShift } from "./actions";

/**
 * Ends an open shift, asking for the finish time first.
 *
 * It opens on the current time, which is right almost every time, and can
 * be corrected — the worker left at 22:00 and the office only gets to it
 * later. A reading later than now is read as yesterday's, so a shift that
 * ran past midnight needs no date.
 */
export function StopShiftButton({
  shiftId,
  workerName,
}: {
  shiftId: string;
  workerName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [time, setTime] = useState("");
  const [pending, setPending] = useState(false);

  function onOpenChange(next: boolean) {
    // Fresh "now" each time it opens, not the last edit.
    if (next) setTime(toTimeInput(new Date()));
    setOpen(next);
  }

  async function onConfirm() {
    setPending(true);
    const result = await stopShift(shiftId, time);
    setPending(false);
    if (result.ok) {
      toast.success("המשמרת הסתיימה");
      setOpen(false);
    } else {
      toast.error(result.error ?? "שגיאה");
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant="destructive"
        onClick={() => onOpenChange(true)}
        title="סיום המשמרת"
      >
        <LogOut className="size-3.5" />
        סיום
      </Button>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>סיום משמרת{workerName ? ` — ${workerName}` : ""}</DialogTitle>
            <DialogDescription>
              ברירת המחדל היא השעה עכשיו — אפשר לשנות.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <Label htmlFor={`stop_time_${shiftId}`}>שעת יציאה</Label>
            <TimeField
              id={`stop_time_${shiftId}`}
              value={time}
              onChange={setTime}
              className="h-14 text-2xl font-bold"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setOpen(false)}
            >
              ביטול
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              disabled={pending || !TIME_RE.test(time)}
              onClick={onConfirm}
            >
              {pending ? "שומר..." : "סיום משמרת"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
