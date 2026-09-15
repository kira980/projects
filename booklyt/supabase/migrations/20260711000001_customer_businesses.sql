-- ─────────────────────────────────────────────────────────────────────────────
-- Saved businesses per customer ("My Businesses" / Favorites / Recently Used).
-- A row is created the first time a customer opens or books with a business
-- and updated on every subsequent visit.
-- Anti-spam anchor: a business may only notify customers present in this table
-- with notifications_enabled = true.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.customer_businesses (
  id                    uuid        primary key default gen_random_uuid(),
  customer_user_id      uuid        not null references public.customer_users(id) on delete cascade,
  business_id           uuid        not null references public.businesses(id) on delete cascade,
  first_visited_at      timestamptz not null default now(),
  last_visited_at       timestamptz not null default now(),
  visit_count           integer     not null default 1,
  favorite              boolean     not null default false,
  notifications_enabled boolean     not null default true,
  created_at            timestamptz not null default now(),
  unique (customer_user_id, business_id)
);

create index if not exists idx_customer_businesses_user_recent
  on public.customer_businesses(customer_user_id, last_visited_at desc);

create index if not exists idx_customer_businesses_business_notify
  on public.customer_businesses(business_id)
  where notifications_enabled;

-- Service-role access only (matches customer_users pattern)
alter table public.customer_businesses enable row level security;
