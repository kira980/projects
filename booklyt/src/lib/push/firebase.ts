/**
 * Firebase Admin (FCM) sender for native customer devices.
 * Requires FIREBASE_SERVICE_ACCOUNT_JSON (full service-account JSON, one line).
 * Without it, sends are skipped with a warning — the in-app notification
 * center and WhatsApp channels keep working.
 */
import type { CustomerPushPayload } from '@/lib/push/customer-push'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let messagingPromise: Promise<any | null> | null = null

function getMessaging() {
  if (!messagingPromise) {
    messagingPromise = (async () => {
      const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
      if (!raw) {
        console.warn('[fcm] FIREBASE_SERVICE_ACCOUNT_JSON not set — native push disabled')
        return null
      }
      try {
        const admin = await import('firebase-admin')
        if (!admin.apps.length) {
          admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) })
        }
        return admin.messaging()
      } catch (err) {
        console.error('[fcm] init failed:', err)
        return null
      }
    })()
  }
  return messagingPromise
}

const STALE_ERROR_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
])

/**
 * Send a notification to a list of FCM tokens.
 * Returns the tokens FCM reported as dead so callers can prune them.
 */
export async function sendFcmToTokens(
  tokens: string[],
  payload: CustomerPushPayload
): Promise<string[]> {
  if (!tokens.length) return []
  const messaging = await getMessaging()
  if (!messaging) return []

  const response = await messaging.sendEachForMulticast({
    tokens,
    notification: { title: payload.title, body: payload.body },
    data: payload.url ? { url: payload.url } : undefined,
    android: { priority: 'high' as const },
    apns: { payload: { aps: { sound: 'default' } } },
  })

  const stale: string[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  response.responses.forEach((res: any, i: number) => {
    if (!res.success && STALE_ERROR_CODES.has(res.error?.code)) {
      stale.push(tokens[i])
    }
  })
  return stale
}
