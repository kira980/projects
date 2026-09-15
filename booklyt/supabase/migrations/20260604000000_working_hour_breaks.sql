create table if not exists public.working_hour_breaks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  day_of_week integer not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_time < end_time)
);

create index if not exists working_hour_breaks_business_day_idx
  on public.working_hour_breaks(business_id, day_of_week);

alter table public.working_hour_breaks enable row level security;

create policy "Business owners can manage their working hour breaks"
  on public.working_hour_breaks
  for all
  using (
    business_id in (
      select id from public.businesses where owner_id = auth.uid()
    )
  )
  with check (
    business_id in (
      select id from public.businesses where owner_id = auth.uid()
    )
  );

create policy "Public can read working hour breaks"
  on public.working_hour_breaks
  for select
  using (true);
