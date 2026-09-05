"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Lock, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate, formatMoney } from "@/lib/format";
import { saveDailySales } from "../actions";

export type RegisterDay = {
  date: string;
  /** What was left in the register, or null when nobody recorded it. */
  left: number | null;
  locked: boolean;
};

/** A figure that was never entered reads differently from a zero. */
function Amount({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="text-muted-foreground">לא נרשם</span>;
  }
  return <>{formatMoney(value)}</>;
}

/** One day's till, with a pencil that opens it for editing. */
export function RegisterRow({ day }: { day: RegisterDay }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [left, setLeft] = useState(day.left != null ? String(day.left) : "");

  async function onSave() {
    const formData = new FormData();
    formData.set("sales_date", day.date);
    formData.set("left_in_register", left);

    setPending(true);
    const result = await saveDailySales(formData);
    setPending(false);
    if (result.ok) {
      toast.success("נשמר");
      setOpen(false);
    } else {
      toast.error(result.error ?? "שגיאה");
    }
  }

  const field = (
    id: string,
    label: string,
    value: string,
    onChange: (v: string) => void,
    placeholder?: string
  ) => (
    <div className="grid gap-2">
      <Label htmlFor={`${id}_${day.date}`}>{label}</Label>
      <Input
        id={`${id}_${day.date}`}
        type="number"
        min="0"
        step="0.01"
        dir="ltr"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );

  return (
    <>
      <TableRow>
        <TableCell className="font-medium whitespace-nowrap">
          {formatDate(day.date)}
        </TableCell>
        <TableCell className={day.left === null ? "" : "font-medium"}>
          <Amount value={day.left} />
        </TableCell>
        <TableCell>
          {day.locked ? (
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <Lock className="size-3.5" />
              נעול
            </span>
          ) : (
            <Button
              size="icon"
              variant="ghost"
              aria-label={`עריכת ${formatDate(day.date)}`}
              onClick={() => setOpen(true)}
            >
              <Pencil className="size-4" />
            </Button>
          )}
        </TableCell>
      </TableRow>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>כסף בקופה — {formatDate(day.date)}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            {field("left", "נשאר בקופה (₪)", left, setLeft, "לא נרשם")}
            <Button disabled={pending} onClick={onSave}>
              {pending ? "שומר..." : "שמירה"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
