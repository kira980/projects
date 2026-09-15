/**
 * Native push delivery to a customer's registered devices (customer_devices).
 * FCM wiring lands with the mobile phase; until FIREBASE_SERVICE_ACCOUNT_JSON
 * is configured this is a structured no-op so notifyCustomer stays safe to call.
 */
import { createServiceClient } from '@/lib/supabase/service'

export interface CustomerPushPayload {
  title: string
  body: string
  url?: string
}

export async function sendPushToCustomerDevices(
  customerUserId: string,
  payload: CustomerPushPayload
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any

  const { data: devices } = await db
    .from('customer_devices')
    .select('id, push_token, platform')
    .eq('customer_user_id', customerUserId)
    .eq('notification_permission', 'granted') as {
      data: { id: string; push_token: string; platform: string }[] | null
    }

  if (!devices?.length) return

  const { sendFcmToTokens } = await import('@/lib/push/firebase')
  const staleTokens = await sendFcmToTokens(
    devices.map((d) => d.push_token),
    payload
  )

  // Prune tokens FCM reports as dead
  if (staleTokens.length) {
    await db
      .from('customer_devices')
      .delete()
      .eq('customer_user_id', customerUserId)
      .in('push_token', staleTokens)
  }
}
