-- Device push tokens for native mobile (FCM / APNs)
CREATE TABLE IF NOT EXISTS public.device_push_tokens (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token             TEXT NOT NULL UNIQUE,
  platform          TEXT NOT NULL CHECK (platform IN ('fcm', 'apns')),
  waitlist_entry_id UUID REFERENCES public.waitlist_entries(id) ON DELETE SET NULL,
  business_id       UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dpt_waitlist ON public.device_push_tokens(waitlist_entry_id);
CREATE INDEX IF NOT EXISTS idx_dpt_business ON public.device_push_tokens(business_id);

ALTER TABLE public.device_push_tokens ENABLE ROW LEVEL SECURITY;
-- All writes go through the service-role API, so no user-facing policies needed.

-- Add notify_token to appointments so we can send the customer a push reminder
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS notify_token TEXT;
