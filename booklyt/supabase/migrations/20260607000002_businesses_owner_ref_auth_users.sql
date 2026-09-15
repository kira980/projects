-- businesses.owner_id previously referenced profiles(id), which depends on a
-- trigger to create the profiles row on signup. If that trigger is missing the
-- business insert fails with a FK violation and the user is stuck in onboarding.
--
-- Fix: point owner_id directly at auth.users(id). auth.users always has a row
-- the moment the user signs up — no trigger required.

ALTER TABLE public.businesses
  DROP CONSTRAINT IF EXISTS businesses_owner_id_fkey;

ALTER TABLE public.businesses
  ADD CONSTRAINT businesses_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
