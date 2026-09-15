-- Add preferred time-of-day eras to waitlist entries (morning / noon / evening)
ALTER TABLE public.waitlist_entries
  ADD COLUMN IF NOT EXISTS preferred_eras TEXT[] NOT NULL DEFAULT '{}';
