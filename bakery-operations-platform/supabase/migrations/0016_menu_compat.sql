-- Stage 20: run the ported restaurant menu + admin-easy pages UNCHANGED.
--
-- public/menu/index.html and admin-easy.html query a restaurant-style
-- schema (restaurant / categories / menu_items / settings, multilingual
-- columns, image positioning). Rather than edit those files, this migration
-- makes THIS database present that shape as views over the real
-- products / product_categories / businesses, with triggers so the
-- editor's writes land on the real products. One source of truth: the menu
-- shows exactly the dashboard's items.

-- ── 1. Columns to preserve menu-only attributes on the real tables ───────
alter table public.products
  add column if not exists menu_description  text          not null default '',
  add column if not exists menu_image_url    text          not null default '',
  add column if not exists menu_price_label  text          not null default '',
  add column if not exists menu_image_fit    text          not null default 'cover',
  add column if not exists menu_image_zoom   numeric(5,2)  not null default 100,
  add column if not exists menu_image_pos_x  numeric(5,2)  not null default 50,
  add column if not exists menu_image_pos_y  numeric(5,2)  not null default 50;

alter table public.product_categories
  add column if not exists menu_note text not null default '',
  add column if not exists menu_tag  text not null default '';

-- ── 2. Admin login: resolve a username to an admin's email ───────────────
-- admin-easy calls admin_email_for_username then signInWithPassword. Here a
-- username IS the admin's email (an active profile). Reuses Supabase Auth.
create or replace function public.admin_email_for_username(login_username text)
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select u.email
  from auth.users u
  join public.profiles p on p.id = u.id
  where lower(u.email) = lower(trim(login_username))
    and p.is_active
  limit 1;
$$;
revoke all on function public.admin_email_for_username(text) from public;
grant execute on function public.admin_email_for_username(text) to anon, authenticated;

-- ── 2b. Anonymous read of online items (the public menu loads with the
--        anon key). Scoped to `anon` only, so it does not widen what a
--        logged-in admin of one business can see of another.
drop policy if exists "menu public read products" on public.products;
create policy "menu public read products" on public.products
  for select to anon
  using (available_for_online_ordering and is_active);

drop policy if exists "menu public read categories" on public.product_categories;
create policy "menu public read categories" on public.product_categories
  for select to anon
  using (is_active);

-- ── 3. restaurant  →  businesses (read-only, safe columns only) ──────────
-- Definer view: the pages read name/slug for the header. `settings` jsonb is
-- never exposed. slug = id so links use ?id=<business_id>.
create or replace view public.restaurant as
  select
    id,
    name,
    id::text                       as slug,
    '/menu/index.html?id=' || id   as menu_url,
    true                           as is_active,
    coalesce(logo_url, '')         as logo_url
  from public.businesses;
grant select on public.restaurant to anon, authenticated;

-- ── 4. settings  →  empty (menu offers not used yet) ─────────────────────
create or replace view public.settings as
  select
    b.id       as restaurant_id,
    ''::text   as key,
    '{}'::jsonb as value
  from public.businesses b
  where false;
grant select on public.settings to anon, authenticated;

-- ── 5. categories  →  product_categories (security_invoker: RLS applies) ─
create or replace view public.categories
  with (security_invoker = true) as
  select
    id,
    name        as name_ar,
    name        as name_en,
    name        as name_he,
    menu_note   as note_ar,
    menu_note   as note_en,
    menu_note   as note_he,
    menu_tag    as tag,
    sort_order,
    is_active,
    business_id as restaurant_id,
    created_at
  from public.product_categories
  where is_active = true;
grant select, insert, update, delete on public.categories to authenticated;
grant select on public.categories to anon;

