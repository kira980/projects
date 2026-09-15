/**
 * POST /api/dashboard/announcements
 * Business-owner (Supabase auth) announcement broadcast.
 * Recipients are computed server-side from customer_businesses only
 * (customers who interacted with THIS business and kept notifications on).
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { sendBusinessAnnouncement } from '@/lib/notifications/customer'

const schema = z.object({
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(500),
})

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: business } = await (supabase as any)
    .from('businesses')
    .select('id, name')
    .eq('owner_id', user.id)
    .single() as { data: { id: string; name: string } | null }

  if (!business) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 })
  }

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 422 })

  const result = await sendBusinessAnnouncement(business.id, business.name, parsed.data.title, parsed.data.body)
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json({ ok: true, recipient_count: result.recipientCount })
}
