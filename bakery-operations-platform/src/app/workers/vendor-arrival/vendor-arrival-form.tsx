"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Camera, Check, ImageIcon, Pencil, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VENDOR_CATEGORIES } from "@/lib/vendor-categories";
import { cn } from "@/lib/utils";
import type { KioskResult } from "../actions";

const METHOD_OPTIONS = [
  { value: "cash", label: "מזומן" },
  { value: "card", label: "אשראי" },
  { value: "transfer", label: "העברה" },
  { value: "check", label: "צ'ק" },
];

export type ArrivalVendor = {
  id: string;
  name: string;
  category: string | null;
};

/** An existing arrival being corrected — every field the form offers. */
export type ArrivalInitial = {
  vendorId: string;
  amount: number;
  paid: boolean;
  method: string;
  paidByWorkerId: string | null;
  notes: string | null;
  hasReceipt: boolean;
};

const ALL = "__all__";
const NO_CATEGORY = "__none__";
/** The free-text "some other supplier" choice. */
const OTHER = "other";

/**
 * The קבלת סחורה form, shared by the arrival screen and the history
 * screen's edit route — a correction shows the same fields as the
 * original entry, filled in with what was recorded.
 */
export function VendorArrivalForm({
  vendors,
  workers,
  currentWorkerId,
  initial,
  submitLabel,
  action,
  onSuccess,
}: {
  vendors: ArrivalVendor[];
  workers: { id: string; full_name: string }[];
  currentWorkerId: string;
  initial?: ArrivalInitial;
  submitLabel: string;
  action: (formData: FormData) => Promise<KioskResult>;
  onSuccess: () => void;
}) {
  const [vendorId, setVendorId] = useState(initial?.vendorId ?? "");
  const [otherName, setOtherName] = useState("");
  const [category, setCategory] = useState<string>(ALL);
  const [query, setQuery] = useState("");
  const [paid, setPaid] = useState<boolean | null>(initial?.paid ?? null);
  const [method, setMethod] = useState(initial?.method ?? "cash");
  const [pending, setPending] = useState(false);

  // Chips come from the data, not a fixed list, so this screen keeps
  // working whatever categories the vendors currently carry.
  const chips = useMemo(() => {
    const counts = new Map<string, number>();
    for (const v of vendors) {
      const key = v.category ?? NO_CATEGORY;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const known = VENDOR_CATEGORIES.filter((c) => counts.has(c)).map(
      (c) => c as string
    );
    const unknown = [...counts.keys()]
      .filter((k) => k !== NO_CATEGORY && !known.includes(k))
      .sort();
    return [
      { value: ALL, label: "הכל", count: vendors.length },
      ...[...known, ...unknown].map((c) => ({
        value: c,
        label: c,
        count: counts.get(c) ?? 0,
      })),
      ...(counts.has(NO_CATEGORY)
        ? [
            {
              value: NO_CATEGORY,
              label: "ללא קטגוריה",
              count: counts.get(NO_CATEGORY) ?? 0,
            },
          ]
        : []),
    ];
  }, [vendors]);

  const visibleVendors = useMemo(() => {
    const q = query.trim().toLowerCase();
    return vendors
      .filter((v) =>
        category === ALL
          ? true
          : category === NO_CATEGORY
            ? !v.category
            : v.category === category
      )
      .filter((v) => !q || v.name.toLowerCase().includes(q));
  }, [vendors, category, query]);

  const selected = vendors.find((v) => v.id === vendorId);
  const hasPicked = vendorId !== "";

  function pick(id: string) {
    setVendorId(id);
    setQuery("");
  }

  function clearPick() {
    setVendorId("");
    setOtherName("");
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
    if (paid === null) {
      toast.error("יש לבחור שולם / לא שולם");
      return;
    }
    formData.set("vendor_id", vendorId);
    formData.set("vendor_name", vendorId === OTHER ? otherName.trim() : "");
    formData.set("paid", String(paid));
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
      {/* Once a supplier is chosen the whole picker collapses to one row,
          so the rest of the form is right there without scrolling. */}
      {hasPicked ? (
        <div className="grid gap-2">
          <Label className="text-base">ספק</Label>
          <div className="flex items-center gap-3 rounded-xl border-2 border-success bg-success-soft p-4">
            <Check className="size-6 shrink-0 text-success" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-lg font-bold">
                {vendorId === OTHER ? otherName.trim() || "ספק אחר" : selected?.name}
              </div>
              {selected?.category && (
                <Badge variant="secondary">{selected.category}</Badge>
              )}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={clearPick}>
              <Pencil className="size-4" />
              החלפה
            </Button>
          </div>
          {vendorId === OTHER && (
            <Input
              value={otherName}
              onChange={(e) => setOtherName(e.target.value)}
              placeholder="שם הספק"
              className="h-12 text-base"
              autoFocus
            />
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          <Label className="text-base">ספק *</Label>

          {/* Category first — one tap cuts the list to a handful. */}
          <div className="flex flex-wrap gap-2">
            {chips.map((chip) => (
              <Button
                key={chip.value}
                type="button"
                size="sm"
                variant={category === chip.value ? "default" : "outline"}
                className="h-10"
                onClick={() => setCategory(chip.value)}
              >
                {chip.label} · {chip.count}
              </Button>
            ))}
          </div>

          <div className="relative">
            <Search
              className="absolute start-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="חיפוש ספק..."
              className="h-12 ps-10 text-base"
              aria-label="חיפוש ספק"
            />
            {query && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute end-1 top-1/2 size-9 -translate-y-1/2"
                onClick={() => setQuery("")}
                aria-label="ניקוי חיפוש"
              >
                <X className="size-4" />
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {visibleVendors.map((v) => (
              <Button
                key={v.id}
                type="button"
                variant="outline"
                className="h-16 whitespace-normal text-base leading-tight"
                onClick={() => pick(v.id)}
              >
                {v.name}
              </Button>
            ))}
            <Button
              type="button"
              variant="outline"
              className="h-16 border-dashed text-base"
              onClick={() => pick(OTHER)}
            >
              ספק אחר...
            </Button>
          </div>

          {visibleVendors.length === 0 && (
            <p className="text-center text-muted-foreground">
              לא נמצא ספק — אפשר לרשום אותו כ&quot;ספק אחר&quot;
            </p>
          )}
        </div>
      )}

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
          defaultValue={initial?.amount ?? ""}
          className="h-14 text-center text-2xl font-bold"
        />
      </div>

      <div className="grid gap-2">
        <Label className="text-base">תשלום *</Label>
        <div className="grid grid-cols-2 gap-3">
          <Button
            type="button"
            className={cn(
              "h-16 text-lg",
              paid === true
                ? "bg-green-600 text-white hover:bg-green-700"
                : "bg-muted text-foreground hover:bg-muted/80"
            )}
            onClick={() => setPaid(true)}
          >
            שולם עכשיו
          </Button>
          <Button
            type="button"
            className={cn(
              "h-16 text-lg",
              paid === false
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-muted text-foreground hover:bg-muted/80"
            )}
            onClick={() => setPaid(false)}
          >
            לא שולם (חוב)
          </Button>
        </div>
      </div>

      {paid && (
        <>
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
        </>
      )}

      <div className="grid gap-2">
        <Label htmlFor="receipt" className="text-base flex items-center gap-2">
          <Camera className="size-5" />
          צילום קבלה (לא חובה)
        </Label>
        {initial?.hasReceipt && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <ImageIcon className="size-4" />
            יש קבלה מצולמת — צילום חדש יחליף אותה
          </p>
        )}
        <Input
          id="receipt"
          name="receipt"
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
    </form>
  );
}
