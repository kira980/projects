-- Business active/deactivate toggle
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;
