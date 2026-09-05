-- Stage 17: Web Push subscriptions for staff screens.
--
-- Stores browser Push API subscriptions so the server can notify a
-- screen (currently the production/baker screen) when a new order is
-- created. One row per browser endpoint. Scoped by business, like
-- everything else; `scope` mirrors the worker session scope so we can
-- target just the production app.

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  scope text not null check (scope in ('production', 'driver', 'kiosk')),
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  worker_id uuid references public.workers(id) on delete set null,
  created_at timestamptz not null default now(),
  -- A given browser endpoint is unique; re-subscribing upserts.
  unique (endpoint)
);

create index push_subscriptions_business_scope_idx
  on public.push_subscriptions (business_id, scope);

-- RLS: admins (Supabase-auth business members) may manage their own
-- business's rows. The worker-side subscribe/insert and the server-side
-- send both run through the service-role client, which bypasses RLS.
alter table public.push_subscriptions enable row level security;

create policy "business members full access"
  on public.push_subscriptions
  for all
  using (business_id = public.current_business_id())
  with check (business_id = public.current_business_id());
