-- Stage 1: businesses + admin profiles.
-- Every business-owned table in later migrations carries business_id
-- so the system can serve multiple businesses in the future.

create extension if not exists pgcrypto;

-- Shared trigger for updated_at columns.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.businesses (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone       text,
  address     text,
  logo_url    text,
  settings    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger businesses_updated_at
  before update on public.businesses
  for each row execute function public.set_updated_at();

-- Admin / manager users (Supabase Auth). Workers and drivers use
-- passcodes and live in a separate `workers` table (Stage 2).
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  full_name   text not null,
  role        text not null default 'admin' check (role in ('admin', 'manager')),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index profiles_business_id_idx on public.profiles (business_id);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Returns the business of the currently authenticated admin user.
-- security definer so RLS policies can call it without recursing into
-- the profiles policy.
create or replace function public.current_business_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select business_id from public.profiles
  where id = auth.uid() and is_active
$$;

alter table public.businesses enable row level security;
alter table public.profiles enable row level security;

create policy "members read own business"
  on public.businesses for select
  using (id = public.current_business_id());

create policy "admins update own business"
  on public.businesses for update
  using (id = public.current_business_id());

create policy "users read own profile"
  on public.profiles for select
  using (id = auth.uid());

create policy "members read business profiles"
  on public.profiles for select
  using (business_id = public.current_business_id());
