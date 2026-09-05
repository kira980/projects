"use client";

import { useState } from "react";
import { toast } from "sonner";
import { HandCoins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { TimeField } from "@/components/ui/time-field";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { businessToday } from "@/lib/db/day-lock";
import { createAdvance } from "./actions";

/**
 * Records an advance from the dashboard — for money handed over on a day
 * that has already passed, or outside the kiosk altogether. The kiosk can
 * only ever write the day that is running, so this is the only way an
 * advance ever reaches an earlier day.
 */
export function AdvanceDialog({
  workers,
  defaultDate,
}: {
  workers: { id: string; full_name: string }[];
  /** Day the advance lands on — the day being viewed. Defaults to today. */
  defaultDate?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [workerId, setWorkerId] = useState("");
  const [time, setTime] = useState("");

  async function onSubmit(formData: FormData) {
    setPending(true);
    const result = await createAdvance(
      workerId,
      Number(formData.get("amount")),
      String(formData.get("date") ?? ""),
      time || null,
      String(formData.get("notes") ?? "") || null
    );
    setPending(false);
    if (result.ok) {
      toast.success("המפרעה נרשמה");
      setOpen(false);
      setWorkerId("");
      setTime("");
    } else {
      toast.error(result.error ?? "שגיאה");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <HandCoins className="size-4" />
          רישום מפרעה
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>רישום מפרעה</DialogTitle>
        </DialogHeader>
        <form action={onSubmit} className="grid gap-4" autoComplete="off">
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
          <div className="grid gap-2">
            <Label htmlFor="adv_amount">סכום (₪) *</Label>
            <Input
              id="adv_amount"
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              dir="ltr"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="adv_date">תאריך *</Label>
              <Input
                id="adv_date"
                name="date"
                type="date"
                dir="ltr"
                defaultValue={defaultDate ?? businessToday()}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="adv_time">שעה</Label>
              <TimeField id="adv_time" value={time} onChange={setTime} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="adv_notes">הערה</Label>
            <Textarea id="adv_notes" name="notes" rows={2} />
          </div>
          <Button type="submit" disabled={pending || !workerId}>
            {pending ? "שומר..." : "שמירת מפרעה"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
