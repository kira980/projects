-- Stage 13: delivery batches and driver collection.

create table public.deliveries (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references public.businesses (id) on delete cascade,
  driver_worker_id uuid not null references public.workers (id) on delete restrict,
  delivery_date    date not null,
  status           text not null default 'assigned' check (status in ('assigned', 'in_progress', 'done')),
  notes            text,
  created_by       uuid,
  created_at       timestamptz not null default now()
);

create index deliveries_business_id_idx on public.deliveries (business_id);
create index deliveries_driver_idx on public.deliveries (driver_worker_id, delivery_date desc);
create index deliveries_date_idx on public.deliveries (business_id, delivery_date desc);
create index deliveries_status_idx on public.deliveries (business_id, status);

create table public.delivery_orders (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references public.businesses (id) on delete cascade,
  delivery_id      uuid not null references public.deliveries (id) on delete cascade,
  order_id         uuid not null references public.orders (id) on delete cascade,
  sort_order       integer not null default 0,
  status           text not null default 'pending'
    check (status in ('pending', 'delivered_paid', 'delivered_unpaid', 'partial', 'failed')),
  collected_amount numeric(12, 2) not null default 0,
  payment_method   text check (payment_method in ('cash', 'card', 'transfer', 'check', 'other')),
  proof_file_path  text,
  driver_notes     text,
  completed_at     timestamptz,
  created_at       timestamptz not null default now(),
  unique (delivery_id, order_id)
);

create index delivery_orders_business_id_idx on public.delivery_orders (business_id);
create index delivery_orders_delivery_id_idx on public.delivery_orders (delivery_id);
create index delivery_orders_order_id_idx on public.delivery_orders (order_id);
create index delivery_orders_status_idx on public.delivery_orders (business_id, status);

do $$
declare
  t text;
begin
  foreach t in array array['deliveries', 'delivery_orders']
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
