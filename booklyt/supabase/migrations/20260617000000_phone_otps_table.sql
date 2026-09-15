-- OTP codes for phone verification (WhatsApp-delivered via Twilio)
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