create or replace function public.categories_insert()
returns trigger language plpgsql security invoker
set search_path = public as $$
declare v_id uuid;
begin
  insert into public.product_categories (business_id, name, menu_note, menu_tag, sort_order, is_active)
  values (
    new.restaurant_id,
    coalesce(nullif(trim(new.name_he), ''), new.name_ar, ''),
    coalesce(new.note_he, ''),
    coalesce(new.tag, ''),
    coalesce(new.sort_order, 0),
    coalesce(new.is_active, true)
  )
  returning id into v_id;
  new.id := v_id;
  return new;
end $$;
create trigger categories_insert_trg instead of insert on public.categories
  for each row execute function public.categories_insert();

create or replace function public.categories_update()
returns trigger language plpgsql security invoker
set search_path = public as $$
begin
  update public.product_categories set
    name      = coalesce(nullif(trim(new.name_he), ''), new.name_ar, name),
    menu_note = coalesce(new.note_he, menu_note),
    menu_tag  = coalesce(new.tag, menu_tag),
    sort_order = coalesce(new.sort_order, sort_order)
  where id = old.id;
  return new;
end $$;
create trigger categories_update_trg instead of update on public.categories
  for each row execute function public.categories_update();

-- Delete from the editor = hide from the menu (soft delete), so existing
-- orders and product history are never destroyed.
create or replace function public.categories_delete()
returns trigger language plpgsql security invoker
set search_path = public as $$
begin
  update public.product_categories set is_active = false where id = old.id;
  return old;
end $$;
create trigger categories_delete_trg instead of delete on public.categories
  for each row execute function public.categories_delete();

-- ── 6. menu_items  →  products (security_invoker: RLS applies) ───────────
create or replace view public.menu_items
  with (security_invoker = true) as
  select
    id,
    business_id                    as restaurant_id,
    category_id,
    name                           as name_ar,
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
    business_id, category_id, name, unit_type, default_price,
    menu_description, menu_price_label, menu_image_url,
    menu_image_fit, menu_image_zoom, menu_image_pos_x, menu_image_pos_y,
    available_for_online_ordering, sort_order, is_active
  ) values (
    new.restaurant_id, new.category_id,
    coalesce(nullif(trim(new.name_he), ''), new.name_ar, ''),
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
create trigger menu_items_insert_trg instead of insert on public.menu_items
  for each row execute function public.menu_items_insert();

create or replace function public.menu_items_update()
returns trigger language plpgsql security invoker
set search_path = public as $$
begin
  update public.products set
    category_id      = new.category_id,
    name             = coalesce(nullif(trim(new.name_he), ''), new.name_ar, name),
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
create trigger menu_items_update_trg instead of update on public.menu_items
  for each row execute function public.menu_items_update();

create or replace function public.menu_items_delete()
returns trigger language plpgsql security invoker
set search_path = public as $$
begin
  -- Soft delete: hide from menu and dashboard-active list, keep the row so
  -- order history stays intact.
  update public.products
    set is_active = false, available_for_online_ordering = false
  where id = old.id;
  return old;
end $$;
create trigger menu_items_delete_trg instead of delete on public.menu_items
  for each row execute function public.menu_items_delete();

-- ── 7. Public `images` bucket (the editor uploads here) ──────────────────
insert into storage.buckets (id, name, public)
values ('images', 'images', true)
on conflict (id) do nothing;
update storage.buckets
set public = true,
    file_size_limit = 2097152,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'images';

drop policy if exists "menu images public read" on storage.objects;
create policy "menu images public read" on storage.objects
  for select using (bucket_id = 'images');
drop policy if exists "menu images admin insert" on storage.objects;
create policy "menu images admin insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'images');
drop policy if exists "menu images admin update" on storage.objects;
create policy "menu images admin update" on storage.objects
  for update to authenticated using (bucket_id = 'images') with check (bucket_id = 'images');
drop policy if exists "menu images admin delete" on storage.objects;
create policy "menu images admin delete" on storage.objects
  for delete to authenticated using (bucket_id = 'images');

notify pgrst, 'reload schema';
