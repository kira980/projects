"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { deleteOrder, recordOrderPayment } from "../actions";
import { issueOrderReceipt } from "./doc/doc-actions";
import { PAYMENT_METHODS } from "@/lib/order-status";
import { formatMoney } from "@/lib/format";

/**
 * "ביטול הזמנה" deletes the order outright — items, documents, the attached
 * delivery / takeaway, its payments and its debt entries. There is no
 * status picker any more: production sets מוכנה, and the order becomes
 * נמסרה when its delivery or pickup is completed.
 */
export function CancelOrderButton({
  orderId,
  orderNumber,
  hasIssuedDocs,
}: {
  orderId: string;
  orderNumber: number;
  /** A קבלה / תעודת משלוח was already issued — worth a louder warning. */
  hasIssuedDocs: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onCancel() {
    const warning = hasIssuedDocs
      ? `להזמנה #${orderNumber} כבר הופקה קבלה / תעודת משלוח.\nביטול ימחק את ההזמנה ואת המסמכים שלה — ומספרי המסמכים לא ינוצלו מחדש.\n\nלמחוק בכל זאת?`
      : `לבטל את הזמנה #${orderNumber}?\nההזמנה, המשלוח/האיסוף שלה, התשלומים והחוב שלה יימחקו לצמיתות.`;
    if (!confirm(warning)) return;
    setPending(true);
    const result = await deleteOrder(orderId);
    setPending(false);
    if (result.ok) {
      toast.success("ההזמנה בוטלה ונמחקה");
      router.push("/dashboard/orders");
    } else {
      toast.error(result.error ?? "שגיאה");
    }
  }

  return (
    <Button variant="destructive" disabled={pending} onClick={onCancel}>
      <Trash2 className="size-4" />
      {pending ? "מוחק..." : "ביטול הזמנה"}
    </Button>
  );
}

export function PaymentDialog({
  orderId,
  remaining,
}: {
  orderId: string;
  remaining: number;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    const result = await recordOrderPayment(
      orderId,
      Number(formData.get("amount")),
      String(formData.get("method") ?? "cash"),
      String(formData.get("notes") ?? "")
    );
    setPending(false);
    if (result.ok) {
      toast.success("התשלום נרשם");
      setOpen(false);
    } else {
      toast.error(result.error ?? "שגיאה");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={remaining <= 0}>רישום תשלום</Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>רישום תשלום</DialogTitle>
        </DialogHeader>
        <form action={onSubmit} className="grid gap-4" autoComplete="off">
          <div className="grid gap-2">
            <Label htmlFor="pay_amount">
              סכום (₪) — נותר לתשלום {formatMoney(remaining)}
            </Label>
            <Input
              id="pay_amount"
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              dir="ltr"
              defaultValue={remaining > 0 ? remaining : undefined}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label>אמצעי תשלום</Label>
            <Select name="method" defaultValue="cash">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pay_notes">הערה</Label>
            <Input id="pay_notes" name="notes" />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "שומר..." : "שמירת תשלום"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function QuoteButton({ orderId }: { orderId: string }) {
  return (
    <Button variant="outline" asChild>
      <Link href={`/dashboard/orders/${orderId}/quote`}>
        <FileText className="size-4" />
        הצעת מחיר
      </Link>
    </Button>
  );
}

/**
 * "צור קבלה" — issues a receipt for the order (and a תעודת משלוח for delivery
 * orders; pickup gets a receipt only), after a confirmation.
 */
export function CreateReceiptButton({
  orderId,
  isDelivery,
}: {
  orderId: string;
  isDelivery: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onClick() {
    const message = isDelivery
      ? "ליצור קבלה ותעודת משלוח להזמנה זו?"
      : "ליצור קבלה להזמנה זו?";
    if (!confirm(message)) return;
    setPending(true);
    const result = await issueOrderReceipt(orderId);
    setPending(false);
    if (result.ok) {
      toast.success(isDelivery ? "נוצרו קבלה ותעודת משלוח" : "נוצרה קבלה");
      router.refresh();
    } else {
      toast.error(result.error ?? "שגיאה");
    }
  }

  return (
    <Button variant="outline" onClick={onClick} disabled={pending}>
      <FileText className="size-4" />
      {pending ? "יוצר..." : "צור קבלה"}
    </Button>
  );
}
