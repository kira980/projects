-- Stage 19: daily pay type, explicit driver permission, register balance,
-- takeaway order codes, and the new letter+2-digit order code format.

-- ── Workers: daily pay type + driver permission ──
-- A worker can now be paid per day worked (days × daily_rate).
alter table public.workers
  drop constraint if exists workers_pay_type_check;
alter table public.workers
  add constraint workers_pay_type_check
    check (pay_type in ('hourly', 'monthly', 'daily'));
alter table public.workers
  add column daily_rate numeric(10, 2) check (daily_rate >= 0);

-- Driver access becomes an explicit permission again. Backfilled true for
-- workers with a passcode so nobody who could drive yesterday is locked
-- out today — untick per worker in the dashboard.
alter table public.workers
  add column is_driver boolean not null default false;
update public.workers set is_driver = true where passcode_hash is not null;

-- ── Daily sales: what was left in the register at day end ──
alter table public.daily_sales
  add column left_in_register numeric(12, 2) check (left_in_register >= 0);

-- ── Takeaway (pickup) order codes: "T" + letter + 2 digits ──
create table public.takeaway_code_counters (
  business_id   uuid not null references public.businesses (id) on delete cascade,
  delivery_date date not null,
  next_seq      int not null default 1,
  primary key (business_id, delivery_date)
);

alter table public.takeaway_code_counters enable row level security;
create policy "business members full access"
  on public.takeaway_code_counters for all
  using (business_id = public.current_business_id())
  with check (business_id = public.current_business_id());

create or replace function public.take_takeaway_code_seq(
  p_business_id uuid,
  p_delivery_date date
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seq int;
begin
  insert into takeaway_code_counters (business_id, delivery_date, next_seq)
  values (p_business_id, p_delivery_date, 2)
  on conflict (business_id, delivery_date)
    do update set next_seq = takeaway_code_counters.next_seq + 1
  returning next_seq - 1 into v_seq;
  return v_seq;
end;
$$;

-- ── New order-code format ──
-- Deliveries: "A01".."A99", "B01".. (99 per letter). Takeaway: same with a
-- leading "T" ("TA01"). The code is now the order's public number.
create or replace function public.format_order_code(p_seq int, p_takeaway boolean)
returns text
language sql
immutable
as $$
  select case when p_takeaway then 'T' else '' end
    || chr(65 + (p_seq - 1) / 99)
    || lpad((((p_seq - 1) % 99) + 1)::text, 2, '0');
$$;

-- create_order_admin: same as migration 0014, but delivery codes use the
-- new letter+2-digit format and pickup (takeaway) orders get a T-code.
create or replace function public.create_order_admin(
  p_customer_id      uuid,
  p_delivery_type    text,
  p_delivery_date    date,
  p_delivery_time    text,
  p_address_text     text,
  p_notes            text,
  p_notes_for_baker  text,
  p_notes_for_driver text,
  p_items            jsonb,   -- [{"product_id": uuid, "quantity": n, "notes": ""}]
  p_actor_id         uuid,
  p_actor_name       text
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare
  v_business_id  uuid := public.current_business_id();
  v_is_delivery  boolean := coalesce(p_delivery_type, 'delivery') <> 'pickup';
  v_order_number bigint;
  v_code_seq     int;
  v_delivery_code text;
  v_public_id    text;
  v_order_id     uuid;
  v_total        numeric(12, 2);
  v_item_count   int;
begin
  if v_business_id is null then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;

  if exists (
    select 1 from day_locks
    where business_id = v_business_id
      and lock_date = (now() at time zone 'Asia/Jerusalem')::date
      and is_locked
  ) then
    raise exception 'DAY_LOCKED';
  end if;

  select count(*) into v_item_count
  from jsonb_to_recordset(p_items)
         as it(product_id uuid, quantity numeric, notes text)
  where it.quantity > 0;
  if v_item_count = 0 then
    raise exception 'NO_ITEMS';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_items)
           as it(product_id uuid, quantity numeric, notes text)
    left join products p
      on p.id = it.product_id
     and p.business_id = v_business_id
     and p.is_active
    where it.quantity > 0
      and p.id is null
  ) then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;

  select round(coalesce(sum(
           round(coalesce(cpp.price, p.default_price) * it.quantity, 2)
         ), 0), 2)
  into v_total
  from jsonb_to_recordset(p_items)
         as it(product_id uuid, quantity numeric, notes text)
  join products p
    on p.id = it.product_id
   and p.business_id = v_business_id
   and p.is_active
  left join customer_product_prices cpp
    on cpp.business_id = v_business_id
   and cpp.customer_id = p_customer_id
   and cpp.product_id = p.id
  where it.quantity > 0;

  v_order_number := public.take_order_number(v_business_id);
  if v_is_delivery then
    v_code_seq := public.take_delivery_code_seq(v_business_id, p_delivery_date);
    if v_code_seq is not null then
      v_delivery_code := public.format_order_code(v_code_seq, false);
    end if;
    v_public_id := public.format_delivery_public_id(
      public.take_delivery_public_seq(v_business_id)
    );
  else
    v_code_seq := public.take_takeaway_code_seq(v_business_id, p_delivery_date);
    if v_code_seq is not null then
      v_delivery_code := public.format_order_code(v_code_seq, true);
    end if;
  end if;

  insert into orders (
    business_id, customer_id, order_number, delivery_type, delivery_code,
    public_delivery_id, delivery_date, delivery_time, address_text,
    total, original_total, updated_total,
    notes, notes_for_baker, notes_for_driver,
    created_by_type, created_by_id
  ) values (
    v_business_id, p_customer_id, v_order_number,
    case when v_is_delivery then 'delivery' else 'pickup' end,
    v_delivery_code, v_public_id, p_delivery_date,
    nullif(trim(coalesce(p_delivery_time, '')), ''),
    nullif(trim(coalesce(p_address_text, '')), ''),
    v_total, v_total, v_total,
    nullif(trim(coalesce(p_notes, '')), ''),
    nullif(trim(coalesce(p_notes_for_baker, '')), ''),
    nullif(trim(coalesce(p_notes_for_driver, '')), ''),
    'admin', p_actor_id
  )
  returning id into v_order_id;

  insert into order_items (
    business_id, order_id, product_id, product_name, unit_type,
    quantity, unit_price, line_total, notes
  )
  select
    v_business_id, v_order_id, p.id, p.name, p.unit_type,
    it.quantity,
    coalesce(cpp.price, p.default_price),
    round(coalesce(cpp.price, p.default_price) * it.quantity, 2),
    nullif(trim(coalesce(it.notes, '')), '')
  from jsonb_to_recordset(p_items)
         as it(product_id uuid, quantity numeric, notes text)
  join products p
    on p.id = it.product_id
   and p.business_id = v_business_id
   and p.is_active
  left join customer_product_prices cpp
    on cpp.business_id = v_business_id
   and cpp.customer_id = p_customer_id
   and cpp.product_id = p.id
  where it.quantity > 0;

  insert into customer_ledger_entries (
    business_id, customer_id, entry_type, amount, order_id, description
  ) values (
    v_business_id, p_customer_id, 'charge', v_total, v_order_id,
    'הזמנה #' || v_order_number
  );

  insert into audit_logs (
    business_id, actor_type, actor_id, actor_name,
    action, entity_type, entity_id, details
  ) values (
    v_business_id, 'admin', p_actor_id, p_actor_name,
    'order.create', 'order', v_order_id,
    jsonb_build_object(
      'order_number', v_order_number,
      'total', v_total,
      'items', v_item_count
    )
  );

  return jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number
  );
end;
$$;
