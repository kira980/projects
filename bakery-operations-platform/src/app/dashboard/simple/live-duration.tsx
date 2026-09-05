"use client";

import { useSyncExternalStore } from "react";

const TICK_MS = 30_000;

function subscribe(onChange: () => void) {
  const timer = setInterval(onChange, TICK_MS);
  return () => clearInterval(timer);
}

// Bucketed to the tick so the snapshot is stable between them — an
// ever-changing value would make React re-render without end.
const clientNow = () => Math.floor(Date.now() / TICK_MS) * TICK_MS;

/** "3:25" — hours:minutes between two instants. */
function elapsed(fromMs: number, toMs: number): string {
  const minutes = Math.max(0, Math.floor((toMs - fromMs) / 60000));
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
}

/**
 * How long an open shift has been running.
 *
 * The page is server-rendered, so a duration computed there froze at
 * render time and drifted for the rest of the shift. This one keeps
 * counting.
 */
export function LiveDuration({
  since,
}: {
  /** ISO instant the open shift started. */
  since: string;
}) {
  const startMs = Date.parse(since);
  // The clock is an external store: the server snapshot is the shift start
  // (so SSR renders 0:00 rather than a time that cannot match), and the
  // client picks up the real one on hydration and every tick after.
  const now = useSyncExternalStore(subscribe, clientNow, () => startMs);

  return (
    <span className="tabular-nums" suppressHydrationWarning>
      {elapsed(startMs, now)}
    </span>
  );
}
