/**
 * Customer notification center.
 * GET   — list latest notifications (+ unread count). ?unread_count=1 for badge only.
 * PATCH — mark read: { ids: [...] } or { all: true }.
 * Session-required; scoped by customer_user_id.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import { getCurrentCustomerUser } from '@/lib/customer-auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = await getCurrentCustomerUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any

  const { count: unreadCount } = await db
    .from('customer_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('customer_user_id', user.id)
    .is('read_at', null)

  if (req.nextUrl.searchParams.get('unread_count') === '1') {
    return NextResponse.json({ unread: unreadCount ?? 0 })
  }

  const { data: notifications } = await db
    .from('customer_notifications')
    .select('id, business_id, type, title, body, url, read_at, created_at, businesses(name, slug, logo_url)')
    .eq('customer_user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  return NextResponse.json({ notifications: notifications ?? [], unread: unreadCount ?? 0 })
}

const patchSchema = z.object({
  ids: z.array(z.string().uuid()).max(100).optional(),
  all: z.boolean().optional(),
}).refine((v) => v.all || v.ids?.length, { message: 'ids or all required' })

export async function PATCH(req: NextRequest) {
  const user = await getCurrentCustomerUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 422 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any
  let query = db
    .from('customer_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('customer_user_id', user.id)
    .is('read_at', null)

  if (!parsed.data.all) {
    query = query.in('id', parsed.data.ids!)
  }

  const { error } = await query
  if (error) {
    console.error('[customer/notifications] mark read failed:', error)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
