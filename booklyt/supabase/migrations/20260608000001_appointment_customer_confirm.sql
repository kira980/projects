-- Customer attendance confirmation
-- Allows customers to confirm they will attend their appointment

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS customer_confirmed_at TIMESTAMPTZ;

-- Business setting: allow customers to self-confirm attendance
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS customer_confirmation_enabled BOOLEAN NOT NULL DEFAULT FALSE;
