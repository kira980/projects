import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import {
  hashPassword,
  createSession,
  normalizePhone,
  CUSTOMER_AUTH_COOKIE,
  sessionCookieOptions,
} from '@/lib/customer-auth'

const schema = z.object({
  phone: z.string().min(7).max(20),
  password: z.string().min(8).max(72),
  full_name: z.string().min(1).max(120).optional(),
})

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 422 })
  }

  const { phone: rawPhone, password, full_name } = parsed.data
  const phone = normalizePhone(rawPhone)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any

  // Check if phone already registered
  const { data: existing } = await service
    .from('customer_users')
    .select('id')
    .eq('phone', phone)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Phone already registered' }, { status: 409 })
  }

  const password_hash = await hashPassword(password)

  const { data: user, error } = await service
    .from('customer_users')
    .insert({ phone, password_hash, full_name: full_name ?? null })
    .select('id, phone, full_name')
    .single()

  if (error) {
    console.error('[customer/auth/register]', error)
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 })
  }

  const token = await createSession(user.id, req.headers.get('user-agent') ?? undefined)

  const res = NextResponse.json({
    user: { id: user.id, phone: user.phone, full_name: user.full_name },
  })
  res.cookies.set(CUSTOMER_AUTH_COOKIE, token, sessionCookieOptions())
  return res
}
