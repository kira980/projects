"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { TimeField, TIME_RE } from "@/components/ui/time-field";
import { ReportNav } from "@/components/report-nav";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StopShiftButton } from "./stop-shift-button";
import { updateShiftTimes, createShift, deleteShift } from "./actions";

export type EditorShift = {
  id: string;
  startTime: string;
  endTime: string | null;
  hoursLabel: string;
};

/** One line of the grid: a day (by-worker mode) or a worker (by-day mode). */
export type EditorRow = {
  /** Worker the shifts belong to. */
  workerId: string;
  /** Business day the shifts belong to (YYYY-MM-DD). */
  date: string;
  /** What the first column shows — a weekday or a worker name. */
  label: string;
  shifts: EditorShift[];
};

/** An existing shift: its two times, saved, stopped or dropped on its own. */
function ShiftLine({
  shift,
  onAdd,
}: {
  shift: EditorShift;
  /** Given → a + that opens a blank line for a second shift that day. */
  onAdd?: () => void;
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
      toast.success(isOpen && end ? "המשמרת נסגרה" : "השעות עודכנו");
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
    <div className="flex flex-wrap items-center gap-2">
      <TimeField
        value={start}
        onChange={setStart}
        aria-label="שעת כניסה"
        className="h-9 w-24"
      />
      <span className="text-muted-foreground">–</span>
      <TimeField
        value={end}
        onChange={setEnd}
        aria-label="שעת יציאה"
        className="h-9 w-24"
      />
      <span className="w-20 text-sm text-muted-foreground">
        {isOpen ? <Badge variant="success">במשמרת</Badge> : shift.hoursLabel}
      </span>
      {isOpen && <StopShiftButton shiftId={shift.id} />}
      <Button
        size="sm"
        variant="outline"
        disabled={pending || !changed || !valid}
        onClick={onSave}
      >
        שמירה
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
      {onAdd && (
        <Button
          size="icon"
          variant="ghost"
          aria-label="הוספת משמרת נוספת"
          title="הוספת משמרת נוספת"
          disabled={pending}
          onClick={onAdd}
        >
          <Plus className="size-4" />
        </Button>
      )}
    </div>
  );
}

/** A blank line for a shift the clock never recorded. */
function AddLine({
  workerId,
  date,
  onDone,
}: {
  workerId: string;
  date: string;
  /** Called once the shift is saved, so an opened line can close again. */
  onDone?: () => void;
}) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [pending, setPending] = useState(false);

  const valid = TIME_RE.test(start) && (end === "" || TIME_RE.test(end));

  async function onAdd() {
    setPending(true);
    const result = await createShift(workerId, date, start, end || null);
    setPending(false);
    if (result.ok) {
      toast.success("המשמרת נוספה");
      setStart("");
      setEnd("");
      onDone?.();
    } else {
      toast.error(result.error ?? "שגיאה");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <TimeField
        value={start}
        onChange={setStart}
        aria-label="שעת כניסה חדשה"
        className="h-9 w-24"
      />
      <span className="text-muted-foreground">–</span>
      <TimeField
        value={end}
        onChange={setEnd}
        aria-label="שעת יציאה חדשה"
        className="h-9 w-24"
      />
      <span className="w-20" />
      <Button size="sm" variant="ghost" disabled={pending || !valid} onClick={onAdd}>
        <Plus className="size-4" />
        הוספה
      </Button>
      {onDone && (
        <Button size="sm" variant="ghost" disabled={pending} onClick={onDone}>
          ביטול
        </Button>
      )}
    </div>
  );
}

/**
 * One line of the grid: the shifts that are there, and a way to add one.
 *
 * A row that already has a shift keeps the blank fields out of sight —
 * most rows need no addition, and a column of empty boxes reads like work
 * waiting to be done. The + beside the bin opens one when it is wanted. A
 * row with nothing on it shows the blank line straight away, because that
 * is exactly the row that needs filling.
 */
function RowShifts({
  workerId,
  date,
  shifts,
}: {
  workerId: string;
  date: string;
  shifts: EditorShift[];
}) {
  const [adding, setAdding] = useState(false);
  const empty = shifts.length === 0;

  return (
    <div className="grid gap-2">
      {shifts.map((s, i) => (
        <ShiftLine
          key={s.id}
          shift={s}
          onAdd={
            i === shifts.length - 1 && !adding
              ? () => setAdding(true)
              : undefined
          }
        />
      ))}
      {(empty || adding) && (
        <AddLine
          workerId={workerId}
          date={date}
          onDone={empty ? undefined : () => setAdding(false)}
        />
      )}
    </div>
  );
}

