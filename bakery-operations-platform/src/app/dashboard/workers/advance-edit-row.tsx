"use client";

import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableCell, TableRow } from "@/components/ui/table";
import { formatMoney } from "@/lib/format";
import { deleteAdvance, updateAdvance } from "./actions";

export type EditableAdvance = {
  id: string;
  amount: number;
  /** Only used in the delete confirmation text. */
  workerName?: string | null;
};

/**
 * An advance line the admin can correct or remove — the amount turns into
 * an input on the pencil, the trash removes the advance entirely. Used
 * wherever advances are listed (מבט יומי, פירוט תשלומים, פרופיל עובד), so
 * the surrounding cells come in as `leading` / `trailing`.
 */
export function AdvanceEditRow({
  advance,
  leading,
  trailing,
}: {
  advance: EditableAdvance;
  /** Cells rendered before the amount (date / worker name). */
  leading?: ReactNode;
  /** Cells rendered after the amount (method, time, notes…). */
  trailing?: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(advance.amount));
  const [pending, setPending] = useState(false);

  async function onSave() {
    setPending(true);
    const result = await updateAdvance(advance.id, Number(amount));
    setPending(false);
    if (result.ok) {
      toast.success("המפרעה עודכנה");
      setEditing(false);
    } else {
      toast.error(result.error ?? "שגיאה");
    }
  }

  async function onDelete() {
    const who = advance.workerName ? ` של ${advance.workerName}` : "";
    if (!confirm(`למחוק את המפרעה${who} על ${formatMoney(advance.amount)}?`)) {
      return;
    }
    setPending(true);
    const result = await deleteAdvance(advance.id);
    setPending(false);
    if (result.ok) toast.success("המפרעה נמחקה");
    else toast.error(result.error ?? "שגיאה");
  }

  return (
    <TableRow>
      {leading}
      <TableCell>
        {editing ? (
          <Input
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            dir="ltr"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-label="סכום המפרעה"
            className="h-9 w-28 text-center"
            autoFocus
          />
        ) : (
          <span className="font-medium text-destructive">
            {formatMoney(advance.amount)}
          </span>
        )}
      </TableCell>
      {trailing}
      <TableCell>
        <div className="flex gap-1">
          {editing ? (
            <>
              <Button
                size="icon"
                variant="ghost"
                aria-label="שמירה"
                disabled={pending || !amount || Number(amount) <= 0}
                onClick={onSave}
              >
                <Check className="size-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label="ביטול"
                disabled={pending}
                onClick={() => {
                  setEditing(false);
                  setAmount(String(advance.amount));
                }}
              >
                <X className="size-4" />
              </Button>
            </>
          ) : (
            <Button
              size="icon"
              variant="ghost"
              aria-label="עריכה"
              disabled={pending}
              onClick={() => setEditing(true)}
            >
              <Pencil className="size-4" />
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            aria-label="מחיקה"
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
