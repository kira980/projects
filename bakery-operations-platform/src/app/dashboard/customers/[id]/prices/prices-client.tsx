"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { setCustomerPrice } from "../../actions";
import { formatMoney } from "@/lib/format";

export type PriceRow = {
  product_id: string;
  product_name: string;
  unit_type: string;
  category_name: string | null;
  default_price: number;
  special_price: number | null;
  is_available: boolean;
};

const UNIT_LABELS: Record<string, string> = {
  unit: "יחידה",
  kg: 'ק"ג',
  tray: "מגש",
  box: "ארגז",
  package: "חבילה",
};

export function PricesClient({
  customerId,
  customerName,
  rows,
}: {
  customerId: string;
  customerName: string;
  rows: PriceRow[];
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  async function save(row: PriceRow, price: number | null, available: boolean) {
    setBusyId(row.product_id);
    const result = await setCustomerPrice(
      customerId,
      row.product_id,
      price,
      available
    );
    setBusyId(null);
    if (result.ok) {
      toast.success(
        price === null ? "חזרה למחיר הרגיל" : "המחיר נשמר"
      );
      setDrafts((d) => {
        const next = { ...d };
        delete next[row.product_id];
        return next;
      });
    } else {
      toast.error(result.error ?? "שגיאה");
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild aria-label="חזרה">
          <Link href={`/dashboard/customers/${customerId}`}>
            <ArrowRight className="size-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">מחירון — {customerName}</h1>
          <p className="text-sm text-muted-foreground">
            מחיר מיוחד גובר על מחיר ברירת המחדל. מוצר מוסתר לא יוצג ללקוח
            בפורטל ההזמנות העתידי.
          </p>
        </div>
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>מוצר</TableHead>
              <TableHead>קטגוריה</TableHead>
              <TableHead>יחידה</TableHead>
              <TableHead>מחיר רגיל</TableHead>
              <TableHead>מחיר ללקוח</TableHead>
              <TableHead>זמין ללקוח</TableHead>
              <TableHead className="w-40">פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  אין מוצרים — הוסיפו מוצרים בעמוד המוצרים
                </TableCell>
              </TableRow>
            )}
            {rows.map((row) => {
              const draft =
                drafts[row.product_id] ??
                (row.special_price !== null ? String(row.special_price) : "");
              const hasSpecial = row.special_price !== null;
              return (
                <TableRow key={row.product_id}>
                  <TableCell className="font-medium">
                    {row.product_name}
                    {hasSpecial && (
                      <Badge variant="secondary" className="ms-2">
                        מחיר מיוחד
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{row.category_name ?? "—"}</TableCell>
                  <TableCell>{UNIT_LABELS[row.unit_type] ?? row.unit_type}</TableCell>
                  <TableCell>{formatMoney(row.default_price)}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      dir="ltr"
                      className="w-28"
                      placeholder={String(row.default_price)}
                      value={draft}
                      onChange={(e) =>
                        setDrafts((d) => ({
                          ...d,
                          [row.product_id]: e.target.value,
                        }))
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={row.is_available}
                      disabled={busyId === row.product_id}
                      onCheckedChange={(v) =>
                        save(
                          row,
                          draft !== "" ? Number(draft) : row.special_price,
                          v
                        )
                      }
                      aria-label="זמין ללקוח"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === row.product_id || draft === ""}
                        onClick={() => save(row, Number(draft), row.is_available)}
                      >
                        שמירה
                      </Button>
                      {hasSpecial && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busyId === row.product_id}
                          onClick={() => save(row, null, true)}
                          title="חזרה למחיר רגיל"
                        >
                          <RotateCcw className="size-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
