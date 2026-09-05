"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createExpense } from "./actions";
import { ExpenseActions } from "./expense-actions";
import { formatMoney, formatDate } from "@/lib/format";

const METHOD_LABELS: Record<string, string> = {
  cash: "מזומן",
  card: "אשראי",
  transfer: "העברה",
  check: "צ'ק",
  other: "אחר",
};

export type ExpenseRow = {
  id: string;
  amount: number;
  method: string;
  description: string | null;
  expense_date: string;
  spent_by_name: string;
  receipt_url: string | null;
};

export function ExpensesClient({
  expenses,
  monthTotal,
}: {
  expenses: ExpenseRow[];
  monthTotal: number;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    const result = await createExpense(formData);
    setPending(false);
    if (result.ok) {
      toast.success("ההוצאה נרשמה");
      setOpen(false);
    } else {
      toast.error(result.error ?? "שגיאה");
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">הוצאות</h1>
          <p className="text-muted-foreground">
            סה&quot;כ החודש: {formatMoney(monthTotal)}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4" />
              הוצאה חדשה
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>הוצאה חדשה</DialogTitle>
            </DialogHeader>
            <form action={onSubmit} className="grid gap-4" autoComplete="off">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="amount">סכום (₪) *</Label>
                  <Input
                    id="amount"
                    name="amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    dir="ltr"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="expense_date">תאריך</Label>
                  <Input id="expense_date" name="expense_date" type="date" dir="ltr" />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>אמצעי תשלום</Label>
                <Select name="method" defaultValue="cash">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(METHOD_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">תיאור *</Label>
                <Textarea id="description" name="description" rows={2} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="receipt">קבלה</Label>
                <Input
                  id="receipt"
                  name="receipt"
                  type="file"
                  accept="image/*,application/pdf"
                />
              </div>
              <Button type="submit" disabled={pending}>
                {pending ? "שומר..." : "שמירה"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>תאריך</TableHead>
              <TableHead>סכום</TableHead>
              <TableHead>אמצעי</TableHead>
              <TableHead>תיאור</TableHead>
              <TableHead>נרשם ע&quot;י</TableHead>
              <TableHead>קבלה</TableHead>
              <TableHead className="w-24">פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  אין הוצאות עדיין
                </TableCell>
              </TableRow>
            )}
            {expenses.map((e) => (
              <TableRow key={e.id}>
                <TableCell>{formatDate(e.expense_date)}</TableCell>
                <TableCell className="font-medium">{formatMoney(e.amount)}</TableCell>
                <TableCell>{METHOD_LABELS[e.method] ?? e.method}</TableCell>
                <TableCell>{e.description}</TableCell>
                <TableCell>{e.spent_by_name}</TableCell>
                <TableCell>
                  {e.receipt_url ? (
                    <a
                      href={e.receipt_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      צפייה <ExternalLink className="size-3.5" />
                    </a>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  <ExpenseActions
                    expense={{
                      id: e.id,
                      amount: e.amount,
                      method: e.method,
                      description: e.description,
                    }}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
