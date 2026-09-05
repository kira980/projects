"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  updateVendorPaymentAdmin,
  deleteVendorPaymentAdmin,
} from "./actions";

// Mirrors PAYMENT_METHOD_LABELS — that module is server-only.
const METHODS = [
  { value: "cash", label: "מזומן" },
  { value: "card", label: "אשראי" },
  { value: "transfer", label: "העברה" },
  { value: "check", label: "צ'ק" },
  { value: "other", label: "אחר" },
];

/** A debt payment as the edit form needs it. */
export type EditableVendorPayment = {
  id: string;
  vendor_id: string;
  amount: number;
  method: string | null;
  /** The invoice it covers, if any — shown so the admin knows it is at stake. */
  vendor_order_id: string | null;
  notes: string | null;
};

/**
 * Pencil + trash for one debt payment (פירוט תשלומים → תשלומים לספקים).
 * Both edits move the vendor ledger in the same transaction, so the
 * vendor's open debt follows along.
 */
export function VendorPaymentActions({
  vendors,
  payment,
  vendorName,
}: {
  vendors: { id: string; name: string }[];
  payment: EditableVendorPayment;
  /** Only used in the delete confirmation text. */
  vendorName?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [vendorId, setVendorId] = useState(payment.vendor_id);
  const [method, setMethod] = useState(payment.method ?? "cash");

  const movedVendor = vendorId !== payment.vendor_id;

  async function onSubmit(formData: FormData) {
    formData.set("vendor_id", vendorId);
    formData.set("method", method);
    setPending(true);
    const result = await updateVendorPaymentAdmin(payment.id, formData);
    setPending(false);
    if (result.ok) {
      toast.success("התשלום עודכן");
      setOpen(false);
    } else {
      toast.error(result.error ?? "שגיאה");
    }
  }

  async function onDelete() {
    const who = vendorName ? ` ל${vendorName}` : "";
    if (
      !confirm(
        `למחוק את התשלום${who} על ${formatMoney(payment.amount)}? החוב לספק יגדל בחזרה.`
      )
    ) {
      return;
    }
    setPending(true);
    const result = await deleteVendorPaymentAdmin(payment.id);
    setPending(false);
    if (result.ok) toast.success("התשלום נמחק");
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
            <DialogTitle>עריכת תשלום לספק</DialogTitle>
            {payment.vendor_order_id && (
              <DialogDescription>
                התשלום סוגר חשבונית מסוימת — העברתו לספק אחר תחזיר אותה למצב
                &quot;לא שולם&quot;.
              </DialogDescription>
            )}
          </DialogHeader>
          <form action={onSubmit} className="grid gap-4" autoComplete="off">
            <div className="grid gap-2">
              <Label>ספק *</Label>
              <SearchableSelect
                options={vendors.map((v) => ({ value: v.id, label: v.name }))}
                value={vendorId}
                onChange={setVendorId}
                placeholder="בחרו ספק..."
                searchPlaceholder="חיפוש ספק..."
              />
              {movedVendor && payment.vendor_order_id && (
                <p className="text-xs text-destructive">
                  החשבונית שהתשלום סגר תחזור למצב &quot;לא שולם&quot;.
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vp_amount">סכום (₪) *</Label>
              <Input
                id="vp_amount"
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                dir="ltr"
                defaultValue={payment.amount}
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
              <Label htmlFor="vp_notes">הערה</Label>
              <Textarea
                id="vp_notes"
                name="notes"
                rows={2}
                defaultValue={payment.notes ?? ""}
              />
            </div>
            <Button type="submit" disabled={pending || !vendorId}>
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
