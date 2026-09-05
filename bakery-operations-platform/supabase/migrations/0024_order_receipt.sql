-- Stage 24: "קבלה" (receipt) flag on customers and orders.
--
-- A customer can be marked as receipt-issuing: their orders default to being
-- documented with a קבלה + תעודת משלוח. Each order carries its own receipt
-- flag (defaulted from the customer at creation, overridable per order), and
-- only orders with receipt = true may issue a receipt / delivery note.

alter table public.customers
  add column if not exists receipt boolean not null default false;

alter table public.orders
  add column if not exists receipt boolean not null default false;

-- create_order_admin gains p_receipt (defaults false). Drop the old
-- signature first so we replace rather than overload it (avoids PostgREST
-- "could not choose best candidate" ambiguity).
drop function if exists public.create_order_admin(
  uuid, text, date, text, text, text, text, text, jsonb, uuid, text
);

create or replace function public.create_order_admin(
  p_customer_id      uuid,
  p_delivery_type    text,
  p_delivery_date    date,
  p_delivery_time    text,
  p_address_text     text,
  p_notes            text,
  p_notes_for_baker  text,
  p_notes_for_driver text,
  p_items            jsonb,
  p_actor_id         uuid,
  p_actor_name       text,
  p_receipt          boolean default false
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
    notes, notes_for_baker, notes_for_driver, receipt,
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
    coalesce(p_receipt, false),
    'admin', p_actor_id
  )
  returning id into v_order_id;

  insert into order_items (
    business_id, order_id, product_id, product_name, product_name_ar, unit_type,
    quantity, unit_price, line_total, notes
  )
  select
    v_business_id, v_order_id, p.id, p.name,
    nullif(p.name_ar, ''), p.unit_type,
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