/**
 * שעות עבודה — the grid where anything the clock missed gets fixed: a day
 * nobody clocked, a shift left open, times that need correcting.
 *
 * Two ways in, because the two questions are different. By day (the
 * default) is "who worked on Tuesday and for how long" — every worker on
 * one day. By worker is "what did Ali do this week" — every day for one
 * person.
 */
export function HoursEditor({
  mode,
  workers,
  workerId,
  date,
  from,
  to,
  rows,
}: {
  mode: "day" | "worker";
  workers: { id: string; full_name: string }[];
  workerId: string;
  /** The day being edited, in by-day mode. */
  date: string;
  from: string;
  to: string;
  rows: EditorRow[];
}) {
  const router = useRouter();

  function go(next: Record<string, string>) {
    const params = new URLSearchParams({
      view: "hours",
      mode,
      worker: workerId,
      date,
      from,
      to,
      ...next,
    });
    router.push(`/dashboard/workers?${params}`);
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        {/* Not the shared ViewToggle: its links rebuild the query from
            scratch, which would drop view=hours and bounce to the report. */}
        <div
          className="inline-flex w-fit items-center gap-1 rounded-lg bg-muted p-1"
          role="group"
          aria-label="בחירת תצוגה"
        >
          {(["day", "worker"] as const).map((m) => (
            <Button
              key={m}
              size="sm"
              variant={mode === m ? "default" : "ghost"}
              className={mode === m ? "" : "text-muted-foreground"}
              aria-current={mode === m ? "page" : undefined}
              onClick={() => go({ mode: m })}
            >
              {m === "day" ? "לפי יום" : "לפי עובד"}
            </Button>
          ))}
        </div>

        {mode === "day" ? (
          <ReportNav
            basePath="/dashboard/workers"
            extraParams={{ view: "hours", mode: "day" }}
            param="date"
            current={date}
            prev={shiftDate(date, -1)}
            next={shiftDate(date, 1)}
            label={date}
          />
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid gap-1">
              <Label className="text-xs text-muted-foreground">עובד</Label>
              <div className="w-52">
                <SearchableSelect
                  options={workers.map((w) => ({
                    value: w.id,
                    label: w.full_name,
                  }))}
                  value={workerId}
                  onChange={(v) => go({ worker: v })}
                  placeholder="בחרו עובד..."
                  searchPlaceholder="חיפוש עובד..."
                />
              </div>
            </div>
            <div className="grid gap-1">
              <Label htmlFor="hours_from" className="text-xs text-muted-foreground">
                מתאריך
              </Label>
              <Input
                id="hours_from"
                type="date"
                dir="ltr"
                defaultValue={from}
                onChange={(e) => e.target.value && go({ from: e.target.value })}
                className="h-10 w-40"
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="hours_to" className="text-xs text-muted-foreground">
                עד תאריך
              </Label>
              <Input
                id="hours_to"
                type="date"
                dir="ltr"
                defaultValue={to}
                onChange={(e) => e.target.value && go({ to: e.target.value })}
                className="h-10 w-40"
              />
            </div>
          </div>
        )}
      </div>

      {mode === "worker" && !workerId ? (
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
          בחרו עובד כדי לערוך את שעות העבודה שלו.
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-44">
                  {mode === "day" ? "עובד" : "יום"}
                </TableHead>
                <TableHead>משמרות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={2}
                    className="h-20 text-center text-muted-foreground"
                  >
                    אין עובדים פעילים להצגה
                  </TableCell>
                </TableRow>
              )}
              {rows.map((row) => (
                <TableRow key={`${row.workerId}:${row.date}`}>
                  <TableCell className="align-top font-medium whitespace-nowrap">
                    {row.label}
                  </TableCell>
                  <TableCell>
                    <RowShifts
                      workerId={row.workerId}
                      date={row.date}
                      shifts={row.shifts}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

/** Same as lib/reports addDays, inlined for the client bundle. */
function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
