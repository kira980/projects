"use client";

import { useState } from "react";
import { toast } from "sonner";
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
import { createVendor, updateVendor } from "./actions";
import { VENDOR_CATEGORIES } from "@/lib/vendor-categories";

export type VendorRow = {
  id: string;
  name: string;
  phone: string | null;
  contact_name: string | null;
  /** One of VENDOR_CATEGORIES, or null when not categorized yet. */
  category: string | null;
  notes: string | null;
  is_active: boolean;
};

/** Sentinel for the "no category" option — Select has no empty value. */
const NO_CATEGORY = "__none__";

export function VendorDialog({
  vendor,
  trigger,
}: {
  vendor?: VendorRow;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    const result = vendor
      ? await updateVendor(vendor.id, formData)
      : await createVendor(formData);
    setPending(false);
    if (result.ok) {
      toast.success(vendor ? "הספק עודכן" : "הספק נוסף");
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
          <DialogTitle>{vendor ? "עריכת ספק" : "ספק חדש"}</DialogTitle>
        </DialogHeader>
        <form action={onSubmit} className="grid gap-4" autoComplete="off">
          <div className="grid gap-2">
            <Label htmlFor="name">שם הספק *</Label>
            <Input id="name" name="name" defaultValue={vendor?.name} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="phone">טלפון</Label>
              <Input
                id="phone"
                name="phone"
                dir="ltr"
                defaultValue={vendor?.phone ?? ""}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contact_name">איש קשר</Label>
              <Input
                id="contact_name"
                name="contact_name"
                defaultValue={vendor?.contact_name ?? ""}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="category">קטגוריה</Label>
            <Select
              name="category"
              defaultValue={vendor?.category ?? NO_CATEGORY}
            >
              <SelectTrigger id="category">
                <SelectValue placeholder="ללא קטגוריה" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CATEGORY}>ללא קטגוריה</SelectItem>
                {VENDOR_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="notes">הערות</Label>
            <Textarea id="notes" name="notes" defaultValue={vendor?.notes ?? ""} />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "שומר..." : "שמירה"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
