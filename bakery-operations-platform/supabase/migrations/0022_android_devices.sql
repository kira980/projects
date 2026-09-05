-- Stage 22: Android receipt-printer app — device pairing + print log.
--
-- A standalone Android app (android-receipt-printer/) views orders and
-- prints receipts on a Bluetooth thermal printer. It never holds the
-- service-role key: it pairs with a worker passcode and receives an opaque
-- bearer token whose SHA-256 hash is stored here. The server resolves the
-- token to a single business and scopes every query to it.

create table public.android_devices (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  -- The worker whose passcode paired the device (audit only; access is by
  -- business, not by worker).
  worker_id    uuid references public.workers (id) on delete set null,
  label        text not null default '',
  -- SHA-256 (hex) of the opaque bearer token. The raw token is returned
  -- once at pairing and never stored.
  token_hash   text not null unique,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz,
  -- Set to revoke the device without deleting its history.
  revoked_at   timestamptz
);

create index android_devices_business_id_idx on public.android_devices (business_id);
create index android_devices_token_hash_idx on public.android_devices (token_hash);

alter table public.android_devices enable row level security;
-- Only the service-role client (used by the /api/android route handlers)
-- touches this table; no anon/authenticated policy is granted, so RLS
-- denies everyone else by default.

create table public.android_print_logs (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  device_id    uuid references public.android_devices (id) on delete set null,
  order_id     uuid references public.orders (id) on delete set null,
  order_number bigint,
  printer_name text,
  paper        text check (paper in ('mm58', 'mm80')),
  result       text not null default 'success' check (result in ('success', 'failure')),
  error        text,
  reprint      boolean not null default false,
  printed_at   timestamptz not null default now()
);

create index android_print_logs_business_id_idx on public.android_print_logs (business_id);
create index android_print_logs_order_id_idx on public.android_print_logs (order_id);

alter table public.android_print_logs enable row level security;
-- Service-role only, same as android_devices.

notify pgrst, 'reload schema';
