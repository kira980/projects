import bcrypt from 'bcryptjs'
import { createHash, randomBytes } from 'crypto'
import { createServiceClient } from '@/lib/supabase/service'
import { cookies } from 'next/headers'

// ─── Constants ────────────────────────────────────────────────────────────────

export const CUSTOMER_AUTH_COOKIE = 'bf_user'
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 365 // 1 year

export interface CustomerUser {
  id: string
  phone: string
  full_name: string | null
}

// ─── Password ─────────────────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

// ─── Session tokens ───────────────────────────────────────────────────────────

export function generateSessionToken(): string {
  return randomBytes(32).toString('hex')
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function sessionExpiresAt(): string {
  return new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000).toISOString()
}

// ─── Session management ───────────────────────────────────────────────────────

export async function createSession(customerUserId: string, userAgent?: string): Promise<string> {
  const token = generateSessionToken()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any
  const { error } = await service.from('customer_user_sessions').insert({
    customer_user_id: customerUserId,
    token_hash: hashSessionToken(token),
    user_agent: userAgent ?? null,
    expires_at: sessionExpiresAt(),
  })
  if (error) throw new Error(`Session creation failed: ${error.message}`)
  return token
}

export async function getUserFromToken(token: string): Promise<CustomerUser | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any
  const now = new Date().toISOString()

  const { data } = await service
    .from('customer_user_sessions')
    .select('expires_at, customer_users(id, phone, full_name)')
    .eq('token_hash', hashSessionToken(token))
    .gt('expires_at', now)
    .maybeSingle()

  if (!data?.customer_users) return null
  return data.customer_users as CustomerUser
}

export async function deleteSession(token: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any
  await service
    .from('customer_user_sessions')
    .delete()
    .eq('token_hash', hashSessionToken(token))
}

// ─── Cookie helpers (server-side only) ───────────────────────────────────────

export function sessionCookieOptions(maxAge: number = SESSION_MAX_AGE_SECONDS) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    maxAge,
    path: '/',
  }
}

/** Read the current customer user from the request cookie store. Returns null if not authenticated. */
export async function getCurrentCustomerUser(): Promise<CustomerUser | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(CUSTOMER_AUTH_COOKIE)?.value
    if (!token) return null
    return getUserFromToken(token)
  } catch {
    return null
  }
}

// ─── Phone normalisation ──────────────────────────────────────────────────────

/** Strip spaces/dashes; ensure consistent storage. Does NOT force E.164 — keep simple for now. */
export function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-().]/g, '')
}
