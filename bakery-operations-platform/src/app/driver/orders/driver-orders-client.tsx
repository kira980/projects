"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import dynamic from "next/dynamic";
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  DoorOpen,
  Map as MapIcon,
  MapPin,
  Navigation,
  Phone,
  RefreshCw,
  Search,
  Wallet,
  X,
} from "lucide-react";
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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { completeDeliveryOrder, driverLogout, saveDriverPushSubscription } from "../actions";
import { formatMoney, formatDate } from "@/lib/format";
import { UNIT_TYPE_LABELS } from "@/lib/order-status";
import { useLocale } from "@/lib/i18n/locale-context";
import { useAutoRefresh } from "@/lib/use-auto-refresh";
import { AlertsButton, useNewOrdersAlert } from "@/components/order-alerts";
import { cn } from "@/lib/utils";

// Client-only, lazy: Leaflet + its CSS load only when the map is opened.
const DeliveriesMap = dynamic(
  () => import("./deliveries-map").then((m) => m.DeliveriesMap),
  { ssr: false }
);

export type DriverStop = {
  delivery_order_id: string;
  order_id: string;
  order_number: number;
  delivery_code: string | null;
  customer_name: string;
  customer_phone: string | null;
  address_text: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  delivery_time: string | null;
  notes_for_driver: string | null;
  amount_to_collect: number;
  status: string;
  collected_amount: number;
  items: { product_name: string; quantity: number; unit_type: string }[];
};

const OUTCOME_OPTIONS = [
  { value: "delivered_paid", labelKey: "outcome_paid", color: "bg-green-600 hover:bg-green-700" },
  { value: "delivered_unpaid", labelKey: "outcome_unpaid", color: "bg-amber-500 hover:bg-amber-600" },
  { value: "partial", labelKey: "outcome_partial", color: "bg-blue-600 hover:bg-blue-700" },
  { value: "failed", labelKey: "outcome_failed", color: "bg-red-600 hover:bg-red-700" },
] as const;

const OUTCOME_LABELS: Record<string, string> = {
  delivered_paid: "נמסר ושולם",
  delivered_unpaid: "נמסר ללא תשלום",
  partial: "שולם חלקית",
  failed: "נכשל",
};

const OUTCOME_BADGE: Record<string, string> = {
  delivered_paid: "bg-green-600 hover:bg-green-600",
  delivered_unpaid: "bg-amber-500 hover:bg-amber-500",
  partial: "bg-blue-600 hover:bg-blue-600",
  failed: "bg-red-600 hover:bg-red-600",
};

const METHODS = [
  { value: "cash", labelKey: "method_cash" },
  { value: "card", labelKey: "method_card" },
  { value: "transfer", labelKey: "method_transfer" },
  { value: "check", labelKey: "method_check" },
] as const;

