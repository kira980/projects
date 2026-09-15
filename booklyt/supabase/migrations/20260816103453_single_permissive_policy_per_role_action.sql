-- One permissive policy per (role, action) — linter 0006.
--
-- Postgres OR-s together every permissive policy matching a given role+action,
-- evaluating each one. Doing the OR inside a single predicate instead means one
-- policy per role per action. Semantics are unchanged in every case below.
--
-- The `services` block was applied to the live project by hand ahead of the
-- rest; it is included here (drop-if-exists + create, so it is replayable) so a
-- fresh environment built from these migrations ends up in the same state.

-- ── services: owners must still see INACTIVE services ────────────────────────
drop policy if exists "services: owner all"            on public.services;
drop policy if exists "services: public select active" on public.services;
drop policy if exists "services: anon read"            on public.services;
drop policy if exists "services: authenticated read"   on public.services;
drop policy if exists "services: owner write"          on public.services;
drop policy if exists "services: owner update"         on public.services;
drop policy if exists "services: owner delete"         on public.services;

create policy "services: anon read" on public.services
  for select to anon using (active = true);

create policy "services: authenticated read" on public.services
  for select to authenticated
  using (
    active = true
    or business_id in (select id from public.businesses where owner_id = (select auth.uid()))
  );

create policy "services: owner write" on public.services
  for insert to authenticated
  with check (business_id in (select id from public.businesses where owner_id = (select auth.uid())));
create policy "services: owner update" on public.services
  for update to authenticated
  using      (business_id in (select id from public.businesses where owner_id = (select auth.uid())))
  with check (business_id in (select id from public.businesses where owner_id = (select auth.uid())));
create policy "services: owner delete" on public.services
  for delete to authenticated
  using (business_id in (select id from public.businesses where owner_id = (select auth.uid())));

-- ── staff_members: owners must still see INACTIVE staff ──────────────────────
drop policy if exists "staff: owner all"            on public.staff_members;
drop policy if exists "staff: public select active" on public.staff_members;

create policy "staff: anon read" on public.staff_members
  for select to anon using (active = true);

create policy "staff: authenticated read" on public.staff_members
  for select to authenticated
  using (
    active = true
    or business_id in (select id from public.businesses where owner_id = (select auth.uid()))
  );

create policy "staff: owner insert" on public.staff_members
  for insert to authenticated
  with check (business_id in (select id from public.businesses where owner_id = (select auth.uid())));
create policy "staff: owner update" on public.staff_members
  for update to authenticated
  using      (business_id in (select id from public.businesses where owner_id = (select auth.uid())))
  with check (business_id in (select id from public.businesses where owner_id = (select auth.uid())));
create policy "staff: owner delete" on public.staff_members
  for delete to authenticated
  using (business_id in (select id from public.businesses where owner_id = (select auth.uid())));

-- ── working_hours: public predicate is `true`, so one read policy covers all ─
drop policy if exists "hours: owner all"     on public.working_hours;
drop policy if exists "hours: public select" on public.working_hours;

create policy "hours: read" on public.working_hours
  for select to anon, authenticated using (true);

create policy "hours: owner insert" on public.working_hours
  for insert to authenticated
  with check (business_id in (select id from public.businesses where owner_id = (select auth.uid())));
create policy "hours: owner update" on public.working_hours
  for update to authenticated
  using      (business_id in (select id from public.businesses where owner_id = (select auth.uid())))
  with check (business_id in (select id from public.businesses where owner_id = (select auth.uid())));
create policy "hours: owner delete" on public.working_hours
  for delete to authenticated
  using (business_id in (select id from public.businesses where owner_id = (select auth.uid())));

-- ── working_hour_breaks: same, public predicate is `true` ────────────────────
drop policy if exists "Business owners can manage their working hour breaks" on public.working_hour_breaks;
drop policy if exists "Public can read working hour breaks"                  on public.working_hour_breaks;

create policy "breaks: read" on public.working_hour_breaks
  for select to anon, authenticated using (true);

create policy "breaks: owner insert" on public.working_hour_breaks
  for insert to authenticated
  with check (business_id in (select id from public.businesses where owner_id = (select auth.uid())));
create policy "breaks: owner update" on public.working_hour_breaks
  for update to authenticated
  using      (business_id in (select id from public.businesses where owner_id = (select auth.uid())))
  with check (business_id in (select id from public.businesses where owner_id = (select auth.uid())));
create policy "breaks: owner delete" on public.working_hour_breaks
  for delete to authenticated
  using (business_id in (select id from public.businesses where owner_id = (select auth.uid())));

-- ── tenant_experience_configs ────────────────────────────────────────────────
-- NOTE: owners must read their own row even when is_published = false —
-- getTenantConfig() (used by the builder's GET) selects with the RLS client and
-- does NOT filter on is_published. Hence the OR branch rather than a plain
-- `is_published = true` read policy, which would break the builder for any
-- business that has not published yet.
drop policy if exists "Business owners can manage their config" on public.tenant_experience_configs;
drop policy if exists "Public can read published configs"       on public.tenant_experience_configs;

create policy "config: anon read published" on public.tenant_experience_configs
  for select to anon using (is_published = true);

create policy "config: authenticated read" on public.tenant_experience_configs
  for select to authenticated
  using (
    is_published = true
    or business_id in (select id from public.businesses where owner_id = (select auth.uid()))
  );

create policy "config: owner insert" on public.tenant_experience_configs
  for insert to authenticated
  with check (business_id in (select id from public.businesses where owner_id = (select auth.uid())));
create policy "config: owner update" on public.tenant_experience_configs
  for update to authenticated
  using      (business_id in (select id from public.businesses where owner_id = (select auth.uid())))
  with check (business_id in (select id from public.businesses where owner_id = (select auth.uid())));
create policy "config: owner delete" on public.tenant_experience_configs
  for delete to authenticated
  using (business_id in (select id from public.businesses where owner_id = (select auth.uid())));

notify pgrst, 'reload schema';
