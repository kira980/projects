"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  DoorOpen,
  ListChecks,
  RefreshCw,
  Store,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { setProductionStatus, markAllReady, productionLogout, savePushSubscription } from "../actions";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/order-status";
import { formatDate } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-context";
import { unitLabel } from "@/lib/i18n/dictionary";
import { useAutoRefresh } from "@/lib/use-auto-refresh";
import { AlertsButton, useNewOrdersAlert } from "@/components/order-alerts";
import { cn } from "@/lib/utils";

/** Baker-facing item name: Arabic when set, otherwise the Hebrew name. */
function bakerItemName(item: {
  product_name: string;
  product_name_ar: string | null;
}): string {
  return item.product_name_ar?.trim() || item.product_name;
}

export type ProductionOrderItem = {
  id: string;
  product_name: string;
  /** Arabic name for the baker screen; falls back to the Hebrew name. */
  product_name_ar: string | null;
  quantity: number;
  original_quantity: number;
  prepared_quantity: number | null;
  missing_quantity: number;
  unit_price: number;
  unit_type: string;
  notes: string | null;
};

export type ProductionOrder = {
  id: string;
  order_number: number;
  delivery_code: string | null;
  customer_name: string;
  status: OrderStatus;
  delivery_type: string;
  delivery_date: string;
  delivery_time: string | null;
  notes_for_baker: string | null;
  shortage_note: string | null;
  items: ProductionOrderItem[];
};

/** משלוח / איסוף עצמי / both. */
export type DeliveryTypeFilter = "all" | "delivery" | "takeaway";

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-600",
  preparing: "bg-amber-500",
  ready: "bg-green-600",
  problem: "bg-red-600",
  shortage: "bg-orange-600",
};

const isTakeaway = (o: ProductionOrder) => o.delivery_type !== "delivery";

