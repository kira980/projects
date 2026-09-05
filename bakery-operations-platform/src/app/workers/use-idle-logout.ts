"use client";

import { useEffect, useRef } from "react";
import { kioskLogout } from "./actions";

/**
 * Shared kiosk tablet: log the worker out after `seconds` of no touch
 * or key activity (default 30s).
 */
export function useIdleLogout(seconds = 30) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function reset() {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void kioskLogout();
      }, seconds * 1000);
    }
    const events = ["pointerdown", "keydown", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, reset));
    reset();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [seconds]);
}
