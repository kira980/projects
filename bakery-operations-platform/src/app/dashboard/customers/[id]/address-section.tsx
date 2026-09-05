"use client";

import { useState } from "react";
import { toast } from "sonner";
import { MapPin, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { addCustomerAddress, deleteCustomerAddress } from "../actions";

export type AddressRow = {
  id: string;
  label: string | null;
  address_text: string;
  city: string | null;
  is_default: boolean;
  notes: string | null;
};

export function AddressSection({
  customerId,
  addresses,
}: {
  customerId: string;
  addresses: AddressRow[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    const result = await addCustomerAddress(customerId, formData);
    setPending(false);
    if (result.ok) {
      toast.success("הכתובת נוספה");
      setOpen(false);
    } else {
      toast.error(result.error ?? "שגיאה");
    }
  }

  async function onDelete(addressId: string) {
    if (!confirm("למחוק את הכתובת?")) return;
    const result = await deleteCustomerAddress(customerId, addressId);
    if (result.ok) toast.success("הכתובת נמחקה");
    else toast.error(result.error ?? "שגיאה");
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">כתובות</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="size-4" />
              כתובת חדשה
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>כתובת חדשה</DialogTitle>
            </DialogHeader>
            <form action={onSubmit} className="grid gap-4" autoComplete="off">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="label">תווית</Label>
                  <Input id="label" name="label" placeholder="חנות / מחסן..." />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="city">עיר</Label>
                  <Input id="city" name="city" />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="address_text">כתובת *</Label>
                <Input id="address_text" name="address_text" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="addr_notes">הערות</Label>
                <Input id="addr_notes" name="notes" />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox name="is_default" />
                כתובת ברירת מחדל למשלוחים
              </label>
              <Button type="submit" disabled={pending}>
                {pending ? "שומר..." : "שמירה"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-2">
        {addresses.length === 0 && (
          <p className="rounded-lg border bg-card p-4 text-center text-sm text-muted-foreground">
            אין כתובות עדיין
          </p>
        )}
        {addresses.map((a) => (
          <div
            key={a.id}
            className="flex items-center gap-3 rounded-lg border bg-card p-3"
          >
            <MapPin className="size-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  {a.label ?? "כתובת"}
                </span>
                {a.is_default && <Badge variant="secondary">ברירת מחדל</Badge>}
              </div>
              <p className="truncate text-sm text-muted-foreground">
                {a.address_text}
                {a.city ? `, ${a.city}` : ""}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(a.id)}
              aria-label="מחיקה"
            >
              <Trash2 className="size-4 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