function OrderCard({ order }: { order: ProductionOrder }) {
  const router = useRouter();
  const { t, locale } = useLocale();
  const [pending, setPending] = useState(false);
  const takeaway = isTakeaway(order);

  async function markReady() {
    setPending(true);
    const result = await setProductionStatus(order.id, "ready");
    setPending(false);
    if (result.ok) {
      toast.success(`#${order.order_number}: ${ORDER_STATUS_LABELS.ready}`);
      router.refresh();
    } else {
      toast.error(result.error ?? "שגיאה");
    }
  }

  return (
    <div className="grid gap-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        {order.delivery_code && (
          <Badge className="bg-primary font-mono text-base text-primary-foreground hover:bg-primary">
            {order.delivery_code}
          </Badge>
        )}
        <span className="text-xl font-bold">#{order.order_number}</span>
        <Badge
          className={cn("text-white", STATUS_COLORS[order.status] ?? "bg-gray-500")}
        >
          {ORDER_STATUS_LABELS[order.status]}
        </Badge>
        <Badge variant="outline" className="gap-1">
          {takeaway ? <Store className="size-3.5" /> : <Truck className="size-3.5" />}
          {t(takeaway ? "type_takeaway" : "type_delivery")}
        </Badge>
        {order.delivery_time && (
          <span className="ms-auto text-sm text-muted-foreground">
            {order.delivery_time}
          </span>
        )}
      </div>

      <div className="text-lg font-semibold">{order.customer_name}</div>

      <ul className="grid gap-1 rounded-lg bg-muted/50 p-3">
        {order.items.map((item) => (
          <li key={item.id} className="flex items-baseline justify-between gap-2 text-lg">
            <span>{bakerItemName(item)}</span>
            <span className="font-bold">
              {item.quantity} {unitLabel(item.unit_type, locale)}
              {item.missing_quantity > 0 && (
                <span className="ms-2 text-sm font-normal text-orange-600">
                  ({t("missing")} {item.missing_quantity})
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>

      {order.notes_for_baker && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-sm font-medium text-amber-900">
          📝 {order.notes_for_baker}
        </p>
      )}

      {order.shortage_note && (
        <p className="rounded-lg border border-orange-300 bg-orange-50 p-2 text-sm font-medium text-orange-900">
          ⚠️ {order.shortage_note}
        </p>
      )}

      {/* Ready is the only action on this screen. */}
      <Button
        disabled={pending || order.status === "ready"}
        onClick={markReady}
        className="h-16 bg-green-600 text-lg text-white hover:bg-green-700"
      >
        <Check className="size-6" />
        {t("status_ready")}
      </Button>
    </div>
  );
}

type DayFilter = "all" | "todo" | "ready";

export function ProductionOrdersClient({
  orders,
  date,
  today,
  tomorrow,
  prevDate,
  nextDate,
  initialType,
  bakerName,
}: {
  orders: ProductionOrder[];
  date: string;
  today: string;
  tomorrow: string;
  prevDate: string;
  nextDate: string;
  initialType: DeliveryTypeFilter;
  bakerName: string;
}) {
  const router = useRouter();
  const { t, locale } = useLocale();
  // Web Push (via the service worker) refreshes instantly on a new order,
  // and returning to the screen refreshes too. The 20s visible-only poll
  // is a floor for platforms where the SW→page signal is unreliable
  // (iOS PWAs): worst case the open screen is 20s behind, zero cost while
  // the screen is hidden.
  useAutoRefresh(20000);
  // Chime + toast when auto-refresh brings in an order we hadn't seen.
  // Keyed by date at the page level, so switching days re-seeds instead
  // of chiming for the new day's orders.
  useNewOrdersAlert(
    orders.map((o) => o.id),
    t("new_order_alert")
  );
  // When a push arrives while the screen is open, refresh immediately.
  // Listen on both channels the service worker uses: direct client
  // messages and a BroadcastChannel (the latter is the reliable path on
  // iOS PWAs, where SW→client postMessage can silently not arrive).
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "new-order") router.refresh();
    };
    const hasSW =
      typeof navigator !== "undefined" && "serviceWorker" in navigator;
    if (hasSW) {
      navigator.serviceWorker.addEventListener("message", onMessage);
    }
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("orders-refresh");
      bc.addEventListener("message", onMessage);
    } catch {
      /* BroadcastChannel unsupported — SW messages still apply */
    }
    return () => {
      if (hasSW) {
        navigator.serviceWorker.removeEventListener("message", onMessage);
      }
      bc?.close();
    };
  }, [router]);
  const [filter, setFilter] = useState<DayFilter>("todo");
  const [type, setType] = useState<DeliveryTypeFilter>(initialType);
  const [markingAll, setMarkingAll] = useState(false);

  // Type first: every count and action below follows the chosen type.
  const typeOrders = orders.filter((o) =>
    type === "all" ? true : type === "takeaway" ? isTakeaway(o) : !isTakeaway(o)
  );

  const typeCounts = {
    all: orders.length,
    delivery: orders.filter((o) => !isTakeaway(o)).length,
    takeaway: orders.filter(isTakeaway).length,
  };
  const counts = {
    all: typeOrders.length,
    todo: typeOrders.filter((o) => o.status !== "ready").length,
    ready: typeOrders.filter((o) => o.status === "ready").length,
  };
  const visibleOrders = typeOrders.filter((o) =>
    filter === "all" ? true : filter === "ready" ? o.status === "ready" : o.status !== "ready"
  );

  const dayName = new Intl.DateTimeFormat(locale === "ar" ? "ar" : "he-IL", {
    timeZone: "Asia/Jerusalem",
    weekday: "long",
  }).format(new Date(`${date}T12:00:00Z`));
  const relative =
    date === today ? t("today_label") : date === tomorrow ? t("tomorrow_label") : null;

  function goToDay(d: string) {
    router.push(`/production/orders?date=${d}&type=${type}`);
  }

  const readyableIds = typeOrders
    .filter((o) => o.status !== "ready")
    .map((o) => o.id);

  async function onMarkAllReady() {
    if (readyableIds.length === 0) return;
    if (!confirm(t("mark_all_ready_confirm"))) return;
    setMarkingAll(true);
    const result = await markAllReady(readyableIds);
    setMarkingAll(false);
    if (result.ok) {
      toast.success(t("mark_all_ready"));
      router.refresh();
    } else {
      toast.error(result.error ?? "שגיאה");
    }
  }

  const typeTabs: { value: DeliveryTypeFilter; label: string; count: number }[] = [
    { value: "all", label: t("type_all"), count: typeCounts.all },
    { value: "delivery", label: t("type_delivery"), count: typeCounts.delivery },
    { value: "takeaway", label: t("type_takeaway"), count: typeCounts.takeaway },
  ];

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold">{t("production_orders_title")}</h1>
        <span className="text-sm text-muted-foreground">
          {t("hello_prefix")} {bakerName}
        </span>
        <div className="ms-auto flex flex-wrap gap-2">
          <AlertsButton subscribeAction={savePushSubscription} />
          <Button variant="outline" size="icon" onClick={() => router.refresh()} aria-label={t("refresh")}>
            <RefreshCw className="size-5" />
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/production/tomorrow-summary?date=${date}&type=${type}`}>
              <ListChecks className="size-5" />
              {t("day_summary")}
            </Link>
          </Button>
          <Button variant="outline" onClick={() => void productionLogout()}>
            <DoorOpen className="size-5" />
            {t("logout")}
          </Button>
        </div>
      </div>

      {/* Day navigator — arrows change the day; default is tomorrow. */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" className="size-12" onClick={() => goToDay(prevDate)} aria-label={t("prev_day")}>
          <ChevronRight className="size-6" />
        </Button>
        <div className="flex-1 text-center">
          <div className="text-lg font-bold">
            {dayName}
            {relative ? <span className="text-primary"> · {relative}</span> : null}
          </div>
          <div className="text-sm text-muted-foreground">{formatDate(date)}</div>
        </div>
        <Button variant="outline" size="icon" className="size-12" onClick={() => goToDay(nextDate)} aria-label={t("next_day")}>
          <ChevronLeft className="size-6" />
        </Button>
      </div>

      {/* משלוח / איסוף עצמי — both kinds live on this one screen. */}
      <div className="grid grid-cols-3 gap-2">
        {typeTabs.map((tab) => (
          <Button
            key={tab.value}
            className="h-12"
            variant={type === tab.value ? "default" : "outline"}
            onClick={() => setType(tab.value)}
          >
            {tab.label} · {tab.count}
          </Button>
        ))}
      </div>

      {/* Status filter — defaults to "to do". */}
      <div className="grid grid-cols-3 gap-2">
        <Button
          className="h-12"
          variant={filter === "all" ? "default" : "outline"}
          onClick={() => setFilter("all")}
        >
          {t("filter_all")} · {counts.all}
        </Button>
        <Button
          className="h-12"
          variant={filter === "todo" ? "default" : "outline"}
          onClick={() => setFilter("todo")}
        >
          {t("filter_todo")} · {counts.todo}
        </Button>
        <Button
          className="h-12"
          variant={filter === "ready" ? "default" : "outline"}
          onClick={() => setFilter("ready")}
        >
          {t("filter_ready")} · {counts.ready}
        </Button>
      </div>

      {readyableIds.length > 0 && (
        <Button
          className="h-14 bg-green-600 text-lg text-white hover:bg-green-700"
          disabled={markingAll}
          onClick={onMarkAllReady}
        >
          <CheckCheck className="size-5" />
          {markingAll ? t("updating") : `${t("mark_all_ready")} (${readyableIds.length})`}
        </Button>
      )}

      <div className="grid gap-4">
        {visibleOrders.length === 0 && (
          <p className="py-16 text-center text-lg text-muted-foreground">
            {t("no_orders_day")}
          </p>
        )}
        {visibleOrders.map((o) => (
          <OrderCard key={o.id} order={o} />
        ))}
      </div>
    </main>
  );
}
