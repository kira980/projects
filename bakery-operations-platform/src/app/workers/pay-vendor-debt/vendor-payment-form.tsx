"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Camera, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMoney, formatDate } from "@/lib/format";
import { vendorPaymentCap, vendorPaymentError } from "@/lib/payments/vendor-debt";
import type { KioskResult } from "../actions";

const METHOD_OPTIONS = [
  { value: "cash", label: "מזומן" },
  { value: "card", label: "אשראי" },
  { value: "transfer", label: "העברה" },
  { value: "check", label: "צ'ק" },
];

export type VendorWithDebt = {
  id: string;
  name: string;
  /** null for a vendor whose bills we don't track — those are uncapped. */
  debt: number | null;
};

export type PayableOrder = {
  id: string;
  vendor_id: string;
  amount: number;
  received_at: string;
  notes: string | null;
};

/** An existing payment being corrected — every field the form offers. */
export type PaymentInitial = {
  vendorId: string;
  vendorOrderId: string | null;
  amount: number;
  method: string;
  paidByWorkerId: string | null;
  notes: string | null;
  hasProof: boolean;
};

const OTHER = "other";
const CUSTOM = "custom";

/**
 * The תשלום חוב לספק form, shared by the payment screen and the history
 * screen's edit route — a correction shows the same fields as the
 * original entry, filled in with what was recorded.
 */
