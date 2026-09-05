"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { updateBusiness } from "./actions";

export function SettingsClient({
  business,
}: {
  business: { name: string; phone: string | null; address: string | null };
}) {
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    const result = await updateBusiness(formData);
    setPending(false);
    if (result.ok) toast.success("הפרטים נשמרו");
    else toast.error(result.error ?? "שגיאה");
  }

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-bold">הגדרות</h1>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>פרטי העסק</CardTitle>
          <CardDescription>
            הפרטים מופיעים בהצעות המחיר ובמסמכים.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={onSubmit} className="grid gap-4" autoComplete="off">
            <div className="grid gap-2">
              <Label htmlFor="name">שם העסק *</Label>
              <Input id="name" name="name" defaultValue={business.name} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">טלפון</Label>
              <Input
                id="phone"
                name="phone"
                dir="ltr"
                defaultValue={business.phone ?? ""}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="address">כתובת</Label>
              <Input id="address" name="address" defaultValue={business.address ?? ""} />
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? "שומר..." : "שמירה"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
