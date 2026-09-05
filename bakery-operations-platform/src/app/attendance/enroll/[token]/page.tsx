import { createServiceClient } from "@/lib/supabase/server";
import { hashToken } from "@/lib/android/token-util";
import { EnrollClient } from "./enroll-client";

export const metadata = { title: "חיבור טלפון" };

/**
 * What the worker lands on after scanning the QR or tapping the WhatsApp
 * link. The token names the worker, so there is nothing to type — no
 * username, no password, no picking a name off a list.
 */
export default async function EnrollPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createServiceClient();

  const { data: session } = await supabase
    .from("device_enrollments")
    .select("worker_id, expires_at, used_at, cancelled_at, workers (full_name, is_active)")
    .eq("token_hash", hashToken(token))
    .maybeSingle();

  const worker = session?.workers as unknown as
    | { full_name: string; is_active: boolean }
    | undefined;

  // Server component rendered per request — reading the clock is what
  // decides whether this link is still alive.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const state = !session
    ? "invalid"
    : session.cancelled_at
      ? "cancelled"
      : session.used_at
        ? "used"
        : Date.parse(session.expires_at) < now
          ? "expired"
          : !worker?.is_active
            ? "inactive"
            : "ready";

  return (
    <EnrollClient
      token={token}
      state={state}
      workerName={worker?.full_name ?? ""}
    />
  );
}
