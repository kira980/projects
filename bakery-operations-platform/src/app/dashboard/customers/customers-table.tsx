"use client";

import Link from "next/link";
import { toast } from "sonner";
import { MapPin, Pencil, Plus, Tags } from "lucide-react";
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
import { CustomerDialog, type CustomerRow } from "./customer-dialog";
import { setCustomerActive, setCustomerReceipt } from "./actions";

type DefaultAddress = {
  address_text: string;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
};

/** Google Maps link — precise pin when coordinates exist, else a text search. */
function mapsUrl(a: DefaultAddress): string {
  const query =
    a.latitude != null && a.longitude != null
      ? `${a.latitude},${a.longitude}`
      : [a.address_text, a.city].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function CustomersTable({
  customers,
}: {
  customers: (CustomerRow & {
    special_prices_count: number;
    default_address: DefaultAddress | null;
  })[];
}) {
  async function onToggleActive(customer: CustomerRow, next: boolean) {
    const result = await setCustomerActive(customer.id, next);
    if (result.ok) toast.success(next ? "הלקוח הופעל" : "הלקוח הושבת");
    else toast.error(result.error ?? "שגיאה");
  }

  async function onToggleReceipt(customer: CustomerRow, next: boolean) {
    const result = await setCustomerReceipt(customer.id, next);
    if (result.ok) toast.success(next ? "קבלה הופעלה ללקוח" : "קבלה בוטלה ללקוח");
    else toast.error(result.error ?? "שגיאה");
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">לקוחות</h1>
        <CustomerDialog
          trigger={
            <Button>
              <Plus className="size-4" />
              לקוח חדש
            </Button>
          }
        />
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>שם</TableHead>
              <TableHead>טלפון</TableHead>
              <TableHead>מיקום</TableHead>
              <TableHead>סוג</TableHead>
              <TableHead>תנאי תשלום</TableHead>
              <TableHead>מחירים מיוחדים</TableHead>
              <TableHead>קבלה</TableHead>
              <TableHead>פעיל</TableHead>
              <TableHead className="w-24">פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                  אין לקוחות עדיין — הוסיפו לקוח ראשון
                </TableCell>
              </TableRow>
            )}
            {customers.map((c) => (
              <TableRow key={c.id} className={c.is_active ? "" : "opacity-50"}>
                <TableCell>
                  <Link
                    href={`/dashboard/customers/${c.id}`}
                    className="font-medium hover:underline"
                  >
                    {c.name}
                  </Link>
                </TableCell>
                <TableCell dir="ltr" className="text-end">
                  {c.phone ?? "—"}
                </TableCell>
                <TableCell>
                  {c.default_address ? (
                    <a
                      href={mapsUrl(c.default_address)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex max-w-56 items-center gap-1.5 text-primary hover:underline"
                      title={[c.default_address.address_text, c.default_address.city]
                        .filter(Boolean)
                        .join(", ")}
                    >
                      <MapPin className="size-4 shrink-0" aria-hidden />
                      <span className="truncate">
                        {[c.default_address.address_text, c.default_address.city]
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {c.customer_type === "business" ? "עסקי" : "פרטי"}
                </TableCell>
                <TableCell>
                  {c.payment_terms === "immediate"
                    ? "מיידי"
                    : c.payment_terms === "monthly"
                      ? "חודשי"
                      : "מותאם"}
                </TableCell>
                <TableCell>
                  {c.special_prices_count > 0 ? (
                    <Badge variant="secondary">{c.special_prices_count} מוצרים</Badge>
                  ) : (
                    <span className="text-muted-foreground">מחירון רגיל</span>
                  )}
                </TableCell>
                <TableCell>
                  <Switch
                    checked={c.receipt}
                    onCheckedChange={(next) => onToggleReceipt(c, next)}
                    aria-label="קבלה"
                  />
                </TableCell>
                <TableCell>
                  <Switch
                    checked={c.is_active}
                    onCheckedChange={(next) => onToggleActive(c, next)}
                    aria-label="פעיל"
                  />
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <CustomerDialog
                      customer={c}
                      trigger={
                        <Button variant="ghost" size="icon" aria-label="עריכה">
                          <Pencil className="size-4" />
                        </Button>
                      }
                    />
                    <Button variant="ghost" size="icon" asChild aria-label="מחירים">
                      <Link href={`/dashboard/customers/${c.id}/prices`}>
                        <Tags className="size-4" />
                      </Link>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
