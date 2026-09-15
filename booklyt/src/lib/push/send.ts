import webpush from "web-push"
import { createServiceClient } from "@/lib/supabase/service"

type PushPayload = {
  title: string
  body: string
  url?: string
  icon?: string | null
}

type StoredSubscription = {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

type PushDeliveryDetail = {
  endpointHost: string
  statusCode: number | null
  ok: boolean
  removed: boolean
  error?: string
}

function configureWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@example.com"

  if (!publicKey || !privateKey) return false

  webpush.setVapidDetails(subject, publicKey, privateKey)
  return true
}

export async function sendPushToSubscriptions(subscriptions: StoredSubscription[], payload: PushPayload) {
  if (!configureWebPush()) return
  await Promise.all(subscriptions.map(async subscription => {
    try {
      await webpush.sendNotification(
        { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
        JSON.stringify(payload),
        { TTL: 86400, urgency: "high" },
      )
    } catch (error) {
      const statusCode = typeof error === "object" && error && "statusCode" in error
        ? Number((error as { statusCode: unknown }).statusCode) : null
      if (statusCode === 404 || statusCode === 410) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const supabase = createServiceClient() as any
        await supabase.from("push_subscriptions").delete().eq("id", subscription.id)
      }
    }
  }))
}

export async function sendCustomerAppointmentPush(appointmentId: string, payload: PushPayload) {
  if (!configureWebPush()) return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceClient() as any
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("appointment_id", appointmentId) as { data: StoredSubscription[] | null }
  if (subs && subs.length > 0) await sendPushToSubscriptions(subs, payload)
}

export async function sendWaitlistCustomerPush(waitlistEntryIds: string[], payload: PushPayload) {
  if (!configureWebPush() || waitlistEntryIds.length === 0) return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceClient() as any
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("waitlist_entry_id", waitlistEntryIds) as { data: StoredSubscription[] | null }
  if (subs && subs.length > 0) await sendPushToSubscriptions(subs, payload)
}

export async function sendBusinessPushNotification(businessId: string, payload: PushPayload) {
  if (!configureWebPush()) {
    console.warn("Push notification skipped: VAPID keys are missing.")
    return { attempted: 0, sent: 0, removed: 0, failed: 0, skipped: "missing_vapid_keys" as const }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceClient() as any
  const { data: subscriptions } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("business_id", businessId) as { data: StoredSubscription[] | null }

  const result = {
    attempted: subscriptions?.length ?? 0,
    sent: 0,
    removed: 0,
    failed: 0,
    details: [] as PushDeliveryDetail[],
  }

  await Promise.all((subscriptions ?? []).map(async subscription => {
    const endpointHost = new URL(subscription.endpoint).host
    try {
      const response = await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        },
        JSON.stringify(payload),
        {
          TTL: 60,
          urgency: "high",
        }
      )
      result.sent += 1
      result.details.push({
        endpointHost,
        statusCode: response.statusCode ?? null,
        ok: true,
        removed: false,
      })
    } catch (error) {
      const statusCode = typeof error === "object" && error && "statusCode" in error
        ? Number((error as { statusCode: unknown }).statusCode)
        : null
      const message = error instanceof Error ? error.message : "Unknown push error"

      if (statusCode === 404 || statusCode === 410) {
        await supabase.from("push_subscriptions").delete().eq("id", subscription.id)
        result.removed += 1
        result.details.push({
          endpointHost,
          statusCode,
          ok: false,
          removed: true,
          error: message,
        })
      } else {
        result.failed += 1
        result.details.push({
          endpointHost,
          statusCode,
          ok: false,
          removed: false,
          error: message,
        })
        console.error("Push notification failed:", error)
      }
    }
  }))

  return result
}
