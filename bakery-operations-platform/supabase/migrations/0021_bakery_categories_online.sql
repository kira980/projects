-- Stage 21: bakery category schema + "online = active" (SCHEMA ONLY).
--
-- 1. Categories gain an Arabic name (name_ar) for the baker/menu side.
-- 2. Online availability follows is_active: every active item is online;
--    deactivating an item is the only way to hide it. The separate
--    "available for online ordering" flag is retired from the UI.
--
-- Data operations (creating the six bakery categories, attaching items,
-- and correcting the gvita transliteration on already-seeded rows) live in
-- supabase/one_off_bakery_categories.sql — run that once against the live
-- database. Migrations here stay schema-only so they cleanly rebuild the
-- structure.

-- ── 1. Category Arabic name ──────────────────────────────────────────────
alter table public.product_categories
  add column if not exists name_ar text not null default '';

-- Expose the real Arabic name in the categories compat view (fall back to
-- the Hebrew name). Column names/order are unchanged from migration 0016,
-- so create-or-replace is valid — only the name_ar expression differs.
create or replace view public.categories
  with (security_invoker = true) as
  select
    id,
    coalesce(nullif(name_ar, ''), name) as name_ar,
    name                                as name_en,
    name                                as name_he,
    menu_note                           as note_ar,
    menu_note                           as note_en,
    menu_note                           as note_he,
    menu_tag                            as tag,
    sort_order,
    is_active,
    business_id                         as restaurant_id,
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
  insert into public.product_categories (business_id, name, name_ar, menu_note, menu_tag, sort_order, is_active)
  values (
    new.restaurant_id,
    coalesce(nullif(trim(new.name_he), ''), new.name_ar, ''),
    coalesce(new.name_ar, ''),
    coalesce(new.note_he, ''),
    coalesce(new.tag, ''),
    coalesce(new.sort_order, 0),
    coalesce(new.is_active, true)
  )
  returning id into v_id;
  new.id := v_id;
  return new;
end $$;

create or replace function public.categories_update()
returns trigger language plpgsql security invoker
set search_path = public as $$
begin
  update public.product_categories set
    name       = coalesce(nullif(trim(new.name_he), ''), new.name_ar, name),
    name_ar    = coalesce(new.name_ar, name_ar),
    menu_note  = coalesce(new.note_he, menu_note),
    menu_tag   = coalesce(new.tag, menu_tag),
    sort_order = coalesce(new.sort_order, sort_order)
  where id = old.id;
  return new;
end $$;

-- ── 2. Online = active ───────────────────────────────────────────────────
-- New products are online by default; visibility is driven by is_active.
alter table public.products
  alter column available_for_online_ordering set default true;

-- The public menu (anon) now sees every active item, regardless of the
-- retired flag.
drop policy if exists "menu public read products" on public.products;
create policy "menu public read products" on public.products
  for select to anon
  using (is_active);

-- menu_items view already filters is_active = true, so every row it
-- returns is online — expose is_available as constant true.
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
    true                           as is_available,
    sort_order,
    created_at
  from public.products
  where is_active = true;
grant select, insert, update, delete on public.menu_items to authenticated;
grant select on public.menu_items to anon;

notify pgrst, 'reload schema';
