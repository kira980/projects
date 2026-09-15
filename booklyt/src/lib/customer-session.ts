import { createHash, randomBytes } from "crypto"

export const CUSTOMER_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 180

export function getCustomerSessionCookieName(businessId: string) {
  return `bf_customer_${businessId.replace(/-/g, "")}`
}

export function getCustomerManageCookieName(businessId: string) {
  return `bf_manage_${businessId.replace(/-/g, "")}`
}

export function createCustomerSessionToken() {
  return randomBytes(32).toString("hex")
}

export function hashCustomerSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

export function customerSessionExpiresAt() {
  return new Date(Date.now() + CUSTOMER_SESSION_MAX_AGE_SECONDS * 1000).toISOString()
}
