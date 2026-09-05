-- Fix: reporting a shortage where an item is fully missing sets its
-- quantity to 0, which violated order_items.quantity > 0 and failed with
-- "עדכון הפריטים נכשל". Allow 0 (order creation still requires > 0 in app
-- code); keep negatives out.
alter table public.order_items
  drop constraint if exists order_items_quantity_check;
alter table public.order_items
  add constraint order_items_quantity_check check (quantity >= 0);
