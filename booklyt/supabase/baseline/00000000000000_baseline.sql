-- ═════════════════════════════════════════════════════════════════════════════
-- Booklyt — consolidated baseline schema
--
-- Builds the entire database and storage layer from nothing: extensions, tables,
-- constraints, indexes, functions, triggers, RLS policies, grants, and the
-- storage bucket. Replaces the 49 incremental migrations in ../migrations.
--
-- Reconciled against BOTH sources of truth:
--   • the live project (xvmudfouyqywpqtcilvp), which is what actually runs, and
--   • the 49 migration files, only 7 of which were ever recorded as applied.
-- Where they disagreed, the discrepancy is called out inline.
--
-- FULLY IDEMPOTENT. Safe to run against an empty project or against the existing
-- live project — on the latter it is a no-op except for the handful of objects
-- the live DB is genuinely missing (noted below with "DRIFT").
--
-- Object names deliberately match the live database so that running this against
-- the existing project produces zero renames.
-- ═════════════════════════════════════════════════════════════════════════════

-- ── Extensions ───────────────────────────────────────────────────────────────
-- On Supabase both of these are pre-installed into the `extensions` schema, so
-- the CREATEs below are no-ops there (IF NOT EXISTS matches on extension name,
-- not schema). They matter only on a plain Postgres.
create extension if not exists "pgcrypto";    -- gen_random_bytes(), crypt()
create extension if not exists "uuid-ossp";

-- waitlist_entries.notify_token defaults to encode(gen_random_bytes(24),'hex'),
-- and gen_random_bytes lives in `extensions` on Supabase. Without this the
-- CREATE TABLE below fails to resolve the function. Harmless elsewhere: a
-- missing schema in search_path is simply skipped.
set search_path = public, extensions;


-- ═════════════════════════════════════════════════════════════════════════════
-- TABLES  (declared in FK dependency order)
-- ═════════════════════════════════════════════════════════════════════════════

-- ── profiles ─────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── businesses ───────────────────────────────────────────────────────────────
-- owner_id is UNIQUE: one business per account. The onboarding wizard relies on
-- the resulting 23505 to redirect a returning owner to their dashboard.
create table if not exists public.businesses (
  id                                uuid primary key default gen_random_uuid(),
  owner_id                          uuid not null unique references auth.users(id) on delete cascade,
  name                              text not null,
  slug                              text not null unique,
  category                          text not null,
  phone                             text,
  address                           text,
  logo_url                          text,
  description                       text,
  created_at                        timestamptz not null default now(),
  updated_at                        timestamptz not null default now(),
  booking_mode                      text not null default 'appointment'
                                      check (booking_mode in ('appointment','group')),
  group_capacity                    integer not null default 1 check (group_capacity >= 1),
  app_name                          text,
  app_icon_url                      text,
  admin_password_hash               text,
  admin_password_salt               text,
  admin_password_updated_at         timestamptz,
  appointments_require_confirmation boolean not null default true,
  language                          text not null default 'en' check (language in ('en','ar')),
  customer_confirmation_enabled     boolean not null default false,
  time_format                       text not null default '12h',
  currency                          varchar default 'USD',
  country_code                      varchar default '972',
  slot_interval                     integer default 30,
  booking_days_ahead                integer,
  booking_verification_method       text not null default 'link'
                                      check (booking_verification_method in ('otp','link','none')),
  timezone                          text not null default 'Asia/Jerusalem',
  wa_booking_confirmation           boolean not null default false,
  wa_reminders                      boolean not null default true,
  wa_waitlist                       boolean not null default true,
  active                            boolean not null default true,
  business_code                     text unique,
  app_enabled                       boolean not null default true
);

