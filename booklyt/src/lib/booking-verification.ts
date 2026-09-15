/**
 * Booking verification policy.
 *
 * Production runs `otp` (WhatsApp one-time passcode) or `link` (WhatsApp
 * confirmation link) per business, configured in the dashboard and stored on
 * `businesses.booking_verification_method`.
 *
 * This public showcase build ships with verification disabled so the booking
 * flow can be explored end-to-end without a WhatsApp Business account: every
 * reservation is created immediately, with no phone verification step.
 *
 * Set NEXT_PUBLIC_BOOKING_VERIFICATION_ENABLED=true to restore the per-business
 * production behaviour — no other code changes are required.
 */
export type BookingVerificationMethod = 'none' | 'otp' | 'link'

export const BOOKING_VERIFICATION_ENABLED =
  process.env.NEXT_PUBLIC_BOOKING_VERIFICATION_ENABLED === 'true'

export function resolveVerificationMethod(
  businessMethod?: string | null
): BookingVerificationMethod {
  if (!BOOKING_VERIFICATION_ENABLED) return 'none'
  return (businessMethod as BookingVerificationMethod | null) ?? 'otp'
}
