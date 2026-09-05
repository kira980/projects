-- Stage 16: public delivery IDs, production shortages, multi-order debt
-- payments, and richer worker advances.
--
-- Preserves existing data: all new columns are nullable or defaulted, and
-- existing rows are backfilled below.

-- ============================================================
-- 1. Public delivery ID  (human-readable, unique per business)
--    Shown to customers/drivers/admin. One per delivery-type order.
--    Format: "D-000123".
-- ============================================================
alter table public.businesses
  add column next_delivery_public_seq bigint not null default 1;

create or replace function public.take_delivery_public_seq(p_business_id uuid)
returns bigint
language sql
volatile
security definer
set search_path = public
as $$
  update public.businesses
  set next_delivery_public_seq = next_delivery_public_seq + 1
  where id = p_business_id
  returning next_delivery_public_seq - 1
$$;

create or replace function public.format_delivery_public_id(p_seq bigint)
returns text
language sql
immutable
as $$
  select 'D-' || lpad(p_seq::text, 6, '0')
$$;

alter table public.orders add column public_delivery_id text;

-- Backfill existing delivery-type orders in stable creation order.
do $$
declare
  r record;
  v_seq bigint;
begin
  for r in
    select id, business_id
    from public.orders
    where delivery_type = 'delivery' and public_delivery_id is null
    order by business_id, order_number
  loop
    v_seq := public.take_delivery_public_seq(r.business_id);
    update public.orders
    set public_delivery_id = public.format_delivery_public_id(v_seq)
    where id = r.id;
  end loop;
end;
$$;

-- Unique per business + fast search.
create unique index orders_public_delivery_id_uidx
  on public.orders (business_id, public_delivery_id)
  where public_delivery_id is not null;
create index orders_public_delivery_id_search_idx
  on public.orders (public_delivery_id text_pattern_ops);

-- ============================================================
-- 2. Production shortages  (ناقص)
-- ============================================================
alter table public.order_items
  add column original_quantity numeric(10, 2),
  add column prepared_quantity numeric(10, 2),
  add column missing_quantity  numeric(10, 2) not null default 0,
  add column shortage_note      text;

-- Existing items had no shortage: original = ordered, prepared = ordered.
update public.order_items
set original_quantity = quantity,
    prepared_quantity = quantity,
    missing_quantity = 0
where original_quantity is null;

alter table public.orders
  add column original_total numeric(12, 2),
  add column updated_total  numeric(12, 2),
  add column shortage_note   text,
  add column has_shortage    boolean not null default false;

update public.orders
set original_total = total,
    updated_total = total
where original_total is null;

-- Allow the production shortage status on orders.
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in (
    'new', 'preparing', 'ready', 'delivering', 'delivered',
    'problem', 'cancelled', 'shortage'
  ));

-- ============================================================
-- 3. Multi-order debt payments  (one payment -> many orders)
-- ============================================================
create table public.payment_allocations (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  payment_id  uuid not null references public.payments (id) on delete cascade,
  order_id    uuid not null references public.orders (id) on delete cascade,
  amount      numeric(12, 2) not null check (amount > 0),
  created_at  timestamptz not null default now(),
  unique (payment_id, order_id)
);

create index payment_allocations_business_id_idx on public.payment_allocations (business_id);
create index payment_allocations_payment_id_idx on public.payment_allocations (payment_id);
create index payment_allocations_order_id_idx on public.payment_allocations (order_id);

alter table public.payment_allocations enable row level security;
create policy "business members full access"
  on public.payment_allocations for all
  using (business_id = public.current_business_id())
  with check (business_id = public.current_business_id());

-- ============================================================
-- 4. Richer worker advances
--    given-by shift manager + how the worker was selected.
-- ============================================================
alter table public.worker_advances
  add column given_by_worker_id uuid references public.workers (id) on delete set null,
  add column worker_source text not null default 'self'
    check (worker_source in ('self', 'shift', 'other'));

create index worker_advances_given_by_idx
  on public.worker_advances (given_by_worker_id);
