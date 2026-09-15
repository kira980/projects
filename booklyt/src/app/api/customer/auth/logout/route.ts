import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { deleteSession, CUSTOMER_AUTH_COOKIE } from '@/lib/customer-auth'

export async function POST() {
  const cookieStore = await cookies()
  const token = cookieStore.get(CUSTOMER_AUTH_COOKIE)?.value

  if (token) {
    await deleteSession(token)
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(CUSTOMER_AUTH_COOKIE, '', { maxAge: 0, path: '/' })
  return res
}
