"use client";

import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatDate, formatMoney } from "@/lib/format";
import { businessToday } from "@/lib/db/day-lock";
import {
  createPrivatePayment,
  updatePrivatePayment,
  deletePrivatePayment,
} from "./actions";

export type PrivatePayment = {
  id: string;
  amount: number;
  paid_to: string;
  paid_on: string;
  notes: string | null;
};

/** Add a payment, or edit one already written down. */
export function PaymentDialog({
  payment,
  trigger,
}: {
  payment?: PrivatePayment;
  trigger?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    const result = payment
      ? await updatePrivatePayment(payment.id, formData)
      : await createPrivatePayment(formData);
    setPending(false);
    if (result.ok) {
      toast.success(payment ? "התשלום עודכן" : "התשלום נרשם");
      setOpen(false);
    } else {
      toast.error(result.error ?? "שגיאה");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="lg">
            <Plus />
            תשלום חדש
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {payment ? "עריכת תשלום" : "רישום תשלום פרטי"}
          </DialogTitle>
        </DialogHeader>
        <form action={onSubmit} className="grid gap-4" autoComplete="off">
          <div className="grid gap-2">
            <Label htmlFor="pp_to">למי שולם *</Label>
            <Input
              id="pp_to"
              name="paid_to"
              defaultValue={payment?.paid_to ?? ""}
              required
              autoComplete="off"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="pp_amount">סכום (₪) *</Label>
              <Input
                id="pp_amount"
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                dir="ltr"
                defaultValue={payment?.amount ?? ""}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pp_date">תאריך *</Label>
              <Input
                id="pp_date"
                name="paid_on"
                type="date"
                dir="ltr"
                defaultValue={payment?.paid_on ?? businessToday()}
                required
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pp_notes">הערות</Label>
            <Textarea
              id="pp_notes"
              name="notes"
              rows={3}
              defaultValue={payment?.notes ?? ""}
            />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "שומר..." : payment ? "שמירת השינויים" : "שמירת תשלום"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** One payment in the table, with its pencil and bin. */
export function PaymentRow({ payment }: { payment: PrivatePayment }) {
  const [pending, setPending] = useState(false);

  async function onDelete() {
    if (
      !confirm(
        `למחוק את התשלום ל${payment.paid_to} על ${formatMoney(payment.amount)}?`
      )
    ) {
      return;
    }
    setPending(true);
    const result = await deletePrivatePayment(payment.id);
    setPending(false);
    if (result.ok) toast.success("התשלום נמחק");
    else toast.error(result.error ?? "שגיאה");
  }

  return (
    <TableRow>
      <TableCell className="whitespace-nowrap">
        {formatDate(payment.paid_on)}
      </TableCell>
      <TableCell className="font-medium">{payment.paid_to}</TableCell>
      <TableCell className="font-medium">
        {formatMoney(payment.amount)}
      </TableCell>
      <TableCell className="max-w-64 whitespace-pre-wrap text-muted-foreground">
        {payment.notes ?? ""}
      </TableCell>
      <TableCell>
        <div className="flex gap-1">
          <PaymentDialog
            payment={payment}
            trigger={
              <Button size="icon" variant="ghost" aria-label="עריכה" disabled={pending}>
                <Pencil className="size-4" />
              </Button>
            }
          />
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
