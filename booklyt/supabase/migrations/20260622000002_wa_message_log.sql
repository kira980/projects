-- Track outgoing WhatsApp messages per business
CREATE TABLE IF NOT EXISTS public.wa_message_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  message_type TEXT NOT NULL CHECK (message_type IN ('auth', 'booking_confirmation', 'reminder', 'waitlist', 'verification_link')),
  recipient_phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_message_log_business ON public.wa_message_log(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_message_log_type ON public.wa_message_log(business_id, message_type);

ALTER TABLE public.wa_message_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business owners can read their own message logs"
  ON public.wa_message_log FOR SELECT
  USING (business_id IN (
    SELECT id FROM public.businesses WHERE owner_id = auth.uid()
  ));
