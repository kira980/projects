import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import {
  verifyPassword,
  createSession,
  normalizePhone,
  CUSTOMER_AUTH_COOKIE,
  sessionCookieOptions,
} from '@/lib/customer-auth'

const schema = z.object({
  phone: z.string().min(7).max(20),
  password: z.string().min(1).max(72),
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

  const { phone: rawPhone, password } = parsed.data
  const phone = normalizePhone(rawPhone)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any

  const { data: user } = await service
    .from('customer_users')
    .select('id, phone, full_name, password_hash')
    .eq('phone', phone)
    .maybeSingle()

  // Constant-time: always verify even if user not found, then reject
  const dummyHash = '$2a$12$invalidhashfortimingprotectiononly000000000000000000000'
  const ok = user
    ? await verifyPassword(password, user.password_hash)
    : await verifyPassword(password, dummyHash).then(() => false)

  if (!ok) {
    return NextResponse.json({ error: 'Invalid phone or password' }, { status: 401 })
  }

  const token = await createSession(user.id, req.headers.get('user-agent') ?? undefined)

  const res = NextResponse.json({
    user: { id: user.id, phone: user.phone, full_name: user.full_name },
  })
  res.cookies.set(CUSTOMER_AUTH_COOKIE, token, sessionCookieOptions())
  return res
}
