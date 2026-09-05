"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Bell, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/i18n/locale-context";

/**
 * New-order alerts for the driver / production screens.
 *
 * These screens don't get server push (see use-auto-refresh) — instead we
 * watch the order list that auto-refresh brings in and fire a local alert
 * whenever an id appears that we hadn't seen before. The alert is a chime
 * + vibration + toast, plus a system notification when the worker has
 * granted permission. Browsers block sound and notifications until a user
 * gesture, so the bell button "primes" both on first tap.
 */

type WindowWithWebkitAudio = typeof window & {
  webkitAudioContext?: typeof AudioContext;
};

let audioCtx: AudioContext | null = null;

/** Unlock audio + ask for notification permission from a user gesture. */
export function primeAlerts(): void {
  try {
    if (!audioCtx) {
      const Ctor =
        window.AudioContext ?? (window as WindowWithWebkitAudio).webkitAudioContext;
      if (Ctor) audioCtx = new Ctor();
    }
    if (audioCtx && audioCtx.state === "suspended") void audioCtx.resume();
  } catch {
    /* audio not available — toast/vibrate still work */
  }
  try {
    if ("Notification" in window && Notification.permission === "default") {
      void Notification.requestPermission();
    }
  } catch {
    /* notifications not available */
  }
}

/** Short two-tone "ding-dong" using the Web Audio API — no asset needed. */
function playChime(): void {
  if (!audioCtx) return;
  try {
    if (audioCtx.state === "suspended") void audioCtx.resume();
    const now = audioCtx.currentTime;
    const tone = (freq: number, at: number) => {
      const osc = audioCtx!.createOscillator();
      const gain = audioCtx!.createGain();
      osc.connect(gain);
      gain.connect(audioCtx!.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + at);
      gain.gain.exponentialRampToValueAtTime(0.35, now + at + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.45);
      osc.start(now + at);
      osc.stop(now + at + 0.5);
    };
    tone(880, 0);
    tone(1174, 0.18);
  } catch {
    /* ignore */
  }
}

function vibrate(): void {
  try {
    navigator.vibrate?.([120, 60, 120]);
  } catch {
    /* not supported */
  }
}

export type BrowserPushSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

/** VAPID public key (base64url) → Uint8Array for applicationServerKey. */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

type SubscribeResult =
  | { status: "subscribed"; sub: BrowserPushSubscription }
  | { status: "insecure" | "unsupported" | "denied" | "error" };

/**
 * Registers the service worker and creates (or reuses) a push
 * subscription. Returns a status so the caller can tell the worker
 * exactly why background notifications aren't available. Must be called
 * from a user gesture. Logs details to the console for debugging.
 */
async function subscribeToPush(): Promise<SubscribeResult> {
  if (typeof window === "undefined") return { status: "unsupported" };

  // Service workers + Push require a secure context (https or localhost).
  if (!window.isSecureContext) {
    console.warn("[push] insecure context — needs https/localhost");
    return { status: "insecure" };
  }
  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapid) {
    console.warn(
      "[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY is missing from the build — rebuild/restart after setting it"
    );
    return { status: "unsupported" };
  }
  if (
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  ) {
    console.warn("[push] browser lacks serviceWorker/PushManager/Notification");
    return { status: "unsupported" };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.warn("[push] permission not granted:", permission);
      return { status: "denied" };
    }

    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    const desiredKey = urlBase64ToUint8Array(vapid);

    // Reuse an existing subscription only if it was created with the same
    // VAPID public key. If the key was rotated, the old subscription would
    // fail server-side with a 403 — so drop it and make a fresh one.
    let existing = await registration.pushManager.getSubscription();
    if (existing && !keyMatches(existing, desiredKey)) {
      console.info("[push] VAPID key changed — replacing old subscription");
      try {
        await existing.unsubscribe();
      } catch {
        /* ignore */
      }
      existing = null;
    }

    const sub =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: desiredKey,
      }));

    const json = sub.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      console.error("[push] subscription missing endpoint/keys", json);
      return { status: "error" };
    }
    console.info("[push] subscribed:", json.endpoint);
    return {
      status: "subscribed",
      sub: {
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      },
    };
  } catch (err) {
    console.error("[push] subscribe failed:", err);
    return { status: "error" };
  }
}

/** True if the subscription's applicationServerKey equals `desired`. */
function keyMatches(
  sub: PushSubscription,
  desired: Uint8Array<ArrayBuffer>
): boolean {
  const current = sub.options?.applicationServerKey;
  if (!current) return false;
  const currentBytes = new Uint8Array(current as ArrayBuffer);
  if (currentBytes.length !== desired.length) return false;
  for (let i = 0; i < desired.length; i++) {
    if (currentBytes[i] !== desired[i]) return false;
  }
  return true;
}

