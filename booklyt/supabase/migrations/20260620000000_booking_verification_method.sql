-- Business setting: how customers verify identity when booking (OTP code, confirmation link, or none)
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS booking_verification_method TEXT NOT NULL DEFAULT 'otp';

-- Drop old constraint (if any) and add updated one that includes 'none'
ALTER TABLE public.businesses
  DROP CONSTRAINT IF EXISTS businesses_booking_verification_method_check;

ALTER TABLE public.businesses
  ADD CONSTRAINT businesses_booking_verification_method_check
  CHECK (booking_verification_method IN ('otp', 'link', 'none'));
