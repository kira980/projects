-- WhatsApp notification toggles per business
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS wa_booking_confirmation BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS wa_reminders BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS wa_waitlist BOOLEAN NOT NULL DEFAULT true;
