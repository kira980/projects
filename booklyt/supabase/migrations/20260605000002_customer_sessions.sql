create table if not exists public.customer_sessions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  token_hash text not null unique,
  user_agent text,
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists customer_sessions_business_token_idx
  on public.customer_sessions (business_id, token_hash);

create index if not exists customer_sessions_customer_idx
  on public.customer_sessions (customer_id, expires_at desc);

alter table public.customer_sessions enable row level security;

drop policy if exists "Business owners can view customer sessions" on public.customer_sessions;
create policy "Business owners can view customer sessions"
  on public.customer_sessions for select
  using (
    exists (
      select 1 from public.businesses
      where businesses.id = customer_sessions.business_id
        and businesses.owner_id = auth.uid()
    )
  );
