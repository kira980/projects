-- Stage 25: vendor category set reworked to match how the bakery buys.
--
-- Changes to the set from migration 0009:
--   מוצרי חלב  → מקרר      (renamed — the fridge shelf: dairy, נקניקים,
--                            and anything else that arrives refrigerated)
--   ניקיון     → dropped    (its vendors fall back to אחר)
--   סיגריות    → added
--   שמרים ועוגות → added
--
-- Schema only: the two updates below exist so an *existing* database can
-- satisfy the new constraint, and are no-ops on a fresh rebuild. Assigning
-- categories to specific vendors is data, and lives in
-- supabase/one_off_vendor_categories.sql.

alter table public.vendors
  drop constraint if exists vendors_category_check;

-- Carry existing rows onto the new set before it is enforced.
update public.vendors set category = 'מקרר' where category = 'מוצרי חלב';
update public.vendors set category = 'אחר'  where category = 'ניקיון';

alter table public.vendors
  add constraint vendors_category_check
    check (category in (
      'חומרי גלם', 'מקרר', 'אריזות', 'שתייה', 'סיגריות', 'שמרים ועוגות', 'אחר'
    ));

notify pgrst, 'reload schema';
