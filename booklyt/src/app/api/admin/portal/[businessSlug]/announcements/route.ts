/**
 * POST /api/admin/portal/[businessSlug]/announcements
 * Admin-portal (HMAC cookie) announcement broadcast — same structural
 * anti-spam guarantees as the dashboard route.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminVerifiedBusiness } from '@/lib/admin-business'
import { sendBusinessAnnouncement } from '@/lib/notifications/customer'

const schema = z.object({
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(500),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ businessSlug: string }> }
) {
  const { businessSlug } = await params
  const { business } = await getAdminVerifiedBusiness(businessSlug)
  if (!business) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