-- ── services ─────────────────────────────────────────────────────────────────
create table if not exists public.services (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references public.businesses(id) on delete cascade,
  name             text not null,
  description      text,
  price            numeric not null default 0,
  duration_minutes integer not null default 30,
  image_url        text,
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ── staff_members ────────────────────────────────────────────────────────────
create table if not exists public.staff_members (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name        text not null,
  role        text,
  avatar_url  text,
  bio         text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── working_hours ────────────────────────────────────────────────────────────
create table if not exists public.working_hours (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  is_open     boolean not null default true,
  open_time   time,
  close_time  time,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── working_hour_breaks ──────────────────────────────────────────────────────
create table if not exists public.working_hour_breaks (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  day_of_week integer not null check (day_of_week between 0 and 6),
  start_time  time not null,
  end_time    time not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── customer_users ───────────────────────────────────────────────────────────
-- Marketplace-wide customer identity (phone + bcrypt password). Entirely separate
-- from auth.users, which is for business owners only.
create table if not exists public.customer_users (
  id            uuid primary key default gen_random_uuid(),
  phone         text not null unique,
  password_hash text not null,
  full_name     text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.customer_user_sessions (
  id               uuid primary key default gen_random_uuid(),
  customer_user_id uuid not null references public.customer_users(id) on delete cascade,
  token_hash       text not null unique,
  user_agent       text,
  expires_at       timestamptz not null,
  created_at       timestamptz not null default now()
);

-- ── customers ────────────────────────────────────────────────────────────────
-- Per-business customer record. customer_user_id links it to a marketplace
-- identity when the booker was signed in.
create table if not exists public.customers (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references public.businesses(id) on delete cascade,
  name             text not null,
  phone            text,
  email            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  customer_user_id uuid references public.customer_users(id) on delete set null
);

create table if not exists public.customer_sessions (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses(id) on delete cascade,
  customer_id  uuid not null references public.customers(id) on delete cascade,
  token_hash   text not null unique,
  user_agent   text,
  last_seen_at timestamptz not null default now(),
  expires_at   timestamptz not null,
  created_at   timestamptz not null default now()
);

-- ── customer_businesses ──────────────────────────────────────────────────────
create table if not exists public.customer_businesses (
  id                    uuid primary key default gen_random_uuid(),
  customer_user_id      uuid not null references public.customer_users(id) on delete cascade,
  business_id           uuid not null references public.businesses(id) on delete cascade,
  first_visited_at      timestamptz not null default now(),
  last_visited_at       timestamptz not null default now(),
  visit_count           integer not null default 1,
  favorite              boolean not null default false,
  notifications_enabled boolean not null default true,
  created_at            timestamptz not null default now(),
  unique (customer_user_id, business_id)
);

-- ── customer_devices ─────────────────────────────────────────────────────────
create table if not exists public.customer_devices (
  id                      uuid primary key default gen_random_uuid(),
  customer_user_id        uuid not null references public.customer_users(id) on delete cascade,
  platform                text not null check (platform in ('ios','android','web')),
  push_token              text not null,
  notification_permission text not null default 'prompt'
                            check (notification_permission in ('granted','denied','prompt')),
  last_seen               timestamptz not null default now(),
  created_at              timestamptz not null default now(),
  unique (customer_user_id, push_token)
);

-- ── appointments ─────────────────────────────────────────────────────────────
-- service_id / staff_member_id / customer_id are intentionally NO ACTION: an
-- in-use service or staff member must not be deletable out from under a booking.
create table if not exists public.appointments (
  id                    uuid primary key default gen_random_uuid(),
  business_id           uuid not null references public.businesses(id) on delete cascade,
  service_id            uuid not null references public.services(id),
  staff_member_id       uuid references public.staff_members(id),
  customer_id           uuid references public.customers(id),
  customer_name         text not null,
  customer_phone        text,
  customer_email        text,
  appointment_date      date not null,
  start_time            time not null,
  end_time              time not null,
  status                text not null default 'pending'
                          check (status in ('pending','booked','confirmed','cancelled','completed')),
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  participants_count    integer not null default 1 check (participants_count >= 1),
  manage_token          text unique,
  cancelled_at          timestamptz,
  customer_user_id      uuid references public.customer_users(id) on delete set null,
  customer_confirmed_at timestamptz,
  notify_token          text,
  wa_reminder_sent_at   timestamptz,
  push_reminder_sent_at timestamptz
);

-- ── appointment_events ───────────────────────────────────────────────────────
create table if not exists public.appointment_events (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references public.businesses(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  event_type     text not null
                   check (event_type in ('reservation','cancellation','status_change','reschedule','note')),
  title          text not null,
  description    text,
  metadata       jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);

-- ── customer_notifications ───────────────────────────────────────────────────
create table if not exists public.customer_notifications (
  id               uuid primary key default gen_random_uuid(),
  customer_user_id uuid not null references public.customer_users(id) on delete cascade,
  business_id      uuid references public.businesses(id) on delete set null,
  type             text not null check (type in (
                     'booking_confirmed','booking_reminder','booking_cancelled',
                     'booking_changed','waitlist','announcement','rebooking')),
  title            text not null,
  body             text not null,
  url              text,
  read_at          timestamptz,
  created_at       timestamptz not null default now()
);

-- ── waitlist_entries ─────────────────────────────────────────────────────────
create table if not exists public.waitlist_entries (
  id                 uuid primary key default gen_random_uuid(),
  business_id        uuid not null references public.businesses(id) on delete cascade,
  service_id         uuid not null references public.services(id) on delete cascade,
  staff_member_id    uuid references public.staff_members(id) on delete set null,
  customer_name      text not null,
  customer_email     text,
  customer_phone     text,
  preferred_date     date not null,
  participants_count integer not null default 1 check (participants_count >= 1),
  status             text not null default 'active'
                       check (status in ('active','notified','booked','cancelled')),
  notify_token       text not null unique default encode(gen_random_bytes(24), 'hex'),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  preferred_eras     text[] not null default '{}'::text[]
);

-- ── push_subscriptions ───────────────────────────────────────────────────────
create table if not exists public.push_subscriptions (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid references public.businesses(id) on delete cascade,
  appointment_id    uuid references public.appointments(id) on delete cascade,
  endpoint          text not null unique,
  p256dh            text not null,
  auth              text not null,
  user_agent        text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  waitlist_entry_id uuid references public.waitlist_entries(id) on delete cascade
);

-- ── device_push_tokens ───────────────────────────────────────────────────────
create table if not exists public.device_push_tokens (
  id                uuid primary key default gen_random_uuid(),
  token             text not null unique,
  platform          text not null check (platform in ('fcm','apns')),
  waitlist_entry_id uuid references public.waitlist_entries(id) on delete set null,
  business_id       uuid references public.businesses(id) on delete cascade,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ── business_announcements ───────────────────────────────────────────────────
create table if not exists public.business_announcements (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses(id) on delete cascade,
  title           text not null,
  body            text not null,
  sent_at         timestamptz,
  recipient_count integer,
  created_at      timestamptz not null default now()
);

-- ── phone_otps ───────────────────────────────────────────────────────────────
create table if not exists public.phone_otps (
  id         uuid primary key default gen_random_uuid(),
  phone      text not null,
  code       text not null,
  purpose    text not null default 'register' check (purpose in ('register','login','booking')),
  used_at    timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- ── wa_message_log ───────────────────────────────────────────────────────────
create table if not exists public.wa_message_log (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses(id) on delete cascade,
  message_type    text not null check (message_type in (
                    'auth','booking_confirmation','reminder','waitlist','verification_link')),
  recipient_phone text not null,
  status          text not null default 'sent' check (status in ('sent','failed')),
  created_at      timestamptz not null default now()
);

-- ── tenant_experience_configs ────────────────────────────────────────────────
-- One row per business. Holds the website builder's draft columns
-- (brand/layout/content/meta_json) and the immutable published snapshot
-- (published_config_json) that /book/[slug] renders.
create table if not exists public.tenant_experience_configs (
  id                    uuid primary key default gen_random_uuid(),
  business_id           uuid not null references public.businesses(id) on delete cascade,
  brand_json            jsonb not null default '{}'::jsonb,
  layout_json           jsonb not null default '{}'::jsonb,
  content_json          jsonb not null default '{}'::jsonb,
  published_config_json jsonb,
  draft_config_json     jsonb,
  is_published          boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  meta_json             jsonb not null default '{}'::jsonb
);


-- ═════════════════════════════════════════════════════════════════════════════
-- INDEXES
-- ═════════════════════════════════════════════════════════════════════════════

-- Foreign-key covering indexes
create index if not exists idx_services_business            on public.services(business_id);
create index if not exists idx_staff_members_business       on public.staff_members(business_id);
create index if not exists idx_working_hours_business       on public.working_hours(business_id);
create index if not exists idx_working_hour_breaks_business on public.working_hour_breaks(business_id);
create index if not exists idx_customers_business           on public.customers(business_id);
create index if not exists idx_customers_customer_user      on public.customers(customer_user_id);
create index if not exists idx_appointments_business        on public.appointments(business_id);
create index if not exists idx_appointments_service         on public.appointments(service_id);
create index if not exists idx_appointments_staff           on public.appointments(staff_member_id);
create index if not exists idx_appointments_customer        on public.appointments(customer_id);
create index if not exists idx_appointments_customer_user   on public.appointments(customer_user_id);
create index if not exists idx_appointment_events_business  on public.appointment_events(business_id);
create index if not exists idx_appointment_events_appointment on public.appointment_events(appointment_id);
create index if not exists idx_waitlist_business            on public.waitlist_entries(business_id);
create index if not exists idx_waitlist_service             on public.waitlist_entries(service_id);
create index if not exists idx_waitlist_staff               on public.waitlist_entries(staff_member_id);
create index if not exists idx_push_subs_business           on public.push_subscriptions(business_id);
create index if not exists idx_push_subs_appointment        on public.push_subscriptions(appointment_id);
create index if not exists idx_push_subs_waitlist           on public.push_subscriptions(waitlist_entry_id);
create index if not exists idx_dpt_business                 on public.device_push_tokens(business_id);
create index if not exists idx_dpt_waitlist                 on public.device_push_tokens(waitlist_entry_id);
create index if not exists idx_customer_sessions_business   on public.customer_sessions(business_id);
create index if not exists idx_customer_sessions_customer   on public.customer_sessions(customer_id);
create index if not exists idx_customer_user_sessions_user  on public.customer_user_sessions(customer_user_id);
create index if not exists idx_customer_devices_user        on public.customer_devices(customer_user_id);
create index if not exists idx_customer_notifications_business on public.customer_notifications(business_id);
create index if not exists idx_wa_message_log_business_fk   on public.wa_message_log(business_id);

-- Query-shaped indexes
create index if not exists idx_business_announcements_business
  on public.business_announcements(business_id, created_at desc);
create index if not exists idx_customer_businesses_user_recent
  on public.customer_businesses(customer_user_id, last_visited_at desc);
create index if not exists idx_customer_businesses_business_notify
  on public.customer_businesses(business_id) where notifications_enabled;
create index if not exists idx_customer_notifications_user_created
  on public.customer_notifications(customer_user_id, created_at desc);
create index if not exists idx_customer_notifications_user_unread
  on public.customer_notifications(customer_user_id) where read_at is null;

-- The builder's saveDraft/publishConfig upsert on onConflict:'business_id'
-- REQUIRES this unique index. Without it, publishing silently fails.
create unique index if not exists tenant_experience_configs_business_id_idx
  on public.tenant_experience_configs(business_id);

-- DRIFT: the five below are declared in the repo's migrations but were never
-- applied to the live project. All are pure additions — safe to create.
create index if not exists idx_phone_otps_phone
  on public.phone_otps(phone);
create index if not exists appointment_events_business_created_idx
  on public.appointment_events(business_id, created_at desc);
create index if not exists waitlist_entries_business_status_idx
  on public.waitlist_entries(business_id, status, preferred_date);
create index if not exists working_hour_breaks_business_day_idx
  on public.working_hour_breaks(business_id, day_of_week);
create index if not exists idx_wa_message_log_type
  on public.wa_message_log(business_id, message_type);

-- DELIBERATELY OMITTED: push_subscriptions_endpoint_appt_idx, a partial unique
-- index on (endpoint, appointment_id). /api/push/subscribe was rewritten to
-- delete-then-insert precisely so it would not depend on a partial index for
-- upsert conflict resolution, so the index is dead weight.


-- ═════════════════════════════════════════════════════════════════════════════
-- FUNCTIONS & TRIGGERS
-- ═════════════════════════════════════════════════════════════════════════════

-- Six-digit public business code, used for the "find a business by code" flow.
create or replace function public.generate_business_code()
returns text
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  candidate text;
  attempts  int := 0;
begin
  loop
    attempts := attempts + 1;
    if attempts > 50 then
      raise exception 'generate_business_code: could not find a free code after 50 attempts';
    end if;
    candidate := lpad(floor(random() * 1000000)::int::text, 6, '0');
    exit when not exists (select 1 from public.businesses where business_code = candidate);
  end loop;
  return candidate;
end;
$$;

create or replace function public.set_business_code()
returns trigger
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
begin
  if new.business_code is null then
    new.business_code := public.generate_business_code();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_business_code on public.businesses;
create trigger trg_set_business_code
  before insert on public.businesses
  for each row execute function public.set_business_code();

-- Called by /api/auth/ensure-profile after signup. SECURITY DEFINER so it can
-- write the profiles row before any owner policy could apply.
create or replace function public.ensure_profile(p_full_name text default null)
returns void
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  insert into public.profiles (id, full_name)
  values (auth.uid(), p_full_name)
  on conflict (id) do update
    set full_name  = coalesce(excluded.full_name, profiles.full_name),
        updated_at = now();
end;
$$;

revoke all on function public.ensure_profile(text) from public, anon;
grant execute on function public.ensure_profile(text) to authenticated;

-- Housekeeping for expired one-time codes. Point a cron at this if you want it
-- swept automatically; nothing calls it today.
-- DRIFT: declared in the repo, absent from the live project.
create or replace function public.cleanup_expired_otps()
returns void
language sql
security definer
set search_path = 'public', 'pg_temp'
as $$
  delete from public.phone_otps where expires_at < now() - interval '1 hour';
$$;

revoke all on function public.cleanup_expired_otps() from public, anon, authenticated;

-- Belt-and-braces profile creation on signup. The app does not depend on this —
-- it calls ensure_profile() explicitly — but it keeps profiles complete if a user
-- is ever created outside the app (dashboard, admin API, seed script).
-- DRIFT: declared in the repo, absent from the live project.
-- Wrapped because creating a trigger on auth.users needs elevated ownership,
-- which is not available on every connection role.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id,
          new.raw_user_meta_data ->> 'full_name',
          new.raw_user_meta_data ->> 'avatar_url')
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Only the trigger needs ownership of auth.users, so only the trigger is guarded.
do $$
begin
  drop trigger if exists on_auth_user_created on auth.users;
  create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();
exception
  when insufficient_privilege then
    raise notice 'skipped on_auth_user_created trigger (insufficient privilege on auth.users); ensure_profile() covers this path';
end;
$$;


-- ═════════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
--
-- Two access models coexist:
--   1. Owner-scoped tables reached with the anon/authenticated key — these need
--      real policies (businesses, services, staff, hours, breaks, appointments,
--      customers, profiles, tenant_experience_configs).
--   2. Tables reached ONLY through the service-role key in API routes — these
--      get RLS enabled with NO policies, which is deny-all for anon and
--      authenticated. That is intentional, not an oversight: customer sessions,
--      OTP codes and push tokens must never be readable with a public key.
--      Supabase's linter reports these as "RLS enabled, no policy" (INFO).
-- ═════════════════════════════════════════════════════════════════════════════

alter table public.profiles                  enable row level security;
alter table public.businesses                enable row level security;
alter table public.services                  enable row level security;
alter table public.staff_members             enable row level security;
alter table public.working_hours             enable row level security;
alter table public.working_hour_breaks       enable row level security;
alter table public.customers                 enable row level security;
alter table public.appointments              enable row level security;
alter table public.appointment_events        enable row level security;
alter table public.waitlist_entries          enable row level security;
alter table public.push_subscriptions        enable row level security;
alter table public.device_push_tokens        enable row level security;
alter table public.business_announcements    enable row level security;
alter table public.phone_otps                enable row level security;
alter table public.wa_message_log            enable row level security;
alter table public.customer_users            enable row level security;
alter table public.customer_user_sessions    enable row level security;
alter table public.customer_sessions         enable row level security;
alter table public.customer_businesses       enable row level security;
alter table public.customer_devices          enable row level security;
alter table public.customer_notifications    enable row level security;
alter table public.tenant_experience_configs enable row level security;

-- Every policy below wraps auth.uid() in a scalar subquery: `(select auth.uid())`
-- is evaluated once per statement via InitPlan instead of once per row.
-- Policies are also split one-per-(role, command) so Postgres never has to OR
-- multiple permissive policies together on the same access path.

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
-- Public select is required: /book/[slug] resolves a business by slug for
-- anonymous visitors. No secrets live on this table except the admin password
-- hash/salt, which the app never selects with a public key.
drop policy if exists "businesses: public select" on public.businesses;
drop policy if exists "businesses: owner insert" on public.businesses;
drop policy if exists "businesses: owner update" on public.businesses;
drop policy if exists "businesses: owner delete" on public.businesses;

create policy "businesses: public select" on public.businesses
  for select using (true);
create policy "businesses: owner insert" on public.businesses
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "businesses: owner update" on public.businesses
  for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "businesses: owner delete" on public.businesses
  for delete to authenticated using (owner_id = (select auth.uid()));

-- ── services ─────────────────────────────────────────────────────────────────
drop policy if exists "services: anon read"          on public.services;
drop policy if exists "services: authenticated read" on public.services;
drop policy if exists "services: owner write"        on public.services;
drop policy if exists "services: owner update"       on public.services;
drop policy if exists "services: owner delete"       on public.services;

create policy "services: anon read" on public.services
  for select to anon using (active = true);
-- The OR branch lets an owner see their own inactive services in the dashboard.
create policy "services: authenticated read" on public.services
  for select to authenticated using (
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

-- ── staff_members ────────────────────────────────────────────────────────────
drop policy if exists "staff: anon read"          on public.staff_members;
drop policy if exists "staff: authenticated read" on public.staff_members;
drop policy if exists "staff: owner insert"       on public.staff_members;
drop policy if exists "staff: owner update"       on public.staff_members;
drop policy if exists "staff: owner delete"       on public.staff_members;

create policy "staff: anon read" on public.staff_members
  for select to anon using (active = true);
create policy "staff: authenticated read" on public.staff_members
  for select to authenticated using (
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

-- ── working_hours ────────────────────────────────────────────────────────────
-- Opening hours are public information; the booking page renders them anonymously.
drop policy if exists "hours: read"         on public.working_hours;
drop policy if exists "hours: owner insert" on public.working_hours;
drop policy if exists "hours: owner update" on public.working_hours;
drop policy if exists "hours: owner delete" on public.working_hours;

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

-- ── working_hour_breaks ──────────────────────────────────────────────────────
drop policy if exists "breaks: read"         on public.working_hour_breaks;
drop policy if exists "breaks: owner insert" on public.working_hour_breaks;
drop policy if exists "breaks: owner update" on public.working_hour_breaks;
drop policy if exists "breaks: owner delete" on public.working_hour_breaks;

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

-- ── appointments ─────────────────────────────────────────────────────────────
-- Owner-only. There is deliberately NO public read policy: appointments carry
-- customer names, phones and emails. Public booking flows (create, manage by
-- token, availability) all run through service-role API routes that authorise on
-- the unguessable manage_token instead.
drop policy if exists "appointments: owner all" on public.appointments;

create policy "appointments: owner all" on public.appointments
  for all to authenticated
  using      (business_id in (select id from public.businesses where owner_id = (select auth.uid())))
  with check (business_id in (select id from public.businesses where owner_id = (select auth.uid())));

-- ── customers ────────────────────────────────────────────────────────────────
drop policy if exists "customers: owner all" on public.customers;

create policy "customers: owner all" on public.customers
  for all to authenticated
  using      (business_id in (select id from public.businesses where owner_id = (select auth.uid())))
  with check (business_id in (select id from public.businesses where owner_id = (select auth.uid())));

-- ── waitlist_entries ─────────────────────────────────────────────────────────
-- Insert-only for the public: a visitor can join a waitlist but cannot read the
-- list back. Owner reads go through service-role routes.
drop policy if exists "public_insert_waitlist" on public.waitlist_entries;

create policy "public_insert_waitlist" on public.waitlist_entries
  for insert with check (true);

-- ── tenant_experience_configs ────────────────────────────────────────────────
-- The anon read policy is what makes publishing work at all: /book/[slug] reads
-- this table with the anon key. Without it every visitor silently falls back to
-- the default template and published branding never goes live.
-- The authenticated policy needs the OR branch because the builder's GET loads
-- the owner's row without filtering on is_published — a plain `is_published =
-- true` read would break the builder for anyone who has not published yet.
drop policy if exists "config: anon read published" on public.tenant_experience_configs;
drop policy if exists "config: authenticated read"  on public.tenant_experience_configs;
drop policy if exists "config: owner insert"        on public.tenant_experience_configs;
drop policy if exists "config: owner update"        on public.tenant_experience_configs;
drop policy if exists "config: owner delete"        on public.tenant_experience_configs;

create policy "config: anon read published" on public.tenant_experience_configs
  for select to anon using (is_published = true);
create policy "config: authenticated read" on public.tenant_experience_configs
  for select to authenticated using (
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


-- ═════════════════════════════════════════════════════════════════════════════
-- GRANTS
-- RLS decides row visibility; these grant the table-level privilege that RLS
-- then filters. service_role bypasses RLS entirely.
-- ═════════════════════════════════════════════════════════════════════════════

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables    in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;

alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;


-- ═════════════════════════════════════════════════════════════════════════════
-- STORAGE
--
-- DRIFT: this bucket was declared in 20260601000000 but never created on the
-- live project. While it was missing, every builder image upload failed at
-- createSignedUploadUrl. The builder and onboarding wizard both fell back to
-- their local `blob:` preview URL and published THAT — a URL that resolves only
-- inside the tab that created it. Result: the editor preview looked perfect
-- while the live site showed a broken hero image.
-- ═════════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'business-media',
  'business-media',
  true,
  31457280,  -- 30 MB, matches the cap enforced in /api/builder/upload-url
  array['image/jpeg','image/png','image/webp','image/gif','image/avif','image/svg+xml']
)
on conflict (id) do update
  set public             = true,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Uploads are signed server-side with the service-role key, which bypasses RLS,
-- and the bucket is public so reads are served without a policy check. These
-- policies exist so direct client uploads also work, and so the rules are
-- explicit rather than implied by bucket flags.
do $$
begin
  drop policy if exists "Authenticated users can upload media" on storage.objects;
  drop policy if exists "Users can update own media"           on storage.objects;
  drop policy if exists "Users can delete own media"           on storage.objects;
  drop policy if exists "Public can read business media"       on storage.objects;

  create policy "Authenticated users can upload media"
    on storage.objects for insert to authenticated
    with check (bucket_id = 'business-media');

  create policy "Users can update own media"
    on storage.objects for update to authenticated
    using (
      bucket_id = 'business-media'
      and (select auth.uid())::text = (storage.foldername(name))[1]
    );

  create policy "Users can delete own media"
    on storage.objects for delete to authenticated
    using (
      bucket_id = 'business-media'
      and (select auth.uid())::text = (storage.foldername(name))[1]
    );

  create policy "Public can read business media"
    on storage.objects for select to anon, authenticated
    using (bucket_id = 'business-media');
exception
  when insufficient_privilege then
    raise notice 'skipped storage.objects policies (insufficient privilege); the public bucket + service-role signed uploads still work';
end;
$$;

notify pgrst, 'reload schema';
