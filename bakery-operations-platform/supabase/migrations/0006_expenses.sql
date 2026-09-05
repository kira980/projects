-- Stage 7: expenses.

create table public.expenses (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references public.businesses (id) on delete cascade,
  category          text not null default 'general',
  amount            numeric(12, 2) not null check (amount > 0),
  method            text not null default 'cash' check (method in ('cash', 'card', 'transfer', 'check', 'other')),
  description       text,
  receipt_file_path text,
  spent_by_type     text not null default 'worker' check (spent_by_type in ('worker', 'admin')),
  spent_by_id       uuid,
  expense_date      date not null default (now() at time zone 'Asia/Jerusalem')::date,
  created_at        timestamptz not null default now()
);

create index expenses_business_id_idx on public.expenses (business_id);
create index expenses_date_idx on public.expenses (business_id, expense_date desc);
create index expenses_created_at_idx on public.expenses (business_id, created_at desc);

alter table public.expenses enable row level security;
create policy "business members full access"
  on public.expenses for all
  using (business_id = public.current_business_id())
  with check (business_id = public.current_business_id());
