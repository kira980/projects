-- Wrap auth.uid() in a scalar subquery so Postgres evaluates it once per query
-- instead of once per row (linter 0003). Semantics are identical.

-- ── profiles ─────────────────────────────────────────────────────────────────
drop policy if exists "profiles: owner select" on public.profiles;
drop policy if exists "profiles: owner insert" on public.profiles;
drop policy if exists "profiles: owner update" on public.profiles;

create policy "profiles: owner select" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "profiles: owner insert" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);
create policy "profiles: owner update" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- ── businesses ───────────────────────────────────────────────────────────────
drop policy if exists "businesses: owner insert" on public.businesses;
drop policy if exists "businesses: owner update" on public.businesses;
drop policy if exists "businesses: owner delete" on public.businesses;

create policy "businesses: owner insert" on public.businesses
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "businesses: owner update" on public.businesses
  for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "businesses: owner delete" on public.businesses
  for delete to authenticated using (owner_id = (select auth.uid()));

-- ── child tables scoped through businesses ───────────────────────────────────
drop policy if exists "services: owner all"     on public.services;
create policy "services: owner all" on public.services
  for all to authenticated
  using      (business_id in (select id from public.businesses where owner_id = (select auth.uid())))
  with check (business_id in (select id from public.businesses where owner_id = (select auth.uid())));

drop policy if exists "staff: owner all"        on public.staff_members;
create policy "staff: owner all" on public.staff_members
  for all to authenticated
  using      (business_id in (select id from public.businesses where owner_id = (select auth.uid())))
  with check (business_id in (select id from public.businesses where owner_id = (select auth.uid())));

drop policy if exists "hours: owner all"        on public.working_hours;
create policy "hours: owner all" on public.working_hours
  for all to authenticated
  using      (business_id in (select id from public.businesses where owner_id = (select auth.uid())))
  with check (business_id in (select id from public.businesses where owner_id = (select auth.uid())));

drop policy if exists "customers: owner all"    on public.customers;
create policy "customers: owner all" on public.customers
  for all to authenticated
  using      (business_id in (select id from public.businesses where owner_id = (select auth.uid())))
  with check (business_id in (select id from public.businesses where owner_id = (select auth.uid())));

drop policy if exists "appointments: owner all" on public.appointments;
create policy "appointments: owner all" on public.appointments
  for all to authenticated
  using      (business_id in (select id from public.businesses where owner_id = (select auth.uid())))
  with check (business_id in (select id from public.businesses where owner_id = (select auth.uid())));

drop policy if exists "Business owners can manage their config" on public.tenant_experience_configs;
create policy "Business owners can manage their config" on public.tenant_experience_configs
  for all to authenticated
  using      (business_id in (select id from public.businesses where owner_id = (select auth.uid())))
  with check (business_id in (select id from public.businesses where owner_id = (select auth.uid())));

drop policy if exists "Business owners can manage their working hour breaks" on public.working_hour_breaks;
create policy "Business owners can manage their working hour breaks" on public.working_hour_breaks
  for all to authenticated
  using      (business_id in (select id from public.businesses where owner_id = (select auth.uid())))
  with check (business_id in (select id from public.businesses where owner_id = (select auth.uid())));

notify pgrst, 'reload schema';
