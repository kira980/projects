-- Stage 3/4: worker shifts and advances.

create table public.worker_shifts (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses (id) on delete cascade,
  worker_id       uuid not null references public.workers (id) on delete cascade,
  started_at      timestamptz not null default now(),
  ended_at        timestamptz,
  -- Who performed the clock action (self, shift manager, or admin).
  started_by_type text not null default 'worker' check (started_by_type in ('worker', 'admin', 'system')),
  started_by_id   uuid,
  ended_by_type   text check (ended_by_type in ('worker', 'admin', 'system')),
  ended_by_id     uuid,
  notes           text,
  created_at      timestamptz not null default now()
);

create index worker_shifts_business_id_idx on public.worker_shifts (business_id);
create index worker_shifts_worker_id_idx on public.worker_shifts (worker_id, started_at desc);
create index worker_shifts_date_idx on public.worker_shifts (business_id, started_at desc);
-- At most one open shift per worker.
create unique index worker_shifts_one_open_idx
  on public.worker_shifts (worker_id)
  where ended_at is null;

create table public.worker_advances (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses (id) on delete cascade,
  worker_id     uuid not null references public.workers (id) on delete cascade,
  amount        numeric(10, 2) not null check (amount > 0),
  method        text not null default 'cash' check (method in ('cash', 'transfer', 'other')),
  taken_at      timestamptz not null default now(),
  given_by_type text not null default 'worker' check (given_by_type in ('worker', 'admin', 'system')),
  given_by_id   uuid,
  shift_id      uuid references public.worker_shifts (id) on delete set null,
  notes         text,
  created_at    timestamptz not null default now()
);

create index worker_advances_business_id_idx on public.worker_advances (business_id);
create index worker_advances_worker_id_idx on public.worker_advances (worker_id, taken_at desc);
create index worker_advances_date_idx on public.worker_advances (business_id, taken_at desc);

do $$
declare
  t text;
begin
  foreach t in array array['worker_shifts', 'worker_advances']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "business members full access" on public.%I
         for all
         using (business_id = public.current_business_id())
         with check (business_id = public.current_business_id())',
      t
    );
  end loop;
end;
$$;