function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function StopCard({ stop, distanceLabel }: { stop: DriverStop; distanceLabel?: string }) {
  const router = useRouter();
  const { t } = useLocale();
  const [outcome, setOutcome] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [pending, setPending] = useState(false);

  const needsAmount = outcome === "delivered_paid" || outcome === "partial";

  function pickOutcome(value: string) {
    setOutcome(value);
    if (value === "delivered_paid") setAmount(String(stop.amount_to_collect));
    else if (value === "delivered_unpaid" || value === "failed") setAmount("0");
    else setAmount("");
  }

  async function onSubmit(formData: FormData) {
    if (!outcome) {
      toast.error(t("choose_outcome"));
      return;
    }
    formData.set("order_id", stop.order_id);
    formData.set("outcome", outcome);
    formData.set("collected_amount", amount || "0");
    formData.set("method", method);
    setPending(true);
    const result = await completeDeliveryOrder(formData);
    setPending(false);
    if (result.ok) {
      toast.success(`#${stop.order_number}`);
      router.refresh();
    } else {
      toast.error(result.error ?? "שגיאה");
    }
  }

  const mapsQuery = encodeURIComponent(stop.address_text ?? "");
  const isDone = stop.status !== "pending";

  return (
    <div className="grid gap-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        {stop.delivery_code && (
          <Badge className="bg-primary text-base font-mono text-primary-foreground hover:bg-primary">
            {stop.delivery_code}
          </Badge>
        )}
        <span className="text-xl font-bold">#{stop.order_number}</span>
        <span className="text-lg font-semibold">{stop.customer_name}</span>
        <div className="ms-auto flex items-center gap-2">
          {distanceLabel && <Badge variant="outline">{distanceLabel}</Badge>}
          {stop.delivery_time && <Badge variant="outline">{stop.delivery_time}</Badge>}
        </div>
      </div>

      {stop.address_text && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="size-4 shrink-0" />
          {stop.address_text}
        </p>
      )}

      {isDone ? (
        <div className="flex items-center justify-between rounded-lg border p-3">
          <Badge className={cn("text-white", OUTCOME_BADGE[stop.status])}>
            {OUTCOME_LABELS[stop.status] ?? stop.status}
          </Badge>
          {stop.collected_amount > 0 && (
            <span className="font-bold">{formatMoney(stop.collected_amount)}</span>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            {stop.customer_phone && (
              <Button variant="outline" className="h-12" asChild>
                <a href={`tel:${stop.customer_phone}`}>
                  <Phone className="size-5" />
                  {t("call")}
                </a>
              </Button>
            )}
            {stop.address_text && (
              <>
                <Button variant="outline" className="h-12" asChild>
                  <a
                    href={`https://waze.com/ul?q=${mapsQuery}&navigate=yes`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Navigation className="size-5" />
                    Waze
                  </a>
                </Button>
                <Button variant="outline" className="h-12" asChild>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${mapsQuery}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MapPin className="size-5" />
                    {t("maps")}
                  </a>
                </Button>
              </>
            )}
          </div>

          <ul className="grid gap-1 rounded-lg bg-muted/50 p-3 text-sm">
            {stop.items.map((item, i) => (
              <li key={i} className="flex justify-between">
                <span>{item.product_name}</span>
                <span className="font-medium">
                  {item.quantity} {UNIT_TYPE_LABELS[item.unit_type] ?? ""}
                </span>
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 p-3">
            <span className="flex items-center gap-2 font-medium">
              <Wallet className="size-5" />
              {t("to_collect")}
            </span>
            <span className="text-2xl font-bold">
              {formatMoney(stop.amount_to_collect)}
            </span>
          </div>

          {stop.notes_for_driver && (
            <p className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-sm font-medium text-amber-900">
              📝 {stop.notes_for_driver}
            </p>
          )}

          <form action={onSubmit} className="grid gap-3" autoComplete="off">
            <div className="grid grid-cols-2 gap-2">
              {OUTCOME_OPTIONS.map((o) => (
                <Button
                  key={o.value}
                  type="button"
                  className={cn(
                    "h-14 text-white",
                    outcome === o.value
                      ? o.color
                      : "bg-muted text-foreground hover:bg-muted/70"
                  )}
                  onClick={() => pickOutcome(o.value)}
                >
                  {t(o.labelKey)}
                </Button>
              ))}
            </div>

            {outcome && (
              <>
                {needsAmount && (
                  <div className="grid gap-2">
                    <Label>{t("collected_amount")}</Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      dir="ltr"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="h-12 text-center text-xl font-bold"
                    />
                    <div className="grid grid-cols-4 gap-2">
                      {METHODS.map((m) => (
                        <Button
                          key={m.value}
                          type="button"
                          variant={method === m.value ? "default" : "outline"}
                          className="h-10"
                          onClick={() => setMethod(m.value)}
                        >
                          {t(m.labelKey)}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid gap-2">
                  <Label className="flex items-center gap-2">
                    <Camera className="size-4" />
                    {t("proof_photo_optional")}
                  </Label>
                  <Input
                    name="proof"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="h-11 pt-2"
                  />
                </div>

                <div className="grid gap-2">
                  <Label>{t("driver_note")}</Label>
                  <Textarea name="driver_notes" rows={2} />
                </div>

                <Button type="submit" disabled={pending} className="h-14 text-lg">
                  {pending ? t("saving") : t("confirm_update")}
                </Button>
              </>
            )}
          </form>
        </>
      )}
    </div>
  );
}

type Filter = "all" | "active" | "done";
type SortMode = "default" | "distance" | "code";

export function DriverOrdersClient({
  stops,
  collectedTotal,
  date,
  today,
  prevDate,
  nextDate,
}: {
  stops: DriverStop[];
  driverName?: string;
  collectedTotal: number;
  date: string;
  today: string;
  prevDate: string;
  nextDate: string;
}) {
  const router = useRouter();
  const { t, locale } = useLocale();
  // No idle polling — refresh on reopen/focus, and instantly when a new
  // delivery arrives via a silent push (below). Zero DB reads while idle.
  useAutoRefresh();
  // Chime + toast when a delivery we hadn't seen appears.
  useNewOrdersAlert(
    stops.map((s) => s.order_id),
    t("new_order_alert")
  );
  // A new delivery sends a refresh-only push; the service worker relays it
  // here (direct message + BroadcastChannel — the latter is the reliable
  // path on iOS PWAs) so the list updates with no OS banner.
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
  const [filter, setFilter] = useState<Filter>("active");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [sortMode, setSortMode] = useState<SortMode>("default");
  const [query, setQuery] = useState("");
  const [showMap, setShowMap] = useState(false);
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [geoError, setGeoError] = useState(false);

  const dayName = new Intl.DateTimeFormat(locale === "ar" ? "ar" : "he-IL", {
    timeZone: "Asia/Jerusalem",
    weekday: "long",
  }).format(new Date(`${date}T12:00:00Z`));
  const isToday = date === today;

  function goToDay(d: string) {
    router.push(`/driver/orders?date=${d}`);
  }

  const activeCount = stops.filter((s) => s.status === "pending").length;
  const doneCount = stops.length - activeCount;

  const cities = useMemo(
    () => [...new Set(stops.map((s) => s.city).filter((c): c is string => !!c))],
    [stops]
  );

  useEffect(() => {
    if (sortMode !== "distance" || myLocation || geoError) return;
    if (!navigator.geolocation) {
      // Defer out of the effect body (no synchronous setState in effect).
      queueMicrotask(() => setGeoError(true));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setMyLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setGeoError(true)
    );
  }, [sortMode, myLocation, geoError]);

  const q = query.trim().toLowerCase();
  const filtered = stops
    .filter((s) => {
      if (filter === "active") return s.status === "pending";
      if (filter === "done") return s.status !== "pending";
      return true;
    })
    .filter((s) => cityFilter === "all" || s.city === cityFilter)
    .filter((s) => {
      if (!q) return true;
      return (
        String(s.order_number).includes(q) ||
        (s.delivery_code ?? "").toLowerCase().includes(q) ||
        s.customer_name.toLowerCase().includes(q)
      );
    });

  const sorted = [...filtered].sort((a, b) => {
    if (sortMode === "code") {
      return (a.delivery_code ?? "").localeCompare(b.delivery_code ?? "");
    }
    if (sortMode === "distance" && myLocation) {
      const da =
        a.latitude && a.longitude
          ? distanceKm(myLocation, { lat: a.latitude, lng: a.longitude })
          : Infinity;
      const db =
        b.latitude && b.longitude
          ? distanceKm(myLocation, { lat: b.latitude, lng: b.longitude })
          : Infinity;
      return da - db;
    }
    return 0;
  });

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold">{t("driver_orders_title")}</h1>
        <div className="ms-auto flex gap-2">
          <AlertsButton subscribeAction={saveDriverPushSubscription} />
          <Button variant="outline" size="icon" onClick={() => setShowMap(true)} aria-label={t("map")}>
            <MapIcon className="size-5" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => router.refresh()} aria-label={t("refresh")}>
            <RefreshCw className="size-5" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => void driverLogout()} aria-label={t("logout")}>
            <DoorOpen className="size-5" />
          </Button>
        </div>
      </div>

      {/* Day navigator — arrows move between days (4:00 business day). */}
      <div className="flex items-center gap-2 rounded-xl border bg-card p-2">
        <Button variant="ghost" size="icon" className="size-11" onClick={() => goToDay(prevDate)} aria-label={t("prev_day")}>
          <ChevronRight className="size-6" />
        </Button>
        <div className="flex-1 text-center leading-tight">
          <div className="text-lg font-bold">
            {dayName}
            {isToday ? <span className="text-primary"> · {t("today_label")}</span> : null}
          </div>
          <div className="text-sm text-muted-foreground">{formatDate(date)}</div>
        </div>
        <Button variant="ghost" size="icon" className="size-11" onClick={() => goToDay(nextDate)} aria-label={t("next_day")}>
          <ChevronLeft className="size-6" />
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="border-success/40 bg-success-soft/40">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground">{t("collected_today")}</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-bold text-success">{formatMoney(collectedTotal)}</CardContent>
        </Card>
        <Card className="border-primary/40 bg-primary-soft/40">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground">{t("total_deliveries")}</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-bold text-primary">{stops.length}</CardContent>
        </Card>
        <Card className="border-blue-500/40 bg-blue-50">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground">{t("completed")}</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-bold text-blue-600">
            {doneCount}/{stops.length}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button className="h-12 bg-amber-500 text-white hover:bg-amber-600" asChild>
          <Link href="/driver/debt-payment">
            <CircleDollarSign className="size-5" />
            {t("debt_payment_button")}
          </Link>
        </Button>
        <Button variant="outline" className="h-12" asChild>
          <Link href="/driver/summary">{t("collection_summary")}</Link>
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {([
          ["active", t("filter_active"), activeCount],
          ["done", t("filter_done"), doneCount],
          ["all", t("filter_all"), stops.length],
        ] as [Filter, string, number][]).map(([value, label, count]) => (
          <Button
            key={value}
            variant={filter === value ? "default" : "outline"}
            className="h-11"
            onClick={() => setFilter(value)}
          >
            {label} · {count}
          </Button>
        ))}
      </div>

      {/* Search by order number, code, or customer name. */}
      <div className="relative">
        <Search className="absolute start-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("driver_search_placeholder")}
          className="h-12 ps-10 pe-10 text-base"
          aria-label={t("driver_search_placeholder")}
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute end-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted"
            aria-label={t("clear")}
          >
            <X className="size-5" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
          <SelectTrigger className="h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">{t("sort_default")}</SelectItem>
            <SelectItem value="distance">{t("sort_distance")}</SelectItem>
            <SelectItem value="code">{t("sort_code")}</SelectItem>
          </SelectContent>
        </Select>
        {cities.length > 0 ? (
          <Select value={cityFilter} onValueChange={setCityFilter}>
            <SelectTrigger className="h-11">
              <SelectValue placeholder="עיר" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("city_all")}</SelectItem>
              {cities.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div />
        )}
      </div>
      {sortMode === "distance" && geoError && (
        <p className="text-sm text-muted-foreground">
          לא ניתן לגשת למיקום — הצגה בסדר ברירת מחדל.
        </p>
      )}

      {sorted.length === 0 && (
        <p className="py-16 text-center text-lg text-muted-foreground">
          {filter === "active" ? t("no_active_deliveries") : t("no_deliveries")}
        </p>
      )}
      {sorted.map((stop) => (
        <StopCard
          key={stop.order_id}
          stop={stop}
          distanceLabel={
            sortMode === "distance" && myLocation && stop.latitude && stop.longitude
              ? `${distanceKm(myLocation, { lat: stop.latitude, lng: stop.longitude }).toFixed(1)} ק"מ`
              : undefined
          }
        />
      ))}

      {showMap && <DeliveriesMap stops={stops} onClose={() => setShowMap(false)} />}
    </main>
  );
}
