"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowRight, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useIdleLogout } from "../use-idle-logout";
import { kioskLogout } from "../actions";
import { submitExpense } from "./expense-actions";

export function ExpenseClient() {
  useIdleLogout(120);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    const result = await submitExpense(formData);
    if (result.ok) {
      toast.success(result.info);
      setTimeout(() => void kioskLogout(), 1500);
    } else {
      toast.error(result.error ?? "שגיאה");
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-5 p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild aria-label="חזרה">
          <Link href="/workers/menu">
            <ArrowRight className="size-6" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">תשלום אחר</h1>
      </div>

      <form action={onSubmit} className="grid gap-5" autoComplete="off">
        <div className="grid gap-2">
          <Label htmlFor="amount" className="text-base">
            סכום (₪) *
          </Label>
          <Input
            id="amount"
            name="amount"
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            dir="ltr"
            required
            className="h-14 text-center text-2xl font-bold"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="description" className="text-base">
            על מה ההוצאה? *
          </Label>
          <Textarea id="description" name="description" rows={2} required />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="receipt" className="text-base flex items-center gap-2">
            <Camera className="size-5" />
            צילום קבלה (לא חובה)
          </Label>
          <Input
            id="receipt"
            name="receipt"
            type="file"
            accept="image/*,application/pdf"
            capture="environment"
            className="h-12 pt-2.5"
          />
        </div>

        <Button
          type="submit"
          disabled={pending}
          className="h-16 bg-green-600 text-lg text-white hover:bg-green-700"
        >
          {pending ? "שומר..." : "שמירה"}
        </Button>
      </form>
    </main>
  );
}
