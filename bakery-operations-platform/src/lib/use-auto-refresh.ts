"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Keeps a server-rendered screen fresh without any client-side data
 * access. It re-runs the page's secure server fetch (via router.refresh)
 * whenever the tab/app regains focus or becomes visible — so a screen
 * updates the moment the worker returns to it.
 *
 * Refresh model:
 *  - Event-driven by default: focus + visibility only (`intervalMs = 0`).
 *    On the production screen, real-time delivery comes from Web Push (the
 *    service worker triggers a refresh on a new order), so no idle polling
 *    is needed and the tablet does zero background work.
 *  - Optional polling fallback: pass a positive `intervalMs` to also poll
 *    on a timer. Kept intact so a fallback can be re-enabled in one place
 *    (e.g. `useAutoRefresh(30000)`) if push is ever unavailable, or for
 *    screens without push (like the driver app).
 *
 * We deliberately avoid Supabase Realtime here: the driver/production/
 * kiosk screens authenticate with a custom cookie (not Supabase Auth),
 * so all reads go through the service-role client server-side. Refreshing
 * the server component keeps that trust boundary — and business_id
 * scoping — completely intact.
 *
 * router.refresh() re-renders server components in place; local component
 * state (open forms, typed values) is preserved, so a refresh never
 * interrupts someone mid-entry.
 */
export function useAutoRefresh(intervalMs = 0) {
  const router = useRouter();

  useEffect(() => {
    // Optional timer — only runs while the screen is visible, and only
    // when a positive interval is requested (fallback mode).
    let timer: ReturnType<typeof setInterval> | null = null;
    const pollingEnabled = intervalMs > 0;

    const start = () => {
      if (!pollingEnabled || timer !== null) return;
      timer = setInterval(() => {
        if (!document.hidden) router.refresh();
      }, intervalMs);
    };

    const stop = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };

    const onVisible = () => {
      if (document.hidden) {
        stop();
      } else {
        // Coming back to the screen: refresh right away, then resume any
        // fallback polling.
        router.refresh();
        start();
      }
    };

    const onFocus = () => router.refresh();

    start();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, [router, intervalMs]);
}
