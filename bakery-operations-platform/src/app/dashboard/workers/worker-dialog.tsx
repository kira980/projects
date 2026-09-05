"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  createWorker,
  updateWorker,
  setWorkerPasscode,
  type ActionResult,
} from "./actions";

export type WorkerRow = {
  id: string;
  full_name: string;
  phone: string | null;
  hourly_rate: number | null;
  pay_type: "hourly" | "monthly" | "daily";
  monthly_rate: number | null;
  daily_rate: number | null;
  can_manage_shift: boolean;
  is_admin: boolean;
  is_baker: boolean;
  is_driver: boolean;
  notes: string | null;
  is_active: boolean;
  passcode_hash: string | null;
};

function FlagCheckbox({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <Checkbox name={name} defaultChecked={defaultChecked} />
      {label}
    </label>
  );
}

export function WorkerDialog({
  worker,
  trigger,
}: {
  worker?: WorkerRow;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [payType, setPayType] = useState<"hourly" | "monthly" | "daily">(
    worker?.pay_type ?? "hourly"
  );

  async function onSubmit(formData: FormData) {
    setPending(true);
    const result: ActionResult = worker
      ? await updateWorker(worker.id, formData)
      : await createWorker(formData);
    setPending(false);
    if (result.ok) {
      toast.success(worker ? "העובד עודכן" : "העובד נוסף");
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
          <DialogTitle>{worker ? "עריכת עובד" : "עובד חדש"}</DialogTitle>
        </DialogHeader>
        <form action={onSubmit} className="grid gap-4" autoComplete="off">
          <div className="grid gap-2">
            <Label htmlFor="full_name">שם מלא *</Label>
            <Input
              id="full_name"
              name="full_name"
              defaultValue={worker?.full_name}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="phone">טלפון</Label>
              <Input
                id="phone"
                name="phone"
                dir="ltr"
                defaultValue={worker?.phone ?? ""}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>סוג שכר</Label>
            <input type="hidden" name="pay_type" value={payType} />
            <div className="grid grid-cols-3 gap-2" role="group" aria-label="סוג שכר">
              <Button
                type="button"
                variant={payType === "hourly" ? "default" : "outline"}
                onClick={() => setPayType("hourly")}
                aria-pressed={payType === "hourly"}
              >
                שעתי
              </Button>
              <Button
                type="button"
                variant={payType === "daily" ? "default" : "outline"}
                onClick={() => setPayType("daily")}
                aria-pressed={payType === "daily"}
              >
                יומי
              </Button>
              <Button
                type="button"
                variant={payType === "monthly" ? "default" : "outline"}
                onClick={() => setPayType("monthly")}
                aria-pressed={payType === "monthly"}
              >
                חודשי קבוע
              </Button>
            </div>
            {payType === "hourly" && (
              <div className="grid gap-2">
                <Label htmlFor="hourly_rate">שכר שעתי (₪)</Label>
                <Input
                  id="hourly_rate"
                  name="hourly_rate"
                  type="number"
                  min="0"
                  step="0.5"
                  dir="ltr"
                  defaultValue={worker?.hourly_rate ?? ""}
                />
              </div>
            )}
            {payType === "daily" && (
              <div className="grid gap-2">
                <Label htmlFor="daily_rate">שכר יומי (₪)</Label>
                <Input
                  id="daily_rate"
                  name="daily_rate"
                  type="number"
                  min="0"
                  step="10"
                  dir="ltr"
                  defaultValue={worker?.daily_rate ?? ""}
                />
              </div>
            )}
            {payType === "monthly" && (
              <div className="grid gap-2">
                <Label htmlFor="monthly_rate">משכורת חודשית (₪)</Label>
                <Input
                  id="monthly_rate"
                  name="monthly_rate"
                  type="number"
                  min="0"
                  step="50"
                  dir="ltr"
                  defaultValue={worker?.monthly_rate ?? ""}
                />
              </div>
            )}
          </div>
          {!worker && (
            <div className="grid gap-2">
              <Label htmlFor="passcode">קוד אישי (4 ספרות)</Label>
              <Input
                id="passcode"
                name="passcode"
                inputMode="numeric"
                pattern="\d{4}"
                maxLength={4}
                dir="ltr"
                placeholder="אפשר להגדיר גם מאוחר יותר"
              />
            </div>
          )}
          <div className="grid gap-2">
            <Label>הרשאות</Label>
            <div className="grid gap-2 rounded-lg border p-3">
              <FlagCheckbox
                name="can_manage_shift"
                label="אחראי משמרת — יכול להחתים עובדים אחרים"
                defaultChecked={worker?.can_manage_shift}
              />
              <FlagCheckbox
                name="is_admin"
                label="מנהל — יכול לתקן ולמחוק פעולות בהיסטוריה של היום"
                defaultChecked={worker?.is_admin}
              />
              <FlagCheckbox
                name="is_baker"
                label="אופה — גישה למסך ההכנות"
                defaultChecked={worker?.is_baker}
              />
              <FlagCheckbox
                name="is_driver"
                label="נהג — גישה לאפליקציית הנהג"
                defaultChecked={worker?.is_driver}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              עובד ללא קוד אישי לא יכול להיכנס לאף מסך (עובדים, נהג, הכנות).
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="notes">הערות</Label>
            <Textarea id="notes" name="notes" defaultValue={worker?.notes ?? ""} />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "שומר..." : "שמירה"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PasscodeDialog({
  workerId,
  hasPasscode,
  trigger,
}: {
  workerId: string;
  hasPasscode: boolean;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    const result = await setWorkerPasscode(
      workerId,
      String(formData.get("passcode") ?? "")
    );
    setPending(false);
    if (result.ok) {
      toast.success("הקוד עודכן");
      setOpen(false);
    } else {
      toast.error(result.error ?? "שגיאה");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {hasPasscode ? "איפוס קוד אישי" : "הגדרת קוד אישי"}
          </DialogTitle>
        </DialogHeader>
        <form action={onSubmit} className="grid gap-4" autoComplete="off">
          <div className="grid gap-2">
            <Label htmlFor="new_passcode">קוד חדש (4 ספרות)</Label>
            <Input
              id="new_passcode"
              name="passcode"
              inputMode="numeric"
              pattern="\d{4}"
              maxLength={4}
              dir="ltr"
              autoFocus
              required
            />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "שומר..." : "שמירת קוד"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
