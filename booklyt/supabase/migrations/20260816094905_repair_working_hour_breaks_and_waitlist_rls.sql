-- Repair: policies from 20260604000000_working_hour_breaks.sql and
-- 20260608000005_waitlist_rls.sql never applied to the live project.
-- Impact: working_hour_breaks had RLS on with zero policies, so the owner's
-- hours screen (browser client) could neither read nor write breaks, and
-- /api/slots saw zero breaks -> customers could book during breaks.

alter table public.working_hour_breaks enable row level security;

drop policy if exists "Business owners can manage their working hour breaks" on public.working_hour_breaks;
drop policy if exists "Public can read working hour breaks"                  on public.working_hour_breaks;

create policy "Public can read working hour breaks"
  on public.working_hour_breaks
  for select
  using (true);

create policy "Business owners can manage their working hour breaks"
  on public.working_hour_breaks
  for all
  to authenticated
  using (
    business_id in (select id from public.businesses where owner_id = auth.uid())
  )
  with check (
    business_id in (select id from public.businesses where owner_id = auth.uid())
  );

-- waitlist_entries: public booking form inserts go through the service role
-- today, so this matches the repo's declared intent.
drop policy if exists "public_insert_waitlist" on public.waitlist_entries;

create policy "public_insert_waitlist"
  on public.waitlist_entries
  for insert
  with check (true);

notify pgrst, 'reload schema';
