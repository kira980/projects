"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { VendorDialog, type VendorRow } from "./vendor-dialog";
import { setVendorActive } from "./actions";
import { formatMoney } from "@/lib/format";
import { VENDOR_CATEGORIES } from "@/lib/vendor-categories";

const ALL = "__all__";
const UNCATEGORIZED = "__none__";

export function VendorsTable({
  vendors,
}: {
  vendors: (VendorRow & { debt: number })[];
}) {
  const [category, setCategory] = useState<string>(ALL);

  async function onToggleActive(vendor: VendorRow, next: boolean) {
    const result = await setVendorActive(vendor.id, next);
    if (result.ok) {
      toast.success(next ? "הספק הופעל" : "הספק הושבת");
    } else {
      toast.error(result.error ?? "שגיאה");
    }
  }

  // Only categories actually in use get a chip, plus one for the leftovers.
  const counts = new Map<string, number>();
  for (const v of vendors) {
    const key = v.category ?? UNCATEGORIZED;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const chips = [
    { value: ALL, label: "הכל", count: vendors.length },
    ...VENDOR_CATEGORIES.filter((c) => counts.has(c)).map((c) => ({
      value: c as string,
      label: c as string,
      count: counts.get(c) ?? 0,
    })),
    ...(counts.has(UNCATEGORIZED)
      ? [
          {
            value: UNCATEGORIZED,
            label: "ללא קטגוריה",
            count: counts.get(UNCATEGORIZED) ?? 0,
          },
        ]
      : []),
  ];

  const visible = vendors.filter((v) =>
    category === ALL
      ? true
      : category === UNCATEGORIZED
        ? !v.category
        : v.category === category
  );

  const totalDebt = visible.reduce((sum, v) => sum + v.debt, 0);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">ספקים</h1>
          <p className="text-muted-foreground">
            {category === ALL ? "סה\"כ חוב פתוח לספקים" : "חוב פתוח בקטגוריה"}:{" "}
            {formatMoney(totalDebt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <VendorDialog
            trigger={
              <Button>
                <Plus className="size-4" />
                ספק חדש
              </Button>
            }
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="סינון לפי קטגוריה">
        {chips.map((chip) => (
          <Button
            key={chip.value}
            size="sm"
            variant={category === chip.value ? "default" : "outline"}
            onClick={() => setCategory(chip.value)}
          >
            {chip.label} · {chip.count}
          </Button>
        ))}
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>שם</TableHead>
              <TableHead>קטגוריה</TableHead>
              <TableHead>טלפון</TableHead>
              <TableHead>איש קשר</TableHead>
              <TableHead>חוב פתוח</TableHead>
              <TableHead>פעיל</TableHead>
              <TableHead className="w-20">פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  {vendors.length === 0
                    ? "אין ספקים עדיין — הוסיפו ספק ראשון"
                    : "אין ספקים בקטגוריה זו"}
                </TableCell>
              </TableRow>
            )}
            {visible.map((v) => (
              <TableRow key={v.id} className={v.is_active ? "" : "opacity-50"}>
                <TableCell>
                  <Link
                    href={`/dashboard/vendors/${v.id}`}
                    className="font-medium hover:underline"
                  >
                    {v.name}
                  </Link>
                </TableCell>
                <TableCell>
                  {v.category ? (
                    <Badge variant="secondary">{v.category}</Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell dir="ltr" className="text-end">
                  {v.phone ?? "—"}
                </TableCell>
                <TableCell>{v.contact_name ?? "—"}</TableCell>
                <TableCell>
                  {v.debt > 0 ? (
                    <Badge variant="destructive">{formatMoney(v.debt)}</Badge>
                  ) : (
                    <Badge variant="secondary">אין חוב</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Switch
                    checked={v.is_active}
                    onCheckedChange={(next) => onToggleActive(v, next)}
                    aria-label="פעיל"
                  />
                </TableCell>
                <TableCell>
                  <VendorDialog
                    vendor={v}
                    trigger={
                      <Button variant="ghost" size="icon" aria-label="עריכה">
                        <Pencil className="size-4" />
                      </Button>
                    }
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
