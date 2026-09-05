"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, History, Minus, Plus, Store, Trash2, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createOrder,
  getCustomerPricedProducts,
  getCustomerRecentOrders,
  type RecentOrderSummary,
} from "../actions";
import type { PricedProduct } from "@/lib/db/pricing";
import { formatMoney, formatDate } from "@/lib/format";
import { UNIT_TYPE_LABELS } from "@/lib/order-status";
import {
  defaultDeliveryDate,
  jerusalemToday,
  jerusalemTomorrow,
} from "@/lib/delivery-day";

export type CustomerOption = {
  id: string;
  name: string;
  /** Whether this customer's orders are issued with a קבלה by default. */
  receipt: boolean;
  addresses: { id: string; address_text: string; city: string | null; is_default: boolean }[];
};

type CartLine = {
  product: PricedProduct;
  quantity: number;
  notes: string;
  /** Raw text in the quantity box — lets it be emptied mid-typing. */
  draft: string;
};

/**
 * Quantity prompt shown when a product is tapped. The amount is typed
 * (or stepped) and confirmed, so nothing enters the cart by accident.
 */
function QuantityDialog({
  product,
  current,
  onClose,
  onConfirm,
}: {
  product: PricedProduct | null;
  /** Quantity already in the cart for this product, if any. */
  current: number;
  onClose: () => void;
  onConfirm: (quantity: number) => void;
}) {
  // Mounted fresh per product (keyed by the caller), so editing an existing
  // line opens on its current quantity.
  const [value, setValue] = useState(current > 0 ? String(current) : "1");

  const parsed = Number(value);
  const valid = value.trim() !== "" && !isNaN(parsed) && parsed > 0;

  function bump(delta: number) {
    const base = isNaN(parsed) ? 0 : parsed;
    setValue(String(Math.max(0, Math.round((base + delta) * 100) / 100)));
  }

  return (
    <Dialog
      open={product !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>{product?.name}</DialogTitle>
        </DialogHeader>
        {product && (
          <form autoComplete="off"
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (valid) onConfirm(parsed);
            }}
          >
            <p className="text-sm text-muted-foreground">
              {formatMoney(product.effective_price)} /{" "}
              {UNIT_TYPE_LABELS[product.unit_type] ?? product.unit_type}
              {current > 0 && ` · כבר בהזמנה: ${current}`}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-12"
                onClick={() => bump(-1)}
                aria-label="הפחתה"
              >
                <Minus className="size-5" />
              </Button>
              <Input
                autoFocus
                type="number"
                inputMode="decimal"
                min="0"
                step="0.5"
                dir="ltr"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onFocus={(e) => e.target.select()}
                className="h-12 flex-1 text-center text-xl font-bold"
                aria-label="כמות"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-12"
                onClick={() => bump(1)}
                aria-label="הוספה"
              >
                <Plus className="size-5" />
              </Button>
            </div>
            <Button type="submit" size="lg" disabled={!valid}>
              {current > 0 ? "עדכון כמות" : "הוספה להזמנה"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function NewOrderClient({ customers }: { customers: CustomerOption[] }) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState("");
  const [products, setProducts] = useState<PricedProduct[]>([]);
  const [loadingProducts, startLoading] = useTransition();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [deliveryType, setDeliveryType] = useState<"delivery" | "pickup">("delivery");
  // 06:00 rule: after 06:00 the order is for tomorrow; before 06:00 it
  // still belongs to this morning's delivery.
  const [deliveryDate, setDeliveryDate] = useState(defaultDeliveryDate);
  const [recentOrders, setRecentOrders] = useState<RecentOrderSummary[]>([]);
  // Issue a receipt (קבלה + תעודת משלוח) for this order. Defaults from the
  // chosen customer, but can be flipped per order.
  const [receipt, setReceipt] = useState(false);
  const [pending, setPending] = useState(false);
  // Product awaiting a typed quantity (null = dialog closed).
  const [quantityFor, setQuantityFor] = useState<PricedProduct | null>(null);

  const customer = customers.find((c) => c.id === customerId);
  const defaultAddress =
    customer?.addresses.find((a) => a.is_default) ?? customer?.addresses[0];

  function onCustomerChange(id: string) {
    setCustomerId(id);
    setCart([]);
    setRecentOrders([]);
    // Pre-fill the receipt toggle from the customer's default.
    setReceipt(customers.find((c) => c.id === id)?.receipt ?? false);
    startLoading(async () => {
      try {
        const [priced, recent] = await Promise.all([
          getCustomerPricedProducts(id),
          getCustomerRecentOrders(id),
        ]);
        setProducts(priced.filter((p) => p.is_available_to_customer));
        setRecentOrders(recent);
      } catch {
        toast.error("טעינת המוצרים נכשלה");
      }
    });
  }

  /** Load a previous order's items into the cart — fully editable after. */
  function loadPreviousOrder(orderId: string, priced: PricedProduct[]) {
    const order = recentOrders.find((o) => o.id === orderId);
    if (!order) return;
    const byId = new Map(priced.map((p) => [p.id, p]));
    const lines: CartLine[] = [];
    let missing = 0;
    for (const item of order.items) {
      const product = item.product_id ? byId.get(item.product_id) : undefined;
      if (product) {
        lines.push({
          product,
          quantity: item.quantity,
          notes: "",
          draft: String(item.quantity),
        });
      } else {
        missing++;
      }
    }
    setCart(lines);
    if (missing > 0) {
      toast.warning(`${missing} פריטים מההזמנה הקודמת כבר לא זמינים ולא נוספו`);
    } else {
      toast.success(`הפריטים מהזמנה #${order.order_number} נוספו — אפשר לערוך`);
    }
  }

  /** Confirmed from the quantity dialog — sets (not adds to) the line. */
  function addToCart(product: PricedProduct, quantity: number) {
    setCart((lines) => {
      const draft = String(quantity);
      if (lines.some((l) => l.product.id === product.id)) {
        return lines.map((l) =>
          l.product.id === product.id ? { ...l, quantity, draft } : l
        );
      }
      return [...lines, { product, quantity, notes: "", draft }];
    });
    setQuantityFor(null);
  }

  /**
   * Live edit of a cart quantity. The typed text is kept as-is so the box
   * can be emptied while retyping; the line is only removed by its own
   * remove button, never by clearing the field.
   */
  function editQuantity(productId: string, text: string) {
    const parsed = Number(text);
    setCart((lines) =>
      lines.map((l) =>
        l.product.id === productId
          ? {
              ...l,
              draft: text,
              quantity:
                text.trim() === "" || isNaN(parsed) || parsed < 0
                  ? l.quantity
                  : parsed,
            }
          : l
      )
    );
  }

  /** On blur, an empty or invalid box snaps back to the kept quantity. */
  function commitQuantity(productId: string) {
    setCart((lines) =>
      lines.map((l) =>
        l.product.id === productId ? { ...l, draft: String(l.quantity) } : l
      )
    );
  }

  function stepQuantity(productId: string, delta: number) {
    setCart((lines) =>
      lines.map((l) => {
        if (l.product.id !== productId) return l;
        const next = Math.max(0, Math.round((l.quantity + delta) * 100) / 100);
        return { ...l, quantity: next, draft: String(next) };
      })
    );
  }

  function removeLine(productId: string) {
    setCart((lines) => lines.filter((l) => l.product.id !== productId));
  }

  const total = cart.reduce(
    (sum, l) => sum + l.product.effective_price * l.quantity,
    0
  );

  async function onSubmit(formData: FormData) {
    if (!customerId) {
      toast.error("יש לבחור לקוח");
      return;
    }
    const orderedLines = cart.filter((l) => l.quantity > 0);
    if (orderedLines.length === 0) {
      toast.error("יש להוסיף פריטים");
      return;
    }
    setPending(true);
    const result = await createOrder({
      customer_id: customerId,
      delivery_type: deliveryType,
      delivery_date: String(formData.get("delivery_date") ?? ""),
      delivery_time: String(formData.get("delivery_time") ?? ""),
      address_text: String(formData.get("address_text") ?? ""),
      notes: String(formData.get("notes") ?? ""),
      notes_for_baker: String(formData.get("notes_for_baker") ?? ""),
      notes_for_driver: String(formData.get("notes_for_driver") ?? ""),
      receipt,
      items: orderedLines.map((l) => ({
        product_id: l.product.id,
        quantity: l.quantity,
        notes: l.notes,
      })),
    });
    setPending(false);
    if (result.ok && result.orderId) {
      toast.success("ההזמנה נוצרה");
      router.push(`/dashboard/orders/${result.orderId}`);
    } else {
      toast.error(result.error ?? "שגיאה");
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild aria-label="חזרה">
          <Link href="/dashboard/orders">
            <ArrowRight className="size-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">הזמנה חדשה</h1>
      </div>

      {/* Enter inside any field (quantity, date, address...) must never
          submit — the order is created only by the button below. */}
      <form
        action={onSubmit}
        onKeyDown={(e) => {
          if (
            e.key === "Enter" &&
            (e.target as HTMLElement).tagName === "INPUT"
          ) {
            e.preventDefault();
          }
        }}
        className="grid gap-4 lg:grid-cols-3"
      >
        <div className="grid gap-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>לקוח ואספקה</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <Label>לקוח *</Label>
                <SearchableSelect
                  options={customers.map((c) => ({ value: c.id, label: c.name }))}
                  value={customerId}
                  onChange={onCustomerChange}
                  placeholder="בחרו לקוח..."
                  searchPlaceholder="חיפוש לקוח..."
                />
              </div>

              {recentOrders.length > 0 && (
                <div className="grid gap-2 rounded-lg bg-primary-soft/60 p-3">
                  <Label className="flex items-center gap-2">
                    <History className="size-4 text-primary" />
                    הזמנה חוזרת
                  </Label>
                  <Select value="" onValueChange={(id) => loadPreviousOrder(id, products)}>
                    <SelectTrigger className="w-full bg-background">
                      <SelectValue placeholder="טעינת פריטים מהזמנה קודמת..." />
                    </SelectTrigger>
                    <SelectContent>
                      {recentOrders.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {`הזמנה #${o.order_number} · ${formatDate(o.delivery_date)} · ${formatMoney(o.total)}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    הפריטים ייטענו לעגלה ואפשר לשנות כמויות לפני השמירה.
                  </p>
                </div>
              )}

              <div className="grid gap-2">
                <Label>סוג אספקה</Label>
                <div className="grid grid-cols-2 gap-2" role="group" aria-label="סוג אספקה">
                  <Button
                    type="button"
                    variant={deliveryType === "delivery" ? "default" : "outline"}
                    onClick={() => setDeliveryType("delivery")}
                    aria-pressed={deliveryType === "delivery"}
                  >
                    <Truck className="size-4" />
                    משלוח
                  </Button>
                  <Button
                    type="button"
                    variant={deliveryType === "pickup" ? "default" : "outline"}
                    onClick={() => setDeliveryType("pickup")}
                    aria-pressed={deliveryType === "pickup"}
                  >
                    <Store className="size-4" />
                    איסוף עצמי
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="grid gap-0.5">
                  <Label htmlFor="receipt">קבלה</Label>
                  <span className="text-sm text-muted-foreground">
                    הפקת קבלה ותעודת משלוח להזמנה זו
                  </span>
                </div>
                <Switch
                  id="receipt"
                  checked={receipt}
                  onCheckedChange={setReceipt}
                  aria-label="קבלה"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="delivery_date">תאריך אספקה *</Label>
                  <Input
                    id="delivery_date"
                    name="delivery_date"
                    type="date"
                    dir="ltr"
                    required
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="xs"
                      variant={deliveryDate === jerusalemToday() ? "secondary" : "ghost"}
                      onClick={() => setDeliveryDate(jerusalemToday())}
                    >
                      היום
                    </Button>
                    <Button
                      type="button"
                      size="xs"
                      variant={deliveryDate === jerusalemTomorrow() ? "secondary" : "ghost"}
                      onClick={() => setDeliveryDate(jerusalemTomorrow())}
                    >
                      מחר
                    </Button>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="delivery_time">שעה</Label>
                  <Input id="delivery_time" name="delivery_time" type="time" dir="ltr" />
                </div>
              </div>
              {deliveryType === "delivery" && (
                <div className="grid gap-2">
                  <Label htmlFor="address_text">כתובת למשלוח</Label>
                  <Input
                    id="address_text"
                    name="address_text"
                    key={defaultAddress?.id ?? "empty"}
                    defaultValue={
                      defaultAddress
                        ? `${defaultAddress.address_text}${defaultAddress.city ? ", " + defaultAddress.city : ""}`
                        : ""
                    }
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                מוצרים
                {loadingProducts && (
                  <span className="ms-2 text-sm font-normal text-muted-foreground">
                    טוען מחירי לקוח...
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!customerId ? (
                <p className="py-6 text-center text-muted-foreground">
                  בחרו לקוח כדי לראות את המחירון שלו
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {products.map((p) => {
                    const inCart = cart.find((l) => l.product.id === p.id)?.quantity ?? 0;
                    return (
                      <Button
                        key={p.id}
                        type="button"
                        variant="outline"
                        className={`relative h-auto flex-col items-start gap-1 p-3 text-start ${
                          inCart > 0 ? "border-primary bg-primary-soft/50" : ""
                        }`}
                        onClick={() => setQuantityFor(p)}
                      >
                        {inCart > 0 && (
                          <Badge className="absolute top-1.5 end-1.5">×{inCart}</Badge>
                        )}
                        <span className="font-semibold">{p.name}</span>
                        <span className="flex items-center gap-1 text-sm text-muted-foreground">
                          {formatMoney(p.effective_price)} /{" "}
                          {UNIT_TYPE_LABELS[p.unit_type] ?? p.unit_type}
                          {p.has_special_price && (
                            <Badge variant="secondary" className="text-[10px]">
                              מחיר מיוחד
                            </Badge>
                          )}
                        </span>
                      </Button>
                    );
                  })}
                  {products.length === 0 && !loadingProducts && (
                    <p className="col-span-full py-6 text-center text-muted-foreground">
                      אין מוצרים זמינים
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>הערות</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="notes">הערה כללית</Label>
                <Textarea id="notes" name="notes" rows={2} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="notes_for_baker">הערה לאופה</Label>
                <Textarea id="notes_for_baker" name="notes_for_baker" rows={2} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="notes_for_driver">הערה לנהג</Label>
                <Textarea id="notes_for_driver" name="notes_for_driver" rows={2} />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 self-start">
          <Card>
            <CardHeader>
              <CardTitle>פריטי ההזמנה</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {cart.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  לחצו על מוצרים כדי להוסיף
                </p>
              )}
              {cart.map((line) => (
                <div key={line.product.id} className="grid gap-1 rounded-lg border p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{line.product.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {formatMoney(line.product.effective_price * line.quantity)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-8"
                      onClick={() => stepQuantity(line.product.id, -1)}
                      aria-label="הפחתה"
                    >
                      <Minus className="size-4" />
                    </Button>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.5"
                      dir="ltr"
                      className="h-8 w-20 text-center"
                      value={line.draft}
                      onChange={(e) =>
                        editQuantity(line.product.id, e.target.value)
                      }
                      onBlur={() => commitQuantity(line.product.id)}
                      onFocus={(e) => e.target.select()}
                      aria-label="כמות"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-8"
                      onClick={() => stepQuantity(line.product.id, 1)}
                      aria-label="הוספה"
                    >
                      <Plus className="size-4" />
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {UNIT_TYPE_LABELS[line.product.unit_type] ?? ""}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="ms-auto size-8"
                      onClick={() => removeLine(line.product.id)}
                      aria-label="הסרה"
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between border-t pt-3 text-lg font-bold">
                <span>סה&quot;כ</span>
                <span>{formatMoney(total)}</span>
              </div>
              <Button
                type="submit"
                size="lg"
                disabled={pending || cart.every((l) => l.quantity <= 0)}
              >
                {pending ? "שומר..." : "יצירת הזמנה"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </form>

      {/* Keyed by product so each prompt opens fresh. */}
      <QuantityDialog
        key={quantityFor?.id ?? "closed"}
        product={quantityFor}
        current={
          cart.find((l) => l.product.id === quantityFor?.id)?.quantity ?? 0
        }
        onClose={() => setQuantityFor(null)}
        onConfirm={(quantity) => {
          if (quantityFor) addToCart(quantityFor, quantity);
        }}
      />
    </div>
  );
}
