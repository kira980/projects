import { createHmac, timingSafeEqual } from "crypto"

const MAX_AGE_SECONDS = 60 * 60 * 24 * 30

function getSecret() {
  return (
    process.env.ADMIN_SESSION_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "development-admin-session-secret"
  )
}

export function getAdminCookieName(businessId: string) {
  return `bf_admin_${businessId.replace(/-/g, "")}`
}

export function signAdminSession(businessId: string) {
  const expires = Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS
  const payload = `${businessId}.${expires}`
  const signature = createHmac("sha256", getSecret()).update(payload).digest("hex")

  return `${payload}.${signature}`
}

export function verifyAdminSession(cookieValue: string | undefined, businessId: string) {
  if (!cookieValue) return false

  const [signedBusinessId, expiresRaw, signature] = cookieValue.split(".")
  if (!signedBusinessId || !expiresRaw || !signature || signedBusinessId !== businessId) return false

  const expires = Number(expiresRaw)
  if (!Number.isFinite(expires) || expires < Math.floor(Date.now() / 1000)) return false

  const payload = `${signedBusinessId}.${expiresRaw}`
  const expected = createHmac("sha256", getSecret()).update(payload).digest("hex")
  const actualBuffer = Buffer.from(signature, "hex")
  const expectedBuffer = Buffer.from(expected, "hex")

  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
}

export const adminSessionMaxAge = MAX_AGE_SECONDS
