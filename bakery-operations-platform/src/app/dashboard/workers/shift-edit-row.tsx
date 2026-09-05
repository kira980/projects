"use client";

import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TimeField, TIME_RE } from "@/components/ui/time-field";
import { TableCell, TableRow } from "@/components/ui/table";
import { StopShiftButton } from "./stop-shift-button";
import { updateShiftTimes, deleteShift } from "./actions";

export type EditableShift = {
  id: string;
  /** Israel-local HH:MM of the clock-in. */
  startTime: string;
  /** Israel-local HH:MM of the clock-out — null while the shift is open. */
  endTime: string | null;
  hoursLabel: string;
};

/**
 * Attendance row where the admin can correct the clock times or drop the
 * shift. Filling in the out time of a shift that is still open closes it —
 * the fix for a worker who went home without clocking out.
 */
export function ShiftEditRow({
  shift,
  leading,
  trailing,
}: {
  shift: EditableShift;
  /** Cells rendered before the time cells (date / worker name). */
  leading?: ReactNode;
  /** Cells rendered after the hours cell (notes). */
  trailing?: ReactNode;
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
    } else {
      toast.error(result.error ?? "שגיאה");
    }
  }

  async function onDelete() {
    if (!confirm("למחוק את המשמרת?")) return;
    setPending(true);
    const result = await deleteShift(shift.id);
    setPending(false);
    if (result.ok) toast.success("המשמרת נמחקה");
    else toast.error(result.error ?? "שגיאה");
  }

  return (
    <TableRow>
      {leading}
      <TableCell>
        <TimeField
          value={start}
          onChange={setStart}
          aria-label="שעת כניסה"
          className="h-9 w-24"
        />
      </TableCell>
      <TableCell>
        <TimeField
          value={end}
          onChange={setEnd}
          aria-label="שעת יציאה"
          title={isOpen ? "העובד/ת עדיין במשמרת — מילוי שעה יסגור אותה" : undefined}
          className="h-9 w-24"
        />
      </TableCell>
      <TableCell>{isOpen ? "במשמרת" : shift.hoursLabel}</TableCell>
      {trailing}
      <TableCell>
        <div className="flex gap-1">
          {isOpen && <StopShiftButton shiftId={shift.id} />}
          <Button
            size="sm"
            variant="outline"
            disabled={pending || !changed || !valid}
            onClick={onSave}
          >
            {pending ? "שומר..." : "שינוי"}
          </Button>
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
        </div>
      </TableCell>
    </TableRow>
  );
}
