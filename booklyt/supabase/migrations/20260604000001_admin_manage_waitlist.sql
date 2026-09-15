alter table public.businesses
  add column if not exists admin_password_hash text,
  add column if not exists admin_password_salt text,
  add column if not exists admin_password_updated_at timestamptz;

alter table public.appointments
  add column if not exists manage_token text unique,
  add column if not exists cancelled_at timestamptz;

create index if not exists appointments_manage_token_idx
  on public.appointments (manage_token)
  where manage_token is not null;

create table if not exists public.waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  staff_member_id uuid references public.staff_members(id) on delete set null,
  customer_name text not null,
  customer_email text,
  customer_phone text,
  preferred_date date not null,
  participants_count integer not null default 1 check (participants_count >= 1),
  status text not null default 'active' check (status in ('active', 'notified', 'booked', 'cancelled')),
  notify_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists waitlist_entries_business_status_idx
  on public.waitlist_entries (business_id, status, preferred_date);

alter table public.waitlist_entries enable row level security;

create policy "Business owners can manage waitlist entries"
  on public.waitlist_entries
  for all
  using (
    exists (
      select 1 from public.businesses
      where businesses.id = waitlist_entries.business_id
        and businesses.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.businesses
      where businesses.id = waitlist_entries.business_id
        and businesses.owner_id = auth.uid()
    )
  );

create policy "Anyone can join a waitlist"
  on public.waitlist_entries
  for insert
  with check (true);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_business_idx
  on public.push_subscriptions (business_id);

alter table public.push_subscriptions enable row level security;

create policy "Business owners can manage push subscriptions"
  on public.push_subscriptions
  for all
  using (
    business_id is null
    or exists (
      select 1 from public.businesses
      where businesses.id = push_subscriptions.business_id
        and businesses.owner_id = auth.uid()
    )
  )
  with check (
    business_id is null
    or exists (
      select 1 from public.businesses
      where businesses.id = push_subscriptions.business_id
        and businesses.owner_id = auth.uid()
    )
  );
