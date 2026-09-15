-- One website per account: enforce at the database level.
-- Any attempt to INSERT a second business for the same owner_id will fail with a
-- unique-constraint violation (code 23505), which the application handles gracefully
-- by redirecting the user to their existing dashboard.
ALTER TABLE public.businesses
  DROP CONSTRAINT IF EXISTS businesses_one_per_owner;

ALTER TABLE public.businesses
  ADD CONSTRAINT businesses_one_per_owner UNIQUE (owner_id);
