-- Stage 2: core business tables, audit log, day locks, RLS.

-- ============================================================
-- Workers (kiosk / production / driver users — passcode login,
-- not Supabase Auth). Passcodes are bcrypt-hashed server-side.
-- ============================================================
create table public.workers (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references public.businesses (id) on delete cascade,
  full_name         text not null,
  phone             text,
  passcode_hash     text,
  hourly_rate       numeric(10, 2),
  can_manage_shift  boolean not null default false,
  is_driver         boolean not null default false,
  is_baker          boolean not null default false,
  notes             text,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index workers_business_id_idx on public.workers (business_id);
create index workers_active_idx on public.workers (business_id, is_active);

create trigger workers_updated_at
  before update on public.workers
  for each row execute function public.set_updated_at();

-- ============================================================
-- Customers + future online-ordering portal scaffolding
-- ============================================================
create table public.customers (
  id                   uuid primary key default gen_random_uuid(),
  business_id          uuid not null references public.businesses (id) on delete cascade,
  name                 text not null,
  phone                text,
  customer_type        text not null default 'business' check (customer_type in ('business', 'private')),
  payment_terms        text not null default 'immediate' check (payment_terms in ('immediate', 'monthly', 'custom')),
  notes                text,
  can_order_online     boolean not null default false,
  show_debt_in_portal  boolean not null default false,
  is_active            boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index customers_business_id_idx on public.customers (business_id);
create index customers_active_idx on public.customers (business_id, is_active);

create trigger customers_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

-- Links a customer to a Supabase Auth user for the future portal.
create table public.customer_users (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses (id) on delete cascade,
  customer_id   uuid not null references public.customers (id) on delete cascade,
  auth_user_id  uuid unique references auth.users (id) on delete cascade,
  phone         text,
  is_active     boolean not null default true,
  last_login_at timestamptz,
  created_at    timestamptz not null default now()
);

create index customer_users_business_id_idx on public.customer_users (business_id);
create index customer_users_customer_id_idx on public.customer_users (customer_id);

create table public.customer_addresses (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses (id) on delete cascade,
  customer_id   uuid not null references public.customers (id) on delete cascade,
  label         text,
  address_text  text not null,
  city          text,
  area          text,
  latitude      double precision,
  longitude     double precision,
  is_default    boolean not null default false,
  notes         text,
  created_at    timestamptz not null default now()
);

create index customer_addresses_business_id_idx on public.customer_addresses (business_id);
create index customer_addresses_customer_id_idx on public.customer_addresses (customer_id);

-- ============================================================
-- Products / menu + customer-specific prices
-- ============================================================
create table public.product_categories (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name        text not null,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create index product_categories_business_id_idx on public.product_categories (business_id);

create table public.products (
  id                            uuid primary key default gen_random_uuid(),
  business_id                   uuid not null references public.businesses (id) on delete cascade,
  category_id                   uuid references public.product_categories (id) on delete set null,
  name                          text not null,
  unit_type                     text not null default 'unit' check (unit_type in ('unit', 'kg', 'tray', 'box', 'package')),
  default_price                 numeric(10, 2) not null default 0,
  sort_order                    integer not null default 0,
  available_for_online_ordering boolean not null default false,
  is_active                     boolean not null default true,
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now()
);

create index products_business_id_idx on public.products (business_id);
create index products_category_id_idx on public.products (category_id);
create index products_active_idx on public.products (business_id, is_active);

create trigger products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- Customer-specific price and availability. When creating an order:
-- use this price if a row exists, otherwise products.default_price.
-- The chosen price is snapshotted into order_items (Stage 10).
create table public.customer_product_prices (
  id                       uuid primary key default gen_random_uuid(),
  business_id              uuid not null references public.businesses (id) on delete cascade,
  customer_id              uuid not null references public.customers (id) on delete cascade,
  product_id               uuid not null references public.products (id) on delete cascade,
  price                    numeric(10, 2) not null,
  is_available_to_customer boolean not null default true,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (customer_id, product_id)
);

create index customer_product_prices_business_id_idx on public.customer_product_prices (business_id);
create index customer_product_prices_customer_id_idx on public.customer_product_prices (customer_id);
create index customer_product_prices_product_id_idx on public.customer_product_prices (product_id);

create trigger customer_product_prices_updated_at
  before update on public.customer_product_prices
  for each row execute function public.set_updated_at();

-- ============================================================
-- Vendors
-- ============================================================
create table public.vendors (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  name         text not null,
  phone        text,
  contact_name text,
  notes        text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index vendors_business_id_idx on public.vendors (business_id);

create trigger vendors_updated_at
  before update on public.vendors
  for each row execute function public.set_updated_at();

-- ============================================================
-- Daily sales + day locks
-- ============================================================
create table public.daily_sales (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  sales_date  date not null,
  cash_total  numeric(12, 2) not null default 0,
  card_total  numeric(12, 2) not null default 0,
  other_total numeric(12, 2) not null default 0,
  notes       text,
  created_by  uuid references public.profiles (id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (business_id, sales_date)
);

create index daily_sales_business_date_idx on public.daily_sales (business_id, sales_date);

create trigger daily_sales_updated_at
  before update on public.daily_sales
  for each row execute function public.set_updated_at();

-- A locked day blocks all financial writes dated to that day.
create table public.day_locks (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  lock_date   date not null,
  is_locked   boolean not null default true,
  locked_by   uuid references public.profiles (id),
  locked_at   timestamptz not null default now(),
  reopened_by uuid references public.profiles (id),
  reopened_at timestamptz,
  unique (business_id, lock_date)
);

create index day_locks_business_date_idx on public.day_locks (business_id, lock_date);

-- ============================================================
-- Audit log — append-only record of every important action.
-- actor: admin (profile), worker (kiosk/driver/baker) or system.
-- affected_worker_id: set when a shift manager acts on another worker.
-- ============================================================
create table public.audit_logs (
  id                 uuid primary key default gen_random_uuid(),
  business_id        uuid not null references public.businesses (id) on delete cascade,
  actor_type         text not null check (actor_type in ('admin', 'worker', 'customer', 'system')),
  actor_id           uuid,
  actor_name         text not null,
  affected_worker_id uuid references public.workers (id),
  action             text not null,
  entity_type        text,
  entity_id          uuid,
  details            jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now()
);

create index audit_logs_business_id_idx on public.audit_logs (business_id);
create index audit_logs_created_at_idx on public.audit_logs (business_id, created_at desc);
create index audit_logs_action_idx on public.audit_logs (business_id, action);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);

-- ============================================================
-- Uploaded files registry (receipts, proofs, documents)
-- ============================================================
create table public.uploaded_files (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references public.businesses (id) on delete cascade,
  bucket           text not null check (bucket in ('receipts', 'proofs', 'documents')),
  path             text not null,
  entity_type      text,
  entity_id        uuid,
  uploaded_by_type text not null check (uploaded_by_type in ('admin', 'worker', 'system')),
  uploaded_by_id   uuid,
  created_at       timestamptz not null default now()
);

create index uploaded_files_business_id_idx on public.uploaded_files (business_id);
create index uploaded_files_entity_idx on public.uploaded_files (entity_type, entity_id);

-- ============================================================
-- RLS: admins/managers get full access to rows of their business.
-- Kiosk / production / driver flows run through server-only
-- service-role actions and bypass RLS deliberately.
-- ============================================================
do $$
declare
  t text;
begin
  foreach t in array array[
    'workers', 'customers', 'customer_users', 'customer_addresses',
    'product_categories', 'products', 'customer_product_prices',
    'vendors', 'daily_sales', 'day_locks', 'audit_logs', 'uploaded_files'
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

-- Audit logs are append-only even for admins.
drop policy "business members full access" on public.audit_logs;
create policy "business members read audit"
  on public.audit_logs for select
  using (business_id = public.current_business_id());
create policy "business members insert audit"
  on public.audit_logs for insert
  with check (business_id = public.current_business_id());

-- ============================================================
-- checkDayIsOpen helper (also enforced in app code)
-- ============================================================
create or replace function public.is_day_open(p_business_id uuid, p_date date)
returns boolean
language sql
stable
as $$
  select not exists (
    select 1 from public.day_locks
    where business_id = p_business_id
      and lock_date = p_date
      and is_locked
  )
$$;

-- ============================================================
-- Effective price for a customer+product: customer-specific
-- price if present, otherwise the product default. Reused later
-- by the online ordering portal.
-- ============================================================
create or replace function public.get_customer_product_price(
  p_customer_id uuid,
  p_product_id uuid
)
returns numeric
language sql
stable
as $$
  select coalesce(
    (select price from public.customer_product_prices
      where customer_id = p_customer_id and product_id = p_product_id),
    (select default_price from public.products where id = p_product_id)
  )
$$;