/**
 * Fires an alert whenever `ids` gains an entry that wasn't present before.
 * The very first list (initial load) is treated as "already known" so we
 * don't alert on every existing order when the screen opens.
 */
export function useNewOrdersAlert(ids: string[], message: string): void {
  const known = useRef<Set<string> | null>(null);
  const messageRef = useRef(message);
  useEffect(() => {
    messageRef.current = message;
  }, [message]);

  const key = ids.join(",");

  useEffect(() => {
    if (known.current === null) {
      known.current = new Set(ids);
      return;
    }
    const fresh = ids.filter((id) => !known.current!.has(id));
    known.current = new Set(ids);
    if (fresh.length === 0) return;

    const msg =
      fresh.length === 1
        ? messageRef.current
        : `${messageRef.current} (${fresh.length})`;
    // In-app feedback only (chime + vibration + toast). The OS-level
    // notification comes from the real Web Push via the service worker —
    // raising one here too would duplicate it whenever a refresh (manual
    // or push-triggered) surfaces the same new order.
    playChime();
    vibrate();
    toast.success(msg, { duration: 8000 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

/**
 * One-tap button that unlocks sound + system notifications. When a
 * `subscribeAction` is passed, it also registers for real Web Push so the
 * screen is notified even when the app is closed (used on production).
 */
export function AlertsButton({
  className,
  subscribeAction,
}: {
  className?: string;
  subscribeAction?: (
    sub: BrowserPushSubscription
  ) => Promise<{ ok: boolean; error?: string }>;
}) {
  const { t } = useLocale();
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  const subscribeActionRef = useRef(subscribeAction);
  useEffect(() => {
    subscribeActionRef.current = subscribeAction;
  }, [subscribeAction]);

  useEffect(() => {
    // Reflect an already-granted permission from a previous visit.
    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      // Permission granted ≠ subscribed. On push-capable screens the bell
      // must only turn green once a subscription really exists — otherwise
      // (notably on iOS, where pushManager.subscribe() is only allowed
      // inside a user tap, so this silent attempt gets refused) a green
      // bell would wrongly tell the worker there's nothing left to tap.
      const action = subscribeActionRef.current;
      if (!action) {
        // Local-alerts-only screens (e.g. driver): permission is all there is.
        setEnabled(true);
        return;
      }
      // Try to silently re-establish the subscription (works on Android /
      // desktop; iOS will refuse outside a tap — bell stays gray so the
      // worker knows to tap it).
      void (async () => {
        try {
          const result = await subscribeToPush();
          if (result.status === "subscribed") {
            const saved = await action(result.sub);
            if (saved.ok) {
              setEnabled(true);
            } else {
              console.error(
                "[push] auto-resubscribe: server rejected:",
                saved.error
              );
            }
          } else {
            console.warn("[push] auto-resubscribe skipped:", result.status);
          }
        } catch (err) {
          console.warn(
            "[push] auto-resubscribe refused (tap the bell to subscribe):",
            err
          );
        }
      })();
    }
  }, []);

  const onClick = useCallback(async () => {
    setBusy(true);
    primeAlerts();
    try {
      if (!subscribeAction) {
        // Screens without background push (e.g. driver) — local alerts only.
        setEnabled(true);
        toast.success(t("alerts_enabled_toast"));
        return;
      }

      const result = await subscribeToPush();
      if (result.status === "subscribed") {
        const saved = await subscribeAction(result.sub);
        if (saved.ok) {
          // Only now is background push truly active.
          setEnabled(true);
          toast.success(t("alerts_enabled_toast"));
        } else {
          console.error("[push] server rejected subscription:", saved.error);
          toast.error(t("alerts_save_failed"));
        }
        return;
      }

      // Background push unavailable — say why, but in-app alerts still work.
      if (result.status === "insecure") {
        toast.warning(t("alerts_https_required"));
      } else if (result.status === "denied") {
        toast.warning(t("alerts_denied"));
      } else {
        toast.warning(t("alerts_local_only"));
      }
    } finally {
      setBusy(false);
    }
  }, [t, subscribeAction]);

  return (
    <Button
      type="button"
      variant={enabled ? "success" : "outline"}
      onClick={onClick}
      disabled={busy}
      aria-pressed={enabled}
      title={enabled ? t("alerts_on") : t("enable_alerts")}
      className={className}
    >
      {enabled ? <BellRing className="size-5" /> : <Bell className="size-5" />}
      <span className="max-sm:sr-only">
        {enabled ? t("alerts_on") : t("enable_alerts")}
      </span>
    </Button>
  );
}
