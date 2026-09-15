alter table public.businesses
  add column if not exists appointments_require_confirmation boolean not null default true;

create table if not exists public.appointment_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  event_type text not null check (event_type in ('reservation', 'cancellation', 'status_change', 'reschedule', 'note')),
  title text not null,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists appointment_events_business_created_idx
  on public.appointment_events (business_id, created_at desc);

alter table public.appointment_events enable row level security;

create policy "Business owners can read appointment events"
  on public.appointment_events
  for select
  using (
    exists (
      select 1 from public.businesses
      where businesses.id = appointment_events.business_id
        and businesses.owner_id = auth.uid()
    )
  );

create policy "Business owners can insert appointment events"
  on public.appointment_events
  for insert
  with check (
    exists (
      select 1 from public.businesses
      where businesses.id = appointment_events.business_id
        and businesses.owner_id = auth.uid()
    )
  );
