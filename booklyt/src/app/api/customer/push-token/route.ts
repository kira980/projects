/**
 * POST /api/customer/push-token
 * Register (or refresh) a native push token for the authenticated customer.
 * Replaces the old anonymous /api/mobile/push-token endpoint — tokens are
 * always tied to a bf_user session.
 *
 * Body: { token, platform: 'ios'|'android'|'web', permission?: 'granted'|'denied'|'prompt' }
 * DELETE — remove a token (sign-out / permission revoked): { token }
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import { getCurrentCustomerUser } from '@/lib/customer-auth'

export const dynamic = 'force-dynamic'

const schema = z.object({
  token: z.string().min(10).max(4096),
  platform: z.enum(['ios', 'android', 'web']),
  permission: z.enum(['granted', 'denied', 'prompt']).default('granted'),
})

export async function POST(req: NextRequest) {
  const user = await getCurrentCustomerUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 422 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any
  const now = new Date().toISOString()

  const { error } = await db
    .from('customer_devices')
    .upsert(
      {
        customer_user_id: user.id,
        push_token: parsed.data.token,
        platform: parsed.data.platform,
        notification_permission: parsed.data.permission,
        last_seen: now,
      },
      { onConflict: 'customer_user_id,push_token' }
    )

  if (error) {
    console.error('[push-token] upsert failed:', error)
    return NextResponse.json({ error: 'Failed to save token' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

const deleteSchema = z.object({ token: z.string().min(10).max(4096) })

export async function DELETE(req: NextRequest) {
  const user = await getCurrentCustomerUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const parsed = deleteSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 422 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any
  await db
    .from('customer_devices')
    .delete()
    .eq('customer_user_id', user.id)
    .eq('push_token', parsed.data.token)

  return NextResponse.json({ ok: true })
}
