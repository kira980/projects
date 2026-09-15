-- ─────────────────────────────────────────────────────────────────────────────
-- Native push devices for authenticated customers (Booklyt app).
-- Identity-centric replacement for the anonymous device_push_tokens table,
-- which stays untouched for the legacy waitlist flow.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.customer_devices (
  id                      uuid        primary key default gen_random_uuid(),
  customer_user_id        uuid        not null references public.customer_users(id) on delete cascade,
  platform                text        not null check (platform in ('ios', 'android', 'web')),
  push_token              text        not null,
  notification_permission text        not null default 'prompt'
                                      check (notification_permission in ('granted', 'denied', 'prompt')),
  last_seen               timestamptz not null default now(),
  created_at              timestamptz not null default now(),
  unique (customer_user_id, push_token)
);

create index if not exists idx_customer_devices_user
  on public.customer_devices(customer_user_id);

-- Service-role access only
alter table public.customer_devices enable row level security;
