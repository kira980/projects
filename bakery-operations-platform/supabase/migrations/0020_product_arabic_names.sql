-- Stage 20: Arabic product names.
--
-- Products get an Arabic name (name_ar) so the production (baker) screen —
-- which the bakers read in Arabic — can show items in Arabic. Order items
-- snapshot the Arabic name at order time, same as the Hebrew name, so
-- historical orders never shift when the catalog changes.

alter table public.products
  add column if not exists name_ar text not null default '';

alter table public.order_items
  add column if not exists product_name_ar text;

-- Menu compat views: expose the real Arabic name (fall back to the Hebrew
-- name), and let the editor persist it.
create or replace view public.menu_items
  with (security_invoker = true) as
  select
    id,
    business_id                    as restaurant_id,
    category_id,
    coalesce(nullif(name_ar, ''), name) as name_ar,
    name                           as name_en,
    name                           as name_he,
    menu_description               as description_ar,
    menu_description               as description_en,
    menu_description               as description_he,
    default_price                  as price,
    menu_price_label               as price_label,
    menu_image_url                 as image_url,
    menu_image_fit                 as image_fit,
    menu_image_zoom                as image_zoom,
    menu_image_pos_x               as image_pos_x,
    menu_image_pos_y               as image_pos_y,
    available_for_online_ordering  as is_available,
    sort_order,
    created_at
  from public.products
  where is_active = true;
grant select, insert, update, delete on public.menu_items to authenticated;
grant select on public.menu_items to anon;

create or replace function public.menu_items_insert()
returns trigger language plpgsql security invoker
set search_path = public as $$
declare v_id uuid;
begin
  insert into public.products (
    business_id, category_id, name, name_ar, unit_type, default_price,
    menu_description, menu_price_label, menu_image_url,
    menu_image_fit, menu_image_zoom, menu_image_pos_x, menu_image_pos_y,
    available_for_online_ordering, sort_order, is_active
  ) values (
    new.restaurant_id, new.category_id,
    coalesce(nullif(trim(new.name_he), ''), new.name_ar, ''),
    coalesce(new.name_ar, ''),
    'unit',
    coalesce(new.price, 0),
    coalesce(new.description_he, ''),
    coalesce(new.price_label, ''),
    coalesce(new.image_url, ''),
    coalesce(new.image_fit, 'cover'),
    coalesce(new.image_zoom, 100),
    coalesce(new.image_pos_x, 50),
    coalesce(new.image_pos_y, 50),
    coalesce(new.is_available, true),
    coalesce(new.sort_order, 0),
    true
  )
  returning id into v_id;
  new.id := v_id;
  return new;
end $$;

create or replace function public.menu_items_update()
returns trigger language plpgsql security invoker
set search_path = public as $$
begin
  update public.products set
    category_id      = new.category_id,
    name             = coalesce(nullif(trim(new.name_he), ''), new.name_ar, name),
    name_ar          = coalesce(new.name_ar, name_ar),
    default_price    = coalesce(new.price, default_price),
    menu_description = coalesce(new.description_he, menu_description),
    menu_price_label = coalesce(new.price_label, menu_price_label),
    menu_image_url   = coalesce(new.image_url, menu_image_url),
    menu_image_fit   = coalesce(new.image_fit, menu_image_fit),
    menu_image_zoom  = coalesce(new.image_zoom, menu_image_zoom),
    menu_image_pos_x = coalesce(new.image_pos_x, menu_image_pos_x),
    menu_image_pos_y = coalesce(new.image_pos_y, menu_image_pos_y),
    available_for_online_ordering = coalesce(new.is_available, available_for_online_ordering),
    sort_order       = coalesce(new.sort_order, sort_order)
  where id = old.id;
  return new;
end $$;

-- create_order_admin: snapshot the Arabic name into order_items alongside
-- the Hebrew one. Identical to migration 0019 otherwise.
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

notify pgrst, 'reload schema';
