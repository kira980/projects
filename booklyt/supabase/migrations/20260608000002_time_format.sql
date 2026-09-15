-- Add time display format preference to businesses
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS time_format TEXT NOT NULL DEFAULT '12h';
