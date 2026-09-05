"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { TimeField, TIME_RE } from "@/components/ui/time-field";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { StopShiftButton } from "@/app/dashboard/workers/stop-shift-button";
import {
  updateShiftTimes,
  deleteShift,
} from "@/app/dashboard/workers/actions";

export type DayShift = {
  id: string;
  /** Israel-local HH:MM of the clock-in. */
  startTime: string;
  /** Israel-local HH:MM of the clock-out — null while the shift is open. */
  endTime: string | null;
};

/** One shift's two clock times, saved on its own. */
function ShiftFields({
  shift,
  index,
  onSaved,
}: {
  shift: DayShift;
  index: number;
  /** Closes the dialog once a change has gone through. */
  onSaved: () => void;
}) {
  const isOpen = shift.endTime === null;
  const [start, setStart] = useState(shift.startTime);
  const [end, setEnd] = useState(shift.endTime ?? "");
  const [pending, setPending] = useState(false);

  const changed = start !== shift.startTime || end !== (shift.endTime ?? "");
  const valid = TIME_RE.test(start) && (end === "" || TIME_RE.test(end));

  async function onSave() {
    setPending(true);
    const result = await updateShiftTimes(shift.id, start, end || null);
    setPending(false);
    if (result.ok) {
      toast.success(isOpen && end ? "המשמרת נסגרה" : "שעות המשמרת עודכנו");
      onSaved();
    } else {
      toast.error(result.error ?? "שגיאה");
    }
  }

  async function onDelete() {
    if (!confirm("למחוק את המשמרת?")) return;
    setPending(true);
    const result = await deleteShift(shift.id);
    setPending(false);
    if (result.ok) {
      toast.success("המשמרת נמחקה");
      onSaved();
    } else {
      toast.error(result.error ?? "שגיאה");
    }
  }

  return (
    <div className="grid gap-3 rounded-lg border p-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label htmlFor={`shift_in_${shift.id}`}>כניסה</Label>
          <TimeField
            id={`shift_in_${shift.id}`}
            value={start}
            onChange={setStart}
            className="h-9"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`shift_out_${shift.id}`}>יציאה</Label>
          <TimeField
            id={`shift_out_${shift.id}`}
            value={end}
            onChange={setEnd}
            className="h-9"
          />
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">
          משמרת {index + 1}
          {isOpen && " · במשמרת"}
        </span>
        <div className="flex gap-1">
          {isOpen && <StopShiftButton shiftId={shift.id} />}
          <Button
            size="icon"
            variant="ghost"
            aria-label="מחיקת משמרת"
            className="text-destructive"
            disabled={pending}
            onClick={onDelete}
          >
            <Trash2 className="size-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending || !changed || !valid}
            onClick={onSave}
          >
            {pending ? "שומר..." : "שמירה"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Pencil next to a worker's hours in מבט יומי — that day's shifts with
 * their clock times editable, and a bin for one that should not be there.
 *
 * Adding a shift lives on the משמרת חדשה button above the table, which
 * reaches every worker rather than only the ones already on it.
 *
 * It closes itself once a change goes through: the row behind it is what
 * the admin came to check, and leaving the box sitting open over stale
 * fields made a saved edit look like it had not taken.
 */
export function ShiftHoursDialog({
  workerName,
  shifts,
}: {
  workerName: string;
  shifts: DayShift[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          aria-label={`עריכת שעות — ${workerName}`}
          disabled={shifts.length === 0}
        >
          <Pencil className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>שעות עבודה — {workerName}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          {shifts.map((s, i) => (
            <ShiftFields
              key={s.id}
              shift={s}
              index={i}
              onSaved={() => setOpen(false)}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
