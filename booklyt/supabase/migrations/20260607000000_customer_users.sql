-- ─────────────────────────────────────────────────────────────────────────────
-- Customer-facing authentication
-- Separate from Supabase Auth (which is used for business owners only).
-- Phone + password login; WhatsApp OTP can be bolted on later.
-- ─────────────────────────────────────────────────────────────────────────────

-- Cross-business customer identity
create table if not exists public.customer_users (
  id           uuid        primary key default gen_random_uuid(),
  phone        text        unique not null,          -- normalized login identifier
  password_hash text       not null,                 -- bcrypt hash, never plain text
  full_name    text,
  -- TODO: add `phone_verified boolean not null default false` when WhatsApp OTP is ready
  -- TODO: add `phone_verified_at timestamptz` when WhatsApp OTP is ready
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Auth session tokens for customer_users
create table if not exists public.customer_user_sessions (
  id                 uuid        primary key default gen_random_uuid(),
  customer_user_id   uuid        not null references public.customer_users(id) on delete cascade,
  token_hash         text        unique not null,
  user_agent         text,
  expires_at         timestamptz not null,
  created_at         timestamptz not null default now()
);

-- Link appointments to the authenticated customer who created them
alter table public.appointments
  add column if not exists customer_user_id uuid references public.customer_users(id) on delete set null;

-- Link business-specific customer records to their global user account
alter table public.customers
  add column if not exists customer_user_id uuid references public.customer_users(id) on delete set null;

-- Indexes
create index if not exists idx_customer_users_phone
  on public.customer_users(phone);

create index if not exists idx_customer_user_sessions_token_hash
  on public.customer_user_sessions(token_hash);

create index if not exists idx_customer_user_sessions_user_id
  on public.customer_user_sessions(customer_user_id);

create index if not exists idx_appointments_customer_user_id
  on public.appointments(customer_user_id)
  where customer_user_id is not null;

-- RLS: these tables are only accessed server-side via the service-role client.
-- No row-level policies needed — the service role bypasses RLS by design.
alter table public.customer_users         enable row level security;
alter table public.customer_user_sessions enable row level security;
