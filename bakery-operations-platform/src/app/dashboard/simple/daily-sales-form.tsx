"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Lock, LockOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveDailySales, closeDay, reopenDay } from "./actions";

/**
 * What is left in the till, plus the day lock.
 *
 * The day's takings are NOT here any more: מזומן / ויזה / אחר are encrypted
 * in the owner's browser and live only in /secret, so this server has no
 * way to show or collect them. The till is different — the shift manager
 * records it from the kiosk at סיום יום, and has no passphrase — so it
 * stays readable and editable here.
 */
export function DailySalesForm({
  today,
  locked,
  left,
}: {
  today: string;
  locked: boolean;
  left: number | null;
}) {
  const [pending, setPending] = useState(false);

  async function onSave(formData: FormData) {
    setPending(true);
    formData.set("sales_date", today);
    const result = await saveDailySales(formData);
    setPending(false);
    if (result.ok) toast.success("נשמר");
    else toast.error(result.error ?? "שגיאה");
  }

  async function onToggleLock() {
    if (
      !locked &&
      !confirm("לנעול את היום? לאחר הנעילה לא ניתן יהיה לרשום פעולות כספיות ליום זה.")
    ) {
      return;
    }
    setPending(true);
    const result = locked ? await reopenDay(today) : await closeDay(today);
    setPending(false);
    if (result.ok) toast.success(locked ? "היום נפתח מחדש" : "היום ננעל");
    else toast.error(result.error ?? "שגיאה");
  }

  return (
    <form
      action={onSave}
      className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3" autoComplete="off">
      <div className="grid gap-1">
        <Label htmlFor="left_in_register" className="text-xs text-muted-foreground">
          נשאר בקופה (₪)
        </Label>
        <Input
          id="left_in_register"
          name="left_in_register"
          type="number"
          min="0"
          step="0.01"
          dir="ltr"
          defaultValue={left ?? ""}
          disabled={locked}
          className="h-10 w-32"
        />
      </div>
      <Button type="submit" size="sm" disabled={pending || locked}>
        {pending ? "שומר..." : "שמירה"}
      </Button>
      <Button
        type="button"
        size="sm"
        variant={locked ? "outline" : "destructive"}
        disabled={pending}
        onClick={onToggleLock}
        className="ms-auto"
      >
        {locked ? <LockOpen className="size-4" /> : <Lock className="size-4" />}
        {locked ? "פתיחת היום מחדש" : "נעילת יום"}
      </Button>
    </form>
  );
}
