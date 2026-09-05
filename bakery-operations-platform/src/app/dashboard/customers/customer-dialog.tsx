"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
  AddressAutocomplete,
  type AddressValue,
} from "@/components/address-autocomplete";
import { createCustomer, updateCustomer } from "./actions";

export type CustomerRow = {
  id: string;
  name: string;
  phone: string | null;
  customer_type: string;
  payment_terms: string;
  notes: string | null;
  can_order_online: boolean;
  show_debt_in_portal: boolean;
  is_active: boolean;
  receipt: boolean;
  default_address?: {
    address_text: string;
    city: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
};

export function CustomerDialog({
  customer,
  trigger,
}: {
  customer?: CustomerRow;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [receipt, setReceipt] = useState(customer?.receipt ?? false);
  const [addr, setAddr] = useState<AddressValue>({
    address_text: customer?.default_address?.address_text ?? "",
    city: customer?.default_address?.city ?? null,
    latitude: customer?.default_address?.latitude ?? null,
    longitude: customer?.default_address?.longitude ?? null,
  });

  async function onSubmit(formData: FormData) {
    formData.set("address_text", addr.address_text);
    formData.set("city", addr.city ?? "");
    formData.set("latitude", addr.latitude != null ? String(addr.latitude) : "");
    formData.set("longitude", addr.longitude != null ? String(addr.longitude) : "");
    formData.set("receipt", receipt ? "on" : "");
    setPending(true);
    const result = customer
      ? await updateCustomer(customer.id, formData)
      : await createCustomer(formData);
    setPending(false);
    if (result.ok) {
      toast.success(customer ? "הלקוח עודכן" : "הלקוח נוסף");
      setOpen(false);
    } else {
      toast.error(result.error ?? "שגיאה");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{customer ? "עריכת לקוח" : "לקוח חדש"}</DialogTitle>
        </DialogHeader>
        <form action={onSubmit} className="grid gap-4" autoComplete="off">
          <div className="grid gap-2">
            <Label htmlFor="name">שם הלקוח *</Label>
            <Input id="name" name="name" defaultValue={customer?.name} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="phone">טלפון</Label>
              <Input
                id="phone"
                name="phone"
                dir="ltr"
                defaultValue={customer?.phone ?? ""}
              />
            </div>
            <div className="grid gap-2">
              <Label>סוג לקוח</Label>
              <Select
                name="customer_type"
                defaultValue={customer?.customer_type ?? "business"}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="business">עסקי</SelectItem>
                  <SelectItem value="private">פרטי</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="address">כתובת</Label>
            <AddressAutocomplete
              id="address"
              defaultValue={customer?.default_address?.address_text ?? ""}
              placeholder="התחילו להקליד כתובת..."
              onChange={setAddr}
            />
            {addr.city && (
              <p className="text-xs text-muted-foreground">
                עיר: {addr.city}
                {addr.latitude != null ? " · מיקום נשמר למפה" : ""}
              </p>
            )}
          </div>
          <div className="grid gap-2">
            <Label>תנאי תשלום</Label>
            <Select
              name="payment_terms"
              defaultValue={customer?.payment_terms ?? "immediate"}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="immediate">תשלום מיידי</SelectItem>
                <SelectItem value="monthly">חודשי (שוטף)</SelectItem>
                <SelectItem value="custom">מותאם אישית</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="notes">הערות</Label>
            <Textarea id="notes" name="notes" defaultValue={customer?.notes ?? ""} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="grid gap-0.5">
              <Label htmlFor="receipt">קבלה</Label>
              <span className="text-sm text-muted-foreground">
                הזמנות הלקוח מונפקות עם קבלה ותעודת משלוח
              </span>
            </div>
            <Switch
              id="receipt"
              checked={receipt}
              onCheckedChange={setReceipt}
              aria-label="קבלה"
            />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "שומר..." : "שמירה"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
