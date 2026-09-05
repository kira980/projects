"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowRight, Camera, Check, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getCustomerDebtOrders,
  getDebtOrderItems,
  recordMultiOrderDebtPayment,
  type DriverDebtOrder,
  type DebtOrderItem,
} from "../actions";
import { formatMoney, formatDate } from "@/lib/format";
import {
  allocatePayment,
  selectedRemaining,
  type PayableOrder,
} from "@/lib/payments/allocation";
import { useLocale } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";

export type CustomerOption = { id: string; name: string; monthly: boolean };

const METHOD_OPTIONS = [
  { value: "cash", label: "מזומן" },
  { value: "card", label: "אשראי" },
  { value: "transfer", label: "העברה" },
  { value: "check", label: "צ'ק" },
];

export function DebtPaymentClient({ customers }: { customers: CustomerOption[] }) {
  const { t } = useLocale();
  const [customerId, setCustomerId] = useState("");
  const [debts, setDebts] = useState<DriverDebtOrder[]>([]);
  const [loading, startLoading] = useTransition();
  const [selected, setSelected] = useState<string[]>([]);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [pending, setPending] = useState(false);
  const [query, setQuery] = useState("");
  const [monthlyOnly, setMonthlyOnly] = useState(false);
  // Expanded order details (items), fetched lazily per order.
  const [expanded, setExpanded] = useState<string | null>(null);
  const [itemsByOrder, setItemsByOrder] = useState<Record<string, DebtOrderItem[]>>({});

  function toggleDetails(orderId: string) {
    if (expanded === orderId) {
      setExpanded(null);
      return;
    }
    setExpanded(orderId);
    if (!itemsByOrder[orderId]) {
      getDebtOrderItems(orderId).then((items) =>
        setItemsByOrder((prev) => ({ ...prev, [orderId]: items }))
      );
    }
  }

  const filteredCustomers = customers
    .filter((c) => (monthlyOnly ? c.monthly : true))
    .filter((c) => (query ? c.name.includes(query) : true));

  function pickCustomer(id: string) {
    setCustomerId(id);
    setSelected([]);
    setAmount("");
    setDebts([]);
    startLoading(async () => {
      const result = await getCustomerDebtOrders(id);
      setDebts(result);
    });
  }

  const payable: PayableOrder[] = useMemo(
    () =>
      debts.map((d) => ({
        id: d.id,
        orderNumber: d.order_number,
        total: d.total,
        paid: d.paid,
      })),
    [debts]
  );

  const selectedTotal = useMemo(
    () => selectedRemaining(payable, selected),
    [payable, selected]
  );

  function toggleOrder(id: string) {
    setSelected((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      // Default the amount to the full selected remaining.
      setAmount(next.length ? String(selectedRemaining(payable, next)) : "");
      return next;
    });
  }

  const overpay =
    Number(amount) > 0 &&
    selected.length > 0 &&
    !allocatePayment(payable, selected, Number(amount)).ok;

  async function onSubmit(formData: FormData) {
    if (!customerId) {
      toast.error("יש לבחור לקוח");
      return;
    }
    if (selected.length === 0) {
      toast.error(t("select_orders"));
      return;
    }
    const check = allocatePayment(payable, selected, Number(amount));
    if (!check.ok) {
      toast.error(check.error);
      return;
    }

    formData.set("customer_id", customerId);
    formData.set("order_ids", selected.join(","));
    formData.set("amount", amount);
    formData.set("method", method);
    setPending(true);
    const result = await recordMultiOrderDebtPayment(formData);
    setPending(false);
    if (result.ok) {
      toast.success("התשלום נרשם");
      setCustomerId("");
      setDebts([]);
      setSelected([]);
      setAmount("");
    } else {
      toast.error(result.error ?? "שגיאה");
    }
  }

  const selectedCustomer = customers.find((c) => c.id === customerId);

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-5 p-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild aria-label="חזרה">
          <Link href="/driver/orders">
            <ArrowRight className="size-6" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">תשלום חוב לקוח</h1>
      </div>

      {!customerId && (
        <div className="grid gap-3">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={monthlyOnly ? "default" : "outline"}
              className="h-11"
              onClick={() => setMonthlyOnly((v) => !v)}
            >
              {t("monthly_customer")}
            </Button>
            <Input
              placeholder="חיפוש לקוח..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-11 text-base"
            />
          </div>
          <div className="grid gap-2">
            {filteredCustomers.map((c) => (
              <Button
                key={c.id}
                type="button"
                variant="outline"
                className="h-14 justify-between text-base"
                onClick={() => pickCustomer(c.id)}
              >
                <span>{c.name}</span>
                {c.monthly && (
                  <span className="text-xs text-muted-foreground">
                    {t("monthly_customer")}
                  </span>
                )}
              </Button>
            ))}
            {filteredCustomers.length === 0 && (
              <p className="py-6 text-center text-muted-foreground">לא נמצאו לקוחות</p>
            )}
          </div>
        </div>
      )}

      {customerId && (
        <form action={onSubmit} className="grid gap-5" autoComplete="off">
          <div className="flex items-center justify-between rounded-lg border bg-card p-3">
            <span className="text-lg font-semibold">{selectedCustomer?.name}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setCustomerId("");
                setDebts([]);
                setSelected([]);
              }}
            >
              החלפה
            </Button>
          </div>

          <div className="grid gap-2">
            <Label className="text-base">{t("select_orders")}</Label>
            {loading && <p className="text-sm text-muted-foreground">טוען חובות...</p>}
            <div className="grid gap-2">
              {debts.map((d) => {
                const isSel = selected.includes(d.id);
                const isOpen = expanded === d.id;
                const items = itemsByOrder[d.id];
                return (
                  <div
                    key={d.id}
                    className={cn(
                      "rounded-lg border",
                      isSel ? "border-green-600 bg-green-50 text-green-900" : "bg-card"
                    )}
                  >
                    <div className="flex h-14 items-center px-2">
                      <button
                        type="button"
                        onClick={() => toggleOrder(d.id)}
                        className="flex h-full flex-1 items-center justify-between px-2 text-base"
                      >
                        <span className="flex items-center gap-2">
                          <span
                            className={cn(
                              "flex size-6 items-center justify-center rounded border",
                              isSel && "border-green-600 bg-green-600 text-white"
                            )}
                          >
                            {isSel && <Check className="size-4" />}
                          </span>
                          <span>הזמנה #{d.order_number}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(d.delivery_date)}
                          </span>
                        </span>
                        <span className="font-bold">{formatMoney(d.remaining)}</span>
                      </button>
                      <button
                        type="button"
                        aria-label="פרטי הזמנה"
                        onClick={() => toggleDetails(d.id)}
                        className="flex size-10 items-center justify-center text-muted-foreground"
                      >
                        {isOpen ? (
                          <ChevronUp className="size-5" />
                        ) : (
                          <ChevronDown className="size-5" />
                        )}
                      </button>
                    </div>
                    {isOpen && (
                      <div className="border-t px-4 py-2 text-sm">
                        {!items && (
                          <p className="py-2 text-muted-foreground">טוען פריטים...</p>
                        )}
                        {items?.map((item, i) => (
                          <div key={i} className="flex justify-between py-1">
                            <span>
                              {item.product_name}
                              <span className="ms-2 text-muted-foreground">
                                × {item.quantity}
                              </span>
                            </span>
                            <span>{formatMoney(item.line_total)}</span>
                          </div>
                        ))}
                        {items && (
                          <div className="mt-1 flex justify-between border-t pt-2 font-bold">
                            <span>סה&quot;כ הזמנה</span>
                            <span>{formatMoney(d.total)}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {!loading && debts.length === 0 && (
                <p className="text-sm text-muted-foreground">{t("no_open_debt")}</p>
              )}
            </div>
          </div>

          {selected.length > 0 && (
            <>
              <div className="flex items-center justify-between rounded-lg bg-muted p-3 text-base">
                <span>{t("selected_total")}</span>
                <span className="font-bold">{formatMoney(selectedTotal)}</span>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="amount" className="text-base">
                  סכום (₪) *
                </Label>
                <Input
                  id="amount"
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  dir="ltr"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className={cn(
                    "h-14 text-center text-2xl font-bold",
                    overpay && "border-red-500"
                  )}
                />
                {overpay && (
                  <p className="text-xs text-red-600">הסכום גבוה מהחוב שנבחר</p>
                )}
              </div>

              <div className="grid gap-2">
                <Label className="text-base">אמצעי תשלום</Label>
                <div className="grid grid-cols-4 gap-2">
                  {METHOD_OPTIONS.map((m) => (
                    <Button
                      key={m.value}
                      type="button"
                      variant={method === m.value ? "default" : "outline"}
                      className={cn("h-12")}
                      onClick={() => setMethod(m.value)}
                    >
                      {m.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="proof" className="text-base flex items-center gap-2">
                  <Camera className="size-5" />
                  צילום אסמכתא (לא חובה)
                </Label>
                <Input
                  id="proof"
                  name="proof"
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
                <Textarea id="notes" name="notes" rows={2} />
              </div>

              <Button
                type="submit"
                disabled={pending || overpay || Number(amount) <= 0}
                className="h-16 bg-green-600 text-lg text-white hover:bg-green-700"
              >
                {pending ? "שומר..." : "אישור תשלום"}
              </Button>
            </>
          )}
        </form>
      )}
    </main>
  );
}
