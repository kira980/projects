-- ─────────────────────────────────────────────────────────────────────────────
-- Service categories + per-staff service assignment.
--
--  * service_categories  — owner-defined groupings ("Haircuts", "Colour", …).
--    Services point at one optionally; deleting a category leaves its services
--    uncategorised rather than deleting them.
--  * staff_services      — which team members perform which service. An EMPTY
--    set for a staff member means "performs everything", so existing businesses
--    keep working without backfilling a row per staff member per service.
-- ─────────────────────────────────────────────────────────────────────────────

-- Older installations do not necessarily have the helper from schema.sql.
-- Define it here before creating a trigger that depends on it.
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

create table if not exists public.service_categories (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name        text not null,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists service_categories_business_id_idx
  on public.service_categories(business_id);

drop trigger if exists service_categories_updated_at on public.service_categories;
create trigger service_categories_updated_at
  before update on public.service_categories
  for each row execute function public.handle_updated_at();

alter table public.services
  add column if not exists category_id uuid references public.service_categories(id) on delete set null;

create index if not exists services_category_id_idx on public.services(category_id);

create table if not exists public.staff_services (
  staff_member_id uuid not null references public.staff_members(id) on delete cascade,
  service_id      uuid not null references public.services(id)      on delete cascade,
  created_at      timestamptz not null default now(),
  primary key (staff_member_id, service_id)
);

create index if not exists staff_services_service_id_idx on public.staff_services(service_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.service_categories enable row level security;
alter table public.staff_services      enable row level security;

-- Categories are public reference data for the booking page; owners write.
drop policy if exists "service_categories: read"        on public.service_categories;
drop policy if exists "service_categories: owner write" on public.service_categories;
drop policy if exists "service_categories: owner update" on public.service_categories;
drop policy if exists "service_categories: owner delete" on public.service_categories;

create policy "service_categories: read" on public.service_categories
  for select to anon, authenticated using (true);

create policy "service_categories: owner write" on public.service_categories
  for insert to authenticated
  with check (business_id in (select id from public.businesses where owner_id = (select auth.uid())));

create policy "service_categories: owner update" on public.service_categories
  for update to authenticated
  using      (business_id in (select id from public.businesses where owner_id = (select auth.uid())))
  with check (business_id in (select id from public.businesses where owner_id = (select auth.uid())));

create policy "service_categories: owner delete" on public.service_categories
  for delete to authenticated
  using (business_id in (select id from public.businesses where owner_id = (select auth.uid())));

-- staff_services carries no business_id, so ownership is checked through the
-- staff member it belongs to.
drop policy if exists "staff_services: read"         on public.staff_services;
drop policy if exists "staff_services: owner write"  on public.staff_services;
drop policy if exists "staff_services: owner delete" on public.staff_services;

create policy "staff_services: read" on public.staff_services
  for select to anon, authenticated using (true);

create policy "staff_services: owner write" on public.staff_services
  for insert to authenticated
  with check (
    staff_member_id in (
      select s.id from public.staff_members s
      where s.business_id in (select id from public.businesses where owner_id = (select auth.uid()))
    )
  );

create policy "staff_services: owner delete" on public.staff_services
  for delete to authenticated
  using (
    staff_member_id in (
      select s.id from public.staff_members s
      where s.business_id in (select id from public.businesses where owner_id = (select auth.uid()))
    )
  );
