"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  FileText,
  HandCoins,
  PackageCheck,
  Receipt,
  Store,
  Truck,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/format";
import { useIdleLogout } from "../use-idle-logout";
import { collectOrder } from "../actions";
import { OrdersDateNav } from "./date-nav";

export type OrderTypeTab = "takeaway" | "delivery";

export type WorkerOrder = {
  id: string;
  order_number: number;
  delivery_code: string | null;
  customer_name: string;
  customer_phone: string | null;
  delivery_time: string | null;
  status: string;
  total: number;
  /** Still owed on this order. */
  remaining: number;
  /** A קבלה / תעודת משלוח may be printed for this order. */
  receipt: boolean;
};

function OrderCard({
  order,
  type,
  date,
  onDone,
}: {
  order: WorkerOrder;
  type: OrderTypeTab;
  date: string;
  onDone: () => void;
}) {
  const [asking, setAsking] = useState(false);
  const [pending, setPending] = useState(false);

  const handedOver = order.status === "delivered";
  const isDelivery = type === "delivery";
  const actionLabel = isDelivery ? "נמסר" : "נאסף";
  // Documents return to this exact day + tab.
  const backQuery = `date=${date}&type=${type}`;

  async function hand(paid: boolean) {
    setPending(true);
    const result = await collectOrder(order.id, paid);
    setPending(false);
    setAsking(false);
    if (result.ok) {
      toast.success(result.info);
      onDone();
    } else {
      toast.error(result.error ?? "שגיאה");
    }
  }

  return (
    <div className="grid gap-3 rounded-2xl border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xl font-bold">
          {order.delivery_code ?? `#${order.order_number}`}
        </span>
        <span className="text-lg font-semibold">{order.customer_name}</span>
        {order.delivery_time && (
          <Badge variant="outline">{order.delivery_time}</Badge>
        )}
        {handedOver && (
          <Badge variant="success" className="gap-1">
            <BadgeCheck className="size-3.5" />
            {actionLabel}
          </Badge>
        )}
        <span className="ms-auto text-xl font-bold">
          {formatMoney(order.total)}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        {order.remaining > 0 ? (
          <Badge variant="destructive">
            נותר לתשלום {formatMoney(order.remaining)}
          </Badge>
        ) : (
          <Badge variant="success">שולם</Badge>
        )}
      </div>

      {/* Hand-over: one big button, then paid / unpaid. */}
      {asking ? (
        <div className="grid gap-2">
          <p className="text-center text-base font-semibold">
            {order.remaining > 0
              ? `האם הלקוח שילם ${formatMoney(order.remaining)}?`
              : "ההזמנה כבר שולמה — לאשר מסירה?"}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="success"
              className="h-20 flex-col gap-1 text-lg [&_svg]:size-7"
              disabled={pending}
              onClick={() => hand(true)}
            >
              <HandCoins />
              שולם
            </Button>
            <Button
              variant="destructive-solid"
              className="h-20 flex-col gap-1 text-lg [&_svg]:size-7"
              disabled={pending}
              onClick={() => hand(false)}
            >
              <X />
              לא שולם
            </Button>
          </div>
          <Button variant="ghost" disabled={pending} onClick={() => setAsking(false)}>
            ביטול
          </Button>
        </div>
      ) : (
        <Button
          variant={handedOver ? "outline" : "success"}
          className="h-20 text-2xl font-bold [&_svg]:size-8"
          disabled={pending}
          onClick={() => setAsking(true)}
        >
          {handedOver ? <Check /> : <PackageCheck />}
          {handedOver ? `${actionLabel} — עדכון` : actionLabel}
        </Button>
      )}

      {/* Printables — קבלה / תעודת משלוח only when the order carries one. */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/workers/orders/${order.id}?${backQuery}`}>
            <FileText className="size-4" />
            הצעת מחיר
          </Link>
        </Button>
        {order.receipt && (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/workers/orders/${order.id}/receipt?${backQuery}`}>
              <Receipt className="size-4" />
              קבלה
            </Link>
          </Button>
        )}
        {order.receipt && isDelivery && (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/workers/orders/${order.id}/delivery-note?${backQuery}`}>
              <Truck className="size-4" />
              תעודת משלוח
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}

export function WorkerOrdersClient({
  orders,
  date,
  today,
  type,
}: {
  orders: WorkerOrder[];
  date: string;
  today: string;
  type: OrderTypeTab;
}) {
  const router = useRouter();
  // Managers work through a list of orders — longer idle window.
  useIdleLogout(120);
  const [hideDone, setHideDone] = useState(false);

  const doneCount = orders.filter((o) => o.status === "delivered").length;
  const visible = hideDone
    ? orders.filter((o) => o.status !== "delivered")
    : orders;

  function switchType(next: OrderTypeTab) {
    router.push(`/workers/orders?date=${date}&type=${next}`);
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild aria-label="חזרה">
          <Link href="/workers/menu">
            <ArrowRight className="size-6" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">הזמנות</h1>
      </div>

      {/* איסוף עצמי is the default; משלוח is one tap away. */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          className="h-14 text-base [&_svg]:size-5"
          variant={type === "takeaway" ? "default" : "outline"}
          onClick={() => switchType("takeaway")}
        >
          <Store />
          איסוף עצמי
        </Button>
        <Button
          className="h-14 text-base [&_svg]:size-5"
          variant={type === "delivery" ? "default" : "outline"}
          onClick={() => switchType("delivery")}
        >
          <Truck />
          משלוחים
        </Button>
      </div>

      <OrdersDateNav date={date} today={today} type={type} />

      {doneCount > 0 && (
        <Button
          variant={hideDone ? "default" : "outline"}
          onClick={() => setHideDone((v) => !v)}
        >
          {hideDone
            ? `הצגת הכל (${orders.length})`
            : `הסתרת מה שכבר ${type === "delivery" ? "נמסר" : "נאסף"} (${doneCount})`}
        </Button>
      )}

      <div className="grid gap-4">
        {visible.length === 0 && (
          <p className="py-16 text-center text-lg text-muted-foreground">
            אין הזמנות ביום זה
          </p>
        )}
        {visible.map((o) => (
          <OrderCard
            key={o.id}
            order={o}
            type={type}
            date={date}
            onDone={() => router.refresh()}
          />
        ))}
      </div>
    </main>
  );
}
