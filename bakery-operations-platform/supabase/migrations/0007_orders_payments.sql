-- Stage 10: orders, order items (price snapshots), order documents,
-- customer payments, customer debt ledger.

-- Per-business sequential order numbers.
alter table public.businesses
  add column next_order_number bigint not null default 1001;

create or replace function public.take_order_number(p_business_id uuid)
returns bigint
language sql
volatile
security definer
set search_path = public
as $$
  update public.businesses
  set next_order_number = next_order_number + 1
  where id = p_business_id
  returning next_order_number - 1
$$;

create table public.orders (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references public.businesses (id) on delete cascade,
  customer_id      uuid not null references public.customers (id) on delete restrict,
  order_number     bigint not null,
  status           text not null default 'new'
    check (status in ('new', 'preparing', 'ready', 'delivering', 'delivered', 'problem', 'cancelled')),
  payment_status   text not null default 'unpaid'
    check (payment_status in ('unpaid', 'partial', 'paid')),
  delivery_type    text not null default 'delivery' check (delivery_type in ('delivery', 'pickup')),
  delivery_date    date not null,
  delivery_time    text,
  address_text     text,
  total            numeric(12, 2) not null default 0,
  notes            text,
  notes_for_baker  text,
  notes_for_driver text,
  source           text not null default 'admin' check (source in ('admin', 'online')),
  created_by_type  text not null default 'admin' check (created_by_type in ('admin', 'worker', 'customer')),
  created_by_id    uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (business_id, order_number)
);

create index orders_business_id_idx on public.orders (business_id);
create index orders_customer_id_idx on public.orders (customer_id, created_at desc);
create index orders_status_idx on public.orders (business_id, status);
create index orders_delivery_date_idx on public.orders (business_id, delivery_date);
create index orders_created_at_idx on public.orders (business_id, created_at desc);

create trigger orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- Items snapshot name/unit/price at order time so later menu or price
-- changes never affect existing orders.
create table public.order_items (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  order_id     uuid not null references public.orders (id) on delete cascade,
  product_id   uuid references public.products (id) on delete set null,
  product_name text not null,
  unit_type    text not null,
  quantity     numeric(10, 2) not null check (quantity > 0),
  unit_price   numeric(10, 2) not null,
  line_total   numeric(12, 2) not null,
  notes        text,
  created_at   timestamptz not null default now()
);

create index order_items_business_id_idx on public.order_items (business_id);
create index order_items_order_id_idx on public.order_items (order_id);
create index order_items_product_id_idx on public.order_items (product_id);

-- Immutable document snapshots (הצעת מחיר) — reprints never change.
create table public.order_documents (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  order_id    uuid not null references public.orders (id) on delete cascade,
  doc_type    text not null default 'quote' check (doc_type in ('quote')),
  snapshot    jsonb not null,
  created_by  uuid,
  created_at  timestamptz not null default now()
);

create index order_documents_order_id_idx on public.order_documents (order_id, created_at desc);
create index order_documents_business_id_idx on public.order_documents (business_id);

-- Customer payments (at order, on delivery, or standalone debt payment).
create table public.payments (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references public.businesses (id) on delete cascade,
  customer_id       uuid not null references public.customers (id) on delete restrict,
  order_id          uuid references public.orders (id) on delete set null,
  delivery_id       uuid,
  amount            numeric(12, 2) not null check (amount > 0),
  method            text not null check (method in ('cash', 'card', 'transfer', 'check', 'other')),
  collected_by_type text not null default 'admin' check (collected_by_type in ('admin', 'worker')),
  collected_by_id   uuid,
  proof_file_path   text,
  notes             text,
  paid_at           timestamptz not null default now(),
  created_at        timestamptz not null default now()
);

create index payments_business_id_idx on public.payments (business_id);
create index payments_customer_id_idx on public.payments (customer_id, paid_at desc);
create index payments_order_id_idx on public.payments (order_id);
create index payments_date_idx on public.payments (business_id, paid_at desc);

-- Append-only customer debt ledger. Debt = charges - payments.
create table public.customer_ledger_entries (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete restrict,
  entry_type  text not null check (entry_type in ('charge', 'payment', 'adjustment')),
  amount      numeric(12, 2) not null,
  order_id    uuid references public.orders (id) on delete set null,
  payment_id  uuid references public.payments (id) on delete set null,
  description text,
  created_at  timestamptz not null default now()
);

create index customer_ledger_business_id_idx on public.customer_ledger_entries (business_id);
create index customer_ledger_customer_id_idx on public.customer_ledger_entries (customer_id, created_at desc);

create view public.customer_debts
with (security_invoker = true) as
select
  business_id,
  customer_id,
  sum(
    case entry_type
      when 'charge' then amount
      when 'payment' then -amount
      else amount
    end
  ) as debt
from public.customer_ledger_entries
group by business_id, customer_id;

do $$
declare
  t text;
begin
  foreach t in array array[
    'orders', 'order_items', 'order_documents', 'payments', 'customer_ledger_entries'
  ]
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
