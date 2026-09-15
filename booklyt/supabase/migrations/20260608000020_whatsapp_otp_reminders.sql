-- OTP codes for phone verification (WhatsApp-delivered)
CREATE TABLE IF NOT EXISTS public.phone_otps (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone      TEXT NOT NULL,
  code       TEXT NOT NULL,
  purpose    TEXT NOT NULL DEFAULT 'register' CHECK (purpose IN ('register', 'login', 'booking')),
  used_at    TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_phone_otps_phone ON public.phone_otps(phone);

ALTER TABLE public.phone_otps ENABLE ROW LEVEL SECURITY;
-- All OTP reads/writes go through service-role API routes; no user-facing policies needed.

-- Auto-cleanup: delete used/expired OTPs after 1 hour
CREATE OR REPLACE FUNCTION cleanup_expired_otps() RETURNS void LANGUAGE sql AS $$
  DELETE FROM public.phone_otps
  WHERE expires_at < now() - INTERVAL '1 hour';
$$;

-- Track WhatsApp reminder so we don't double-send
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS wa_reminder_sent_at TIMESTAMPTZ;

-- Track customer phone for WhatsApp on appointments (denormalised for speed)
-- The booking flow already stores customer_phone, so this is a no-op if column exists.
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS customer_phone TEXT;
