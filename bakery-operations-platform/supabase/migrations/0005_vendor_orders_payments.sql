-- Stage 6: vendor goods received, vendor payments, vendor debt ledger.

-- A goods arrival (קבלת סחורה) — a vendor bill, paid or unpaid.
create table public.vendor_orders (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references public.businesses (id) on delete cascade,
  vendor_id         uuid not null references public.vendors (id) on delete restrict,
  amount            numeric(12, 2) not null check (amount > 0),
  status            text not null default 'unpaid' check (status in ('unpaid', 'paid')),
  payment_method    text check (payment_method in ('cash', 'card', 'transfer', 'check', 'other')),
  paid_by_worker_id uuid references public.workers (id),
  received_by_type  text not null default 'worker' check (received_by_type in ('worker', 'admin')),
  received_by_id    uuid,
  receipt_file_path text,
  notes             text,
  received_at       timestamptz not null default now(),
  created_at        timestamptz not null default now()
);

create index vendor_orders_business_id_idx on public.vendor_orders (business_id);
create index vendor_orders_vendor_id_idx on public.vendor_orders (vendor_id, received_at desc);
create index vendor_orders_status_idx on public.vendor_orders (business_id, status);
create index vendor_orders_date_idx on public.vendor_orders (business_id, received_at desc);

-- A payment to a vendor (at arrival or later as debt payment).
create table public.vendor_payments (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses (id) on delete cascade,
  vendor_id       uuid not null references public.vendors (id) on delete restrict,
  vendor_order_id uuid references public.vendor_orders (id) on delete set null,
  amount          numeric(12, 2) not null check (amount > 0),
  method          text not null check (method in ('cash', 'card', 'transfer', 'check', 'other')),
  paid_by_type    text not null default 'worker' check (paid_by_type in ('worker', 'admin')),
  paid_by_id      uuid,
  proof_file_path text,
  notes           text,
  paid_at         timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

create index vendor_payments_business_id_idx on public.vendor_payments (business_id);
create index vendor_payments_vendor_id_idx on public.vendor_payments (vendor_id, paid_at desc);
create index vendor_payments_date_idx on public.vendor_payments (business_id, paid_at desc);

-- Append-only debt ledger. Vendor debt = sum(charge) - sum(payment).
create table public.vendor_ledger_entries (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references public.businesses (id) on delete cascade,
  vendor_id         uuid not null references public.vendors (id) on delete restrict,
  entry_type        text not null check (entry_type in ('charge', 'payment', 'adjustment')),
  amount            numeric(12, 2) not null,
  vendor_order_id   uuid references public.vendor_orders (id) on delete set null,
  vendor_payment_id uuid references public.vendor_payments (id) on delete set null,
  description       text,
  created_at        timestamptz not null default now()
);

create index vendor_ledger_business_id_idx on public.vendor_ledger_entries (business_id);
create index vendor_ledger_vendor_id_idx on public.vendor_ledger_entries (vendor_id, created_at desc);

-- Current debt per vendor.
create or replace function public.vendor_debt(p_vendor_id uuid)
returns numeric
language sql
stable
as $$
  select coalesce(sum(
    case entry_type
      when 'charge' then amount
      when 'payment' then -amount
      else amount
    end
  ), 0)
  from public.vendor_ledger_entries
  where vendor_id = p_vendor_id
$$;

-- Debt per vendor, respecting the caller's RLS.
create view public.vendor_debts
with (security_invoker = true) as
select
  business_id,
  vendor_id,
  sum(
    case entry_type
      when 'charge' then amount
      when 'payment' then -amount
      else amount
    end
  ) as debt
from public.vendor_ledger_entries
group by business_id, vendor_id;

do $$
declare
  t text;
begin
  foreach t in array array['vendor_orders', 'vendor_payments', 'vendor_ledger_entries']
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
