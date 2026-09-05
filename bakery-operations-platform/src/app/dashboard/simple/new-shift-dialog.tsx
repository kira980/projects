"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { TimeField, TIME_RE } from "@/components/ui/time-field";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createShift } from "@/app/dashboard/workers/actions";

/**
 * Opens a shift for any worker on the day being viewed — including one who
 * has no activity that day and so isn't in the table at all.
 *
 * An empty out time leaves the shift open, which is what "he is here now"
 * means; the pencil on the row closes it later.
 */
export function NewShiftDialog({
  workers,
  date,
}: {
  workers: { id: string; full_name: string }[];
  /** Business day the shift lands on (YYYY-MM-DD). */
  date: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [workerId, setWorkerId] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const valid =
    workerId && TIME_RE.test(start) && (end === "" || TIME_RE.test(end));

  async function onSave() {
    setPending(true);
    const result = await createShift(workerId, date, start, end || null);
    setPending(false);
    if (result.ok) {
      toast.success("המשמרת נוספה");
      setOpen(false);
      setWorkerId("");
      setStart("");
      setEnd("");
    } else {
      toast.error(result.error ?? "שגיאה");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="size-4" />
          משמרת חדשה
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>משמרת חדשה</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>עובד *</Label>
            <SearchableSelect
              options={workers.map((w) => ({
                value: w.id,
                label: w.full_name,
              }))}
              value={workerId}
              onChange={setWorkerId}
              placeholder="בחרו עובד..."
              searchPlaceholder="חיפוש עובד..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="new_shift_in">כניסה *</Label>
              <TimeField
                id="new_shift_in"
                value={start}
                onChange={setStart}
                className="h-10"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new_shift_out">יציאה</Label>
              <TimeField
                id="new_shift_out"
                value={end}
                onChange={setEnd}
                className="h-10"
              />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            יציאה ריקה = המשמרת נשארת פתוחה.
          </p>
          <Button disabled={pending || !valid} onClick={onSave}>
            {pending ? "שומר..." : "הוספת משמרת"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
