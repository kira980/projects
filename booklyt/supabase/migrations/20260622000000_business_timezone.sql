-- Add timezone column to businesses (defaults to Asia/Jerusalem for existing rows)
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Asia/Jerusalem';
