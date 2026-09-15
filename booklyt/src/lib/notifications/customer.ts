/**
 * Customer notification choke-point.
 * Every customer-facing notification goes through notifyCustomer(): it writes
 * the in-app notification-center row, then fans out to native push devices.
 *
 * Anti-spam invariant: announcement recipients are ALWAYS computed here from
 * customer_businesses (notifications_enabled = true) — callers never supply
 * recipient lists.
 */
import { createServiceClient } from '@/lib/supabase/service'
import { sendPushToCustomerDevices } from '@/lib/push/customer-push'

export type CustomerNotificationType =
  | 'booking_confirmed'
  | 'booking_reminder'
  | 'booking_cancelled'
  | 'booking_changed'
  | 'waitlist'
  | 'announcement'
  | 'rebooking'

export interface CustomerNotificationInput {
  type: CustomerNotificationType
  title: string
  body: string
  businessId?: string | null
  url?: string | null
}

/** Insert an in-app notification + push to the customer's devices. */
export async function notifyCustomer(
  customerUserId: string,
  input: CustomerNotificationInput
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any

  const { error } = await db.from('customer_notifications').insert({
    customer_user_id: customerUserId,
    business_id: input.businessId ?? null,
    type: input.type,
    title: input.title,
    body: input.body,
    url: input.url ?? null,
  })
  if (error) {
    console.error('[notifyCustomer] insert failed:', error)
  }

  try {
    await sendPushToCustomerDevices(customerUserId, {
      title: input.title,
      body: input.body,
      url: input.url ?? undefined,
    })
  } catch (pushError) {
    console.error('[notifyCustomer] push fan-out failed:', pushError)
  }
}

/**
 * Broadcast a business announcement to every customer who has interacted with
 * the business AND still has notifications enabled for it. Recipients are
 * derived here — there is no way to target anyone else.
 *
 * Rate limit: one announcement per business per 24h.
 * Returns the recipient count, or an error string.
 */
export async function sendBusinessAnnouncement(
  businessId: string,
  businessName: string,
  title: string,
  body: string
): Promise<{ recipientCount: number } | { error: string; status: number }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any

  // Rate limit: 1 per 24h
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: recent } = await db
    .from('business_announcements')
    .select('id')
    .eq('business_id', businessId)
    .gte('sent_at', dayAgo)
    .limit(1)

  if (recent?.length) {
    return { error: 'You can send one announcement per 24 hours.', status: 429 }
  }

  const { data: recipients } = await db
    .from('customer_businesses')
    .select('customer_user_id')
    .eq('business_id', businessId)
    .eq('notifications_enabled', true) as { data: { customer_user_id: string }[] | null }

  const ids = [...new Set((recipients ?? []).map((r) => r.customer_user_id))]

  await db.from('business_announcements').insert({
    business_id: businessId,
    title,
    body,
    sent_at: new Date().toISOString(),
    recipient_count: ids.length,
  })

  for (const customerUserId of ids) {
    await notifyCustomer(customerUserId, {
      type: 'announcement',
      title: `${businessName}: ${title}`,
      body,
      businessId,
    })
  }

  return { recipientCount: ids.length }
}
