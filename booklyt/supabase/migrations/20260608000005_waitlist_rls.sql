-- Allow anyone (including unauthenticated booking page visitors) to add themselves
-- to the waitlist. The business_id / service_id are validated by the API route
-- before the insert reaches the DB.
CREATE POLICY "public_insert_waitlist"
  ON public.waitlist_entries
  FOR INSERT
  WITH CHECK (true);
