"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/lib/format";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { updateExpense, deleteExpense } from "./actions";

const METHODS = [
  { value: "cash", label: "מזומן" },
  { value: "card", label: "אשראי" },
  { value: "transfer", label: "העברה" },
  { value: "check", label: "צ'ק" },
  { value: "other", label: "אחר" },
];

/** An expense as the edit form needs it. */
export type EditableExpense = {
  id: string;
  amount: number;
  method: string | null;
  description: string | null;
};

/**
 * Pencil + trash for one expense (פירוט תשלומים → תשלומים אחרים). The
 * receipt already on file is kept as is — only the amount, the method and
 * the description are editable.
 */
export function ExpenseActions({ expense }: { expense: EditableExpense }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [method, setMethod] = useState(expense.method ?? "cash");

  async function onSubmit(formData: FormData) {
    formData.set("method", method);
    setPending(true);
    const result = await updateExpense(expense.id, formData);
    setPending(false);
    if (result.ok) {
      toast.success("ההוצאה עודכנה");
      setOpen(false);
    } else {
      toast.error(result.error ?? "שגיאה");
    }
  }

  async function onDelete() {
    const what = expense.description ? ` (${expense.description})` : "";
    if (!confirm(`למחוק את ההוצאה${what} על ${formatMoney(expense.amount)}?`)) {
      return;
    }
    setPending(true);
    const result = await deleteExpense(expense.id);
    setPending(false);
    if (result.ok) toast.success("ההוצאה נמחקה");
    else toast.error(result.error ?? "שגיאה");
  }

  return (
    <div className="flex gap-1">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="icon" variant="ghost" aria-label="עריכה" disabled={pending}>
            <Pencil className="size-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>עריכת הוצאה</DialogTitle>
          </DialogHeader>
          <form action={onSubmit} className="grid gap-4" autoComplete="off">
            <div className="grid gap-2">
              <Label htmlFor="ex_amount">סכום (₪) *</Label>
              <Input
                id="ex_amount"
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                dir="ltr"
                defaultValue={expense.amount}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label>אמצעי תשלום</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ex_description">תיאור *</Label>
              <Textarea
                id="ex_description"
                name="description"
                rows={2}
                defaultValue={expense.description ?? ""}
                required
              />
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? "שומר..." : "שמירת השינויים"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
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
  );
}
