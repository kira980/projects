import "server-only";
import webpush from "web-push";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Web Push sending, server-only. Notifications are always initiated from
 * a trusted server context (e.g. after an order is created), so there's
 * no client/RLS concern — we read subscriptions with the service client,
 * scoped explicitly by business_id.
 */

let configured = false;

/** Lazily set VAPID details; returns false if keys aren't configured. */
function ensureConfigured(): boolean {
  if (configured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
  if (!publicKey || !privateKey) {
    console.warn(
      "[push] VAPID keys missing (NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY) — not sending"
    );
    return false;
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  // Log a prefix of the public key so a mismatch with the browser bundle's
  // NEXT_PUBLIC_VAPID_PUBLIC_KEY is easy to spot in the logs.
  console.info(
    `[push] VAPID configured (subject ${subject}, public key ${publicKey.slice(0, 12)}…)`
  );
  configured = true;
  return true;
}

export type PushScope = "production" | "driver" | "kiosk";

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  /**
   * Refresh-only push: the service worker triggers an in-app refresh and
   * suppresses the OS notification when the app is open (visible). Used for
   * the driver screen so a new delivery updates the list without a banner.
   */
  silent?: boolean;
};

/**
 * Sends a notification to every subscribed browser for a business + scope.
 * Never throws — push is best-effort and must not break the action that
 * triggered it. Dead subscriptions (410/404) are pruned.
 */
export async function sendPushToScope(
  businessId: string,
  scope: PushScope,
  payload: PushPayload
): Promise<void> {
  if (!ensureConfigured()) return;

  const supabase = createServiceClient();
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("business_id", businessId)
    .eq("scope", scope);

  if (!subs || subs.length === 0) {
    console.info(`[push] no ${scope} subscriptions for business ${businessId}`);
    return;
  }

  const body = JSON.stringify(payload);
  const staleIds: string[] = [];
  let sent = 0;

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          body,
          // Never let a slow push service hold the function open.
          { timeout: 5000 }
        );
        sent++;
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        // web-push errors carry the push service's response body — it names
        // the actual reason (e.g. Apple's "BadJwtToken" / "VapidPkHashMismatch").
        const responseBody = (err as { body?: string }).body?.slice(0, 300);
        let host = "?";
        try {
          host = new URL(s.endpoint).host;
        } catch {
          /* keep "?" */
        }
        console.error(
          `[push] send failed (status ${statusCode}, host ${host}):`,
          (err as Error).message,
          responseBody ?? ""
        );
        // 404/410 mean the subscription is gone — drop it.
        if (statusCode === 404 || statusCode === 410) {
          staleIds.push(s.id);
        }
        // 401/403 almost always mean the subscription was created under a
        // different VAPID key pair than the server now signs with. Fix the
        // VAPID env vars, then re-subscribe the device.
        if (statusCode === 401 || statusCode === 403) {
          console.error(
            `[push] hint: subscription ${s.id} likely predates the current VAPID keys — re-subscribe that screen`
          );
        }
      }
    })
  );

  console.info(`[push] sent ${sent}/${subs.length} ${scope} notifications`);

  if (staleIds.length > 0) {
    await supabase.from("push_subscriptions").delete().in("id", staleIds);
  }
}