export function VendorPaymentForm({
  vendors,
  payableOrders,
  workers,
  currentWorkerId,
  initial,
  submitLabel,
  action,
  onSuccess,
}: {
  vendors: VendorWithDebt[];
  payableOrders: PayableOrder[];
  workers: { id: string; full_name: string }[];
  currentWorkerId: string;
  initial?: PaymentInitial;
  submitLabel: string;
  action: (formData: FormData) => Promise<KioskResult>;
  onSuccess: () => void;
}) {
  const [vendorId, setVendorId] = useState(initial?.vendorId ?? "");
  const [otherName, setOtherName] = useState("");
  const [orderId, setOrderId] = useState<string | typeof CUSTOM | "">(
    initial ? (initial.vendorOrderId ?? CUSTOM) : ""
  );
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [method, setMethod] = useState(initial?.method ?? "cash");
  const [pending, setPending] = useState(false);

  const vendorOrders = payableOrders.filter((o) => o.vendor_id === vendorId);
  const selectedVendor = vendors.find((v) => v.id === vendorId);

  // What this vendor may still be paid. An edited payment's own amount is
  // already off the debt, so it is available again.
  const check = {
    debt: vendorId === OTHER ? null : (selectedVendor?.debt ?? null),
    currentAmount: initial?.vendorId === vendorId ? initial.amount : 0,
  };
  const cap = vendorPaymentCap(check);

  function pickVendor(id: string) {
    setVendorId(id);
    setOrderId(id === OTHER ? CUSTOM : "");
    setAmount("");
  }

  function pickOrder(order: PayableOrder) {
    setOrderId(order.id);
    setAmount(String(order.amount));
  }

  async function onSubmit(formData: FormData) {
    if (!vendorId) {
      toast.error("יש לבחור ספק");
      return;
    }
    if (vendorId === OTHER && !otherName.trim()) {
      toast.error("יש להזין שם ספק");
      return;
    }
    const invalid = vendorPaymentError(Number(amount), check);
    if (invalid) {
      toast.error(invalid);
      return;
    }
    formData.set("vendor_id", vendorId);
    formData.set("vendor_name", vendorId === OTHER ? otherName.trim() : "");
    formData.set("vendor_order_id", orderId === CUSTOM ? "" : orderId);
    formData.set("amount", amount);
    formData.set("method", method);
    setPending(true);
    const result = await action(formData);
    if (result.ok) {
      toast.success(result.info);
      onSuccess();
    } else {
      toast.error(result.error ?? "שגיאה");
      setPending(false);
    }
  }

  return (
    <form action={onSubmit} className="grid gap-5" autoComplete="off">
      <div className="grid gap-2">
        <Label className="text-base">ספק *</Label>
        <div className="grid gap-2">
          {vendors.map((v) => (
            <Button
              key={v.id}
              type="button"
              variant={vendorId === v.id ? "default" : "outline"}
              className="h-14 justify-between text-base"
              onClick={() => pickVendor(v.id)}
            >
              <span>{v.name}</span>
              {v.debt !== null && (
                <Badge
                  variant={v.debt > 0 ? "destructive" : "secondary"}
                  className="text-sm"
                >
                  חוב: {formatMoney(v.debt)}
                </Badge>
              )}
            </Button>
          ))}
          <Button
            type="button"
            variant={vendorId === OTHER ? "default" : "outline"}
            className="h-14 text-base"
            onClick={() => pickVendor(OTHER)}
          >
            אחר (ספק ידני)
          </Button>
          {vendors.length === 0 && (
            <p className="text-sm text-muted-foreground">
              אין ספקים עם חוב פתוח — אפשר לבחור &quot;אחר&quot;
            </p>
          )}
        </div>
      </div>

      {vendorId === OTHER && (
        <div className="grid gap-2">
          <Label htmlFor="vendor_name" className="text-base">
            שם הספק *
          </Label>
          <Input
            id="vendor_name"
            value={otherName}
            onChange={(e) => setOtherName(e.target.value)}
            placeholder="שם הספק"
            className="h-12 text-base"
          />
        </div>
      )}

      {vendorId && vendorId !== OTHER && (
        <div className="grid gap-2">
          <Label className="text-base">מה לשלם?</Label>
          <div className="grid gap-2">
            {vendorOrders.map((o) => (
              <Button
                key={o.id}
                type="button"
                variant={orderId === o.id ? "default" : "outline"}
                className="h-14 justify-between text-base"
                onClick={() => pickOrder(o)}
              >
                <span>
                  חשבונית מ־{formatDate(o.received_at)}
                  {o.notes ? ` · ${o.notes}` : ""}
                </span>
                <span className="font-bold">{formatMoney(o.amount)}</span>
              </Button>
            ))}
            <Button
              type="button"
              variant={orderId === CUSTOM ? "default" : "outline"}
              className="h-14 text-base"
              onClick={() => {
                setOrderId(CUSTOM);
                setAmount("");
              }}
            >
              סכום אחר על חשבון החוב
              {cap !== null && ` (סה"כ חוב ${formatMoney(cap)})`}
            </Button>
          </div>
        </div>
      )}

      {orderId && (
        <>
          <div className="grid gap-2">
            <Label htmlFor="amount" className="text-base">
              סכום (₪) *
            </Label>
            <Input
              id="amount"
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              max={orderId === CUSTOM && cap !== null ? cap : undefined}
              dir="ltr"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              readOnly={orderId !== CUSTOM}
              className="h-14 text-center text-2xl font-bold"
            />
            {orderId === CUSTOM && cap !== null && (
              <p className="text-sm text-muted-foreground">
                עד {formatMoney(cap)} — אי אפשר לשלם יותר מהחוב
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label className="text-base">אמצעי תשלום</Label>
            <div className="grid grid-cols-4 gap-2">
              {METHOD_OPTIONS.map((m) => (
                <Button
                  key={m.value}
                  type="button"
                  variant={method === m.value ? "default" : "outline"}
                  className="h-12"
                  onClick={() => setMethod(m.value)}
                >
                  {m.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid gap-2">
            <Label className="text-base">מי שילם</Label>
            <Select
              name="paid_by_worker_id"
              defaultValue={initial?.paidByWorkerId ?? currentWorkerId}
            >
              <SelectTrigger className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {workers.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="proof" className="text-base flex items-center gap-2">
              <Camera className="size-5" />
              צילום אסמכתא (לא חובה)
            </Label>
            {initial?.hasProof && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <ImageIcon className="size-4" />
                יש אסמכתא מצולמת — צילום חדש יחליף אותה
              </p>
            )}
            <Input
              id="proof"
              name="proof"
              type="file"
              accept="image/*,application/pdf"
              capture="environment"
              className="h-12 pt-2.5"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes" className="text-base">
              הערה (לא חובה)
            </Label>
            <Textarea
              id="notes"
              name="notes"
              rows={2}
              defaultValue={initial?.notes ?? ""}
            />
          </div>

          <Button
            type="submit"
            disabled={pending}
            className="h-16 bg-green-600 text-lg text-white hover:bg-green-700"
          >
            {pending ? "שומר..." : submitLabel}
          </Button>
        </>
      )}
    </form>
  );
}
