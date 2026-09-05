"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, Check, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useIdleLogout } from "../use-idle-logout";
import type { KioskResult } from "../actions";
import { formatMoney, formatTime } from "@/lib/format";
import {
  updateTodayAdvance,
  deleteTodayAdvance,
  deleteTodayVendorOrder,
  deleteTodayVendorPayment,
  updateTodayExpense,
  deleteTodayExpense,
} from "./history-actions";

export type HistoryEntry = {
  id: string;
  amount: number;
  at: string;
  label: string;
  paid?: boolean;
  /** Who recorded it — every shift member's actions are listed. */
  by?: string | null;
};

type Kind = "advance" | "vendor_order" | "vendor_payment" | "expense";

const DELETERS: Record<Kind, (id: string) => Promise<KioskResult>> = {
  advance: deleteTodayAdvance,
  vendor_order: deleteTodayVendorOrder,
  vendor_payment: deleteTodayVendorPayment,
  expense: deleteTodayExpense,
};

/** The kinds whose whole record is just an amount, editable in place. */
const AMOUNT_UPDATERS: Partial<
  Record<Kind, (id: string, amount: number) => Promise<KioskResult>>
> = {
  advance: updateTodayAdvance,
  expense: updateTodayExpense,
};

/**
 * Vendor entries open the full form they were recorded with; an advance or
 * an expense is only an amount here, so it stays editable inline.
 */
const EDIT_ROUTES: Partial<Record<Kind, string>> = {
  vendor_order: "/workers/history/vendor-order",
  vendor_payment: "/workers/history/vendor-payment",
};

function EntryRow({
  kind,
  entry,
  canEdit,
  onDone,
}: {
  kind: Kind;
  entry: HistoryEntry;
  /** Corrections are admin-only; everyone else reads the day. */
  canEdit: boolean;
  onDone: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(entry.amount));
  const [pending, setPending] = useState(false);
  const editHref = EDIT_ROUTES[kind];

  async function save() {
    const update = AMOUNT_UPDATERS[kind];
    if (!update) return;
    setPending(true);
    const result = await update(entry.id, Number(amount));
    setPending(false);
    if (result.ok) {
      toast.success(result.info);
      setEditing(false);
      onDone();
    } else {
      toast.error(result.error ?? "שגיאה");
    }
  }

  async function remove() {
    if (!confirm(`למחוק את הפעולה של ${formatMoney(entry.amount)}?`)) return;
    setPending(true);
    const result = await DELETERS[kind](entry.id);
    setPending(false);
    if (result.ok) {
      toast.success(result.info);
      onDone();
    } else {
      toast.error(result.error ?? "שגיאה");
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border bg-card p-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{entry.label}</span>
          {entry.paid !== undefined &&
            (entry.paid ? (
              <Badge variant="success">שולם</Badge>
            ) : (
              <Badge variant="destructive">לא שולם</Badge>
            ))}
        </div>
        <span className="text-sm text-muted-foreground">
          {formatTime(entry.at)}
          {entry.by && ` · ${entry.by}`}
        </span>
      </div>
      {editing && !editHref ? (
        <>
          <Input
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            dir="ltr"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-10 w-24 text-center font-bold"
            autoFocus
          />
          <Button
            size="icon"
            variant="success"
            aria-label="שמירה"
            disabled={pending || !amount || Number(amount) <= 0}
            onClick={save}
          >
            <Check className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="ביטול"
            disabled={pending}
            onClick={() => {
              setEditing(false);
              setAmount(String(entry.amount));
            }}
          >
            <X className="size-4" />
          </Button>
        </>
      ) : (
        <>
          <span className="font-bold">{formatMoney(entry.amount)}</span>
          {canEdit && editHref ? (
            <Button size="icon" variant="ghost" aria-label="עריכה" asChild>
              <Link href={`${editHref}/${entry.id}`}>
                <Pencil className="size-4" />
              </Link>
            </Button>
          ) : canEdit ? (
            <Button
              size="icon"
              variant="ghost"
              aria-label="עריכה"
              disabled={pending}
              onClick={() => setEditing(true)}
            >
              <Pencil className="size-4" />
            </Button>
          ) : null}
          {canEdit && (
            <Button
              size="icon"
              variant="ghost"
              aria-label="מחיקה"
              className="text-destructive"
              disabled={pending}
              onClick={remove}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </>
      )}
    </div>
  );
}

function Section({
  title,
  kind,
  entries,
  emptyText,
  canEdit,
  onDone,
}: {
  title: string;
  kind: Kind;
  entries: HistoryEntry[];
  emptyText: string;
  canEdit: boolean;
  onDone: () => void;
}) {
  return (
    <section className="grid gap-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      {entries.length === 0 && (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      )}
      {entries.map((e) => (
        <EntryRow
          key={e.id}
          kind={kind}
          entry={e}
          canEdit={canEdit}
          onDone={onDone}
        />
      ))}
    </section>
  );
}

export function HistoryClient({
  managerName,
  canEdit,
  advances,
  vendorOrders,
  vendorPayments,
  expenses,
}: {
  managerName: string;
  /** Only a worker with the admin role may fix or remove a line. */
  canEdit: boolean;
  advances: HistoryEntry[];
  vendorOrders: HistoryEntry[];
  vendorPayments: HistoryEntry[];
  expenses: HistoryEntry[];
}) {
  useIdleLogout(60);
  const router = useRouter();
  const refresh = () => router.refresh();

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-5 p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild aria-label="חזרה">
          <Link href="/workers/menu">
            <ArrowRight className="size-6" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">היסטוריה — היום</h1>
          <p className="text-sm text-muted-foreground">
            {canEdit
              ? `כל הפעולות של היום (${managerName}) — אפשר לתקן טעויות`
              : "כל הפעולות של היום — לצפייה בלבד. תיקון נעשה ע״י מנהל"}
          </p>
        </div>
      </div>

      <Section
        title="מפרעות"
        kind="advance"
        entries={advances}
        emptyText="לא ניתנו מפרעות היום"
        canEdit={canEdit}
        onDone={refresh}
      />
      <Section
        title="קבלות סחורה"
        kind="vendor_order"
        entries={vendorOrders}
        emptyText="לא נרשמו קבלות סחורה היום"
        canEdit={canEdit}
        onDone={refresh}
      />
      <Section
        title="תשלומי חוב לספקים"
        kind="vendor_payment"
        entries={vendorPayments}
        emptyText="לא נרשמו תשלומי חוב היום"
        canEdit={canEdit}
        onDone={refresh}
      />
      <Section
        title="תשלומים אחרים"
        kind="expense"
        entries={expenses}
        emptyText="לא נרשמו תשלומים אחרים היום"
        canEdit={canEdit}
        onDone={refresh}
      />
    </main>
  );
}
