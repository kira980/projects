/**
 * Temporary structured timing instrumentation for the performance audit.
 * Logs "[perf] <reqId> <label>: N ms" so related logs group by request.
 * Never log secrets, tokens, cookies, or subscription contents here.
 */

/** Short id to correlate all [perf] lines of one request. */
export function perfRequestId(): string {
  return Math.random().toString(36).slice(2, 8);
}

/** Times an async operation and logs its duration. */
export async function timed<T>(
  reqId: string,
  label: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    console.info(
      `[perf] ${reqId} ${label}: ${(performance.now() - start).toFixed(0)} ms`
    );
  }
}
