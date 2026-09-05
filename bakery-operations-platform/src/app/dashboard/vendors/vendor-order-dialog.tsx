"use client";

import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { formatMoney } from "@/lib/format";
import { businessToday } from "@/lib/db/day-lock";
import { TimeField } from "@/components/ui/time-field";
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
import {
  createVendorOrderAdmin,
  updateVendorOrderAdmin,
  deleteVendorOrderAdmin,
  type ActionResult,
} from "./actions";

/** Sentinel for "not on the list" — resolveVendorId() understands it. */
const NEW_VENDOR = "other";

const METHODS = [
  { value: "cash", label: "מזומן" },
  { value: "card", label: "אשראי" },
  { value: "transfer", label: "העברה" },
  { value: "check", label: "צ'ק" },
  { value: "other", label: "אחר" },
];

/** An arrival as the edit form needs it. */
export type EditableVendorOrder = {
  id: string;
  vendor_id: string;
  amount: number;
  /** "paid" | "unpaid" — anything else counts as unpaid. */
  status: string;
  payment_method: string | null;
  paid_by_worker_id: string | null;
  notes: string | null;
  /** Israel-local YYYY-MM-DD of the arrival. */
  received_date?: string;
  /** Israel-local HH:MM of the arrival. */
  received_time?: string;
};

export function VendorOrderDialog({
  vendors,
  order,
  trigger,
  defaultDate,
}: {
  vendors: { id: string; name: string }[];
  /** Given → the dialog edits that arrival instead of recording a new one. */
  order?: EditableVendorOrder;
  trigger?: ReactNode;
  /**
   * Day a new arrival lands on (YYYY-MM-DD) — the day being viewed, so
   * goods entered from a past day's board stay on that day. Defaults to
   * today.
   */
  defaultDate?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [vendorId, setVendorId] = useState(order?.vendor_id ?? "");
  const [paid, setPaid] = useState(order ? order.status === "paid" : false);
  const [method, setMethod] = useState(order?.payment_method ?? "cash");
  const [receivedTime, setReceivedTime] = useState(order?.received_time ?? "");
  const [newVendorName, setNewVendorName] = useState("");
  const isNewVendor = vendorId === NEW_VENDOR;

  async function onSubmit(formData: FormData) {
    formData.set("vendor_id", vendorId);
    formData.set("vendor_name", isNewVendor ? newVendorName : "");
    formData.set("payment_method", method);
    formData.set("received_time", receivedTime);
    if (order?.paid_by_worker_id) {
      formData.set("paid_by_worker_id", order.paid_by_worker_id);
    }
    setPending(true);
    const result: ActionResult = order
      ? await updateVendorOrderAdmin(order.id, formData)
      : await createVendorOrderAdmin(formData);
    setPending(false);
    if (result.ok) {
      toast.success(order ? "קבלת הסחורה עודכנה" : "קבלת הסחורה נשמרה");
      setOpen(false);
      if (!order) {
        setVendorId("");
        setNewVendorName("");
        setPaid(false);
      }
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
            קבלת סחורה חדשה
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {order ? "עריכת קבלת סחורה" : "קבלת סחורה מספק"}
          </DialogTitle>
        </DialogHeader>
        <form action={onSubmit} className="grid gap-4" autoComplete="off">
          <div className="grid gap-2">
            <Label>ספק *</Label>
            {/* First in the list, so goods from someone not on file yet can
                be recorded on the spot rather than in another screen. An
                existing name is reused rather than duplicated. */}
            <SearchableSelect
              options={[
                { value: NEW_VENDOR, label: "+ ספק חדש (הקלדת שם)" },
                ...vendors.map((v) => ({ value: v.id, label: v.name })),
              ]}
              value={vendorId}
              onChange={setVendorId}
              placeholder="בחרו ספק..."
              searchPlaceholder="חיפוש ספק..."
            />
            {isNewVendor && (
              <Input
                aria-label="שם הספק החדש"
                placeholder="שם הספק"
                value={newVendorName}
                onChange={(e) => setNewVendorName(e.target.value)}
                autoFocus
              />
            )}
          </div>
          {/* An arrival nobody entered on the night it came in still
              belongs to that day — both the goods and the cash. */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="vo_date">תאריך קבלה</Label>
              <Input
                id="vo_date"
                name="received_date"
                type="date"
                dir="ltr"
                defaultValue={
                  order?.received_date ?? defaultDate ?? businessToday()
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vo_time">שעה</Label>
              <TimeField
                id="vo_time"
                value={receivedTime}
                onChange={setReceivedTime}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="vo_amount">סכום (₪) *</Label>
            <Input
              id="vo_amount"
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              dir="ltr"
              defaultValue={order?.amount ?? ""}
              required
            />
          </div>
          <label className="flex items-center gap-2 text-[0.9375rem]">
            <Checkbox
              name="paid"
              checked={paid}
              onCheckedChange={(v) => setPaid(v === true)}
            />
            שולם במעמד הקבלה
          </label>
          {paid && (
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
          )}
          <div className="grid gap-2">
            <Label htmlFor="vo_notes">הערה</Label>
            <Textarea
              id="vo_notes"
              name="notes"
              rows={2}
              defaultValue={order?.notes ?? ""}
            />
          </div>
          <Button
            type="submit"
            disabled={pending || !vendorId || (isNewVendor && !newVendorName.trim())}
          >
            {pending ? "שומר..." : order ? "שמירת השינויים" : "שמירת קבלת סחורה"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Pencil + trash for one arrival, for the cells at the end of the goods
 * tables (מבט יומי, קבלות סחורה).
 */
export function VendorOrderActions({
  vendors,
  order,
  vendorName,
}: {
  vendors: { id: string; name: string }[];
  order: EditableVendorOrder;
  /** Only used in the delete confirmation text. */
  vendorName?: string | null;
}) {
  const [pending, setPending] = useState(false);

  async function onDelete() {
    const who = vendorName ? ` מ${vendorName}` : "";
    if (
      !confirm(
        `למחוק את קבלת הסחורה${who} על ${formatMoney(order.amount)}? הפעולה תעדכן גם את החוב לספק.`
      )
    ) {
      return;
    }
    setPending(true);
    const result = await deleteVendorOrderAdmin(order.id);
    setPending(false);
    if (result.ok) toast.success("קבלת הסחורה נמחקה");
    else toast.error(result.error ?? "שגיאה");
  }

  return (
    <div className="flex gap-1">
      <VendorOrderDialog
        vendors={vendors}
        order={order}
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
  );
}
