-- ═════════════════════════════════════════════════════════════════════════════
-- Booklyt — TEARDOWN
--
-- ⚠⚠  THIS PERMANENTLY DELETES ALL APPLICATION DATA AND ALL USER ACCOUNTS.  ⚠⚠
--     There is no undo. Read the whole header before running anything.
--
-- Purpose: return a project to a clean slate so 00000000000000_baseline.sql and
-- 00000000000001_seed.sql can build it from scratch. You need this because the
-- baseline uses CREATE TABLE IF NOT EXISTS — against existing tables it silently
-- skips them, so a drifted schema would survive untouched.
--
-- ── Consider not running this at all ────────────────────────────────────────
-- Spinning up a NEW Supabase project and running baseline + seed there is
-- strictly safer: zero risk to what is running now, and the old project stays as
-- a working rollback until you have switched NEXT_PUBLIC_SUPABASE_URL,
-- NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY and verified the
-- new one. Only use this file if you specifically want to reuse the same project
-- ref (because it is wired into deploys, custom domains, or the mobile apps).
--
-- ── Backups ─────────────────────────────────────────────────────────────────
-- Dashboard backups and PITR are paid-plan features. On the free tier your
-- backup is 00000000000001_seed.sql, which holds every application row from this
-- project, verified table by table. Nothing in the public schema is lost by
-- running this file, because the seed puts all of it back.
--
-- The one thing the seed CANNOT restore is auth passwords — bcrypt hashes are
-- deliberately not stored in it. Which is why Section 3 is disabled by default.
--
-- ── What this deletes ───────────────────────────────────────────────────────
--   • all 22 public tables and their data   (restored by the seed)
--   • the 4 application functions and the auth.users signup trigger
--   • the business-media storage bucket and its contents  (it is empty)
--   • the recorded migration history
--   • auth.users — ONLY if you opt in to Section 3, which is off by default
--
-- ── What this deliberately leaves alone ─────────────────────────────────────
-- It drops named objects rather than running `drop schema public cascade`, on
-- purpose. The Supabase-managed function public.rls_auto_enable() also lives in
-- the public schema and backs the `ensure_rls` event trigger; dropping the
-- schema takes it out and breaks new-table RLS enforcement project-wide.
-- Also untouched: the auth / storage / extensions schemas and their config,
-- and the pgcrypto + uuid-ossp extensions.
-- ═════════════════════════════════════════════════════════════════════════════


-- ═════════════════════════════════════════════════════════════════════════════
-- SAFETY STOP — delete this block to arm the script.
-- ═════════════════════════════════════════════════════════════════════════════
do $$
begin
  raise exception
    'SAFETY STOP: this deletes all data and all logins. Take a backup, then delete this block to arm the script.';
end $$;


-- ═════════════════════════════════════════════════════════════════════════════
-- DRY RUN — run this on its own first to see exactly what is about to go.
-- ═════════════════════════════════════════════════════════════════════════════
-- select
--   (select count(*) from auth.users)                       as auth_users_to_delete,
--   (select count(*) from public.businesses)                as businesses,
--   (select count(*) from public.appointments)              as appointments,
--   (select count(*) from public.customers)                 as customers,
--   (select count(*) from public.tenant_experience_configs) as builder_configs,
--   (select count(*) from storage.objects
--      where bucket_id = 'business-media')                  as storage_objects;


begin;

-- ═════════════════════════════════════════════════════════════════════════════
-- 1. APPLICATION TABLES
--
-- One statement so ordering and inter-table foreign keys do not matter. CASCADE
-- also removes the policies, indexes and the trg_set_business_code trigger that
-- hang off these tables.
-- ═════════════════════════════════════════════════════════════════════════════

drop table if exists
  public.appointment_events,
  public.appointments,
  public.business_announcements,
  public.businesses,
  public.customer_businesses,
  public.customer_devices,
  public.customer_notifications,
  public.customer_sessions,
  public.customer_user_sessions,
  public.customer_users,
  public.customers,
  public.device_push_tokens,
  public.phone_otps,
  public.profiles,
  public.push_subscriptions,
  public.services,
  public.staff_members,
  public.tenant_experience_configs,
  public.wa_message_log,
  public.waitlist_entries,
  public.working_hour_breaks,
  public.working_hours
cascade;


-- ═════════════════════════════════════════════════════════════════════════════
-- 2. APPLICATION FUNCTIONS
--
-- public.rls_auto_enable() is NOT in this list. It is Supabase's, not ours.
-- ═════════════════════════════════════════════════════════════════════════════

-- Dropping a trigger on auth.users needs ownership of that table, which not
-- every connection role has. Guarded so the teardown does not abort if it fails.
do $$
begin
  drop trigger if exists on_auth_user_created on auth.users;
exception
  when insufficient_privilege then
    raise notice 'could not drop on_auth_user_created (insufficient privilege on auth.users) — drop it from the dashboard if it exists';
end $$;

drop function if exists public.handle_new_user()          cascade;
drop function if exists public.ensure_profile(text)       cascade;
drop function if exists public.set_business_code()        cascade;
drop function if exists public.generate_business_code()   cascade;
drop function if exists public.cleanup_expired_otps()     cascade;


-- ═════════════════════════════════════════════════════════════════════════════
-- 3. AUTH USERS  —  DISABLED BY DEFAULT. Leave it that way.
--
-- Keeping the accounts is the right choice on the free tier, where you cannot
-- take a real backup: passwords are bcrypt hashes that the seed does not carry,
-- so deleting them is the one genuinely irreversible thing in this file.
--
-- Keeping them costs you nothing. Every table that references auth.users is
-- dropped and rebuilt regardless, and the seed re-attaches the business to the
-- same owner UUID. You still get a completely clean schema.
--
-- The seed's Section 1 is safe to run either way: its inserts are ON CONFLICT DO
-- NOTHING, and auth.identities has a UNIQUE (provider_id, provider) constraint,
-- so existing users are skipped outright — passwords untouched, no duplicate
-- identity rows.
--
-- Only uncomment the line below if you actually want every login destroyed,
-- yours included, and you are ready to reset passwords for all six accounts.
-- ═════════════════════════════════════════════════════════════════════════════

-- delete from auth.users;


-- ═════════════════════════════════════════════════════════════════════════════
-- 4. STORAGE
--
-- Objects must go before the bucket; storage.buckets refuses to drop while it
-- still holds rows.
-- ═════════════════════════════════════════════════════════════════════════════

do $$
begin
  delete from storage.objects where bucket_id = 'business-media';
  delete from storage.buckets where id = 'business-media';
exception
  when insufficient_privilege then
    raise notice 'could not clear storage from SQL — delete the business-media bucket from Dashboard → Storage instead';
end $$;


-- ═════════════════════════════════════════════════════════════════════════════
-- 5. MIGRATION HISTORY
--
-- Clears the 7 recorded versions so the project stops claiming a half-applied
-- history. After running the baseline, record it as applied instead:
--
--   supabase migration repair --status applied 00000000000000
--
-- Harmless to skip if you are not using the Supabase CLI to push migrations.
-- ═════════════════════════════════════════════════════════════════════════════

do $$
begin
  delete from supabase_migrations.schema_migrations;
exception
  when undefined_table or insufficient_privilege then
    raise notice 'migration history table not present or not writable — skipping';
end $$;

commit;


-- ═════════════════════════════════════════════════════════════════════════════
-- VERIFY — tables_left, bucket_left and app_functions_left must all be 0.
-- users_left should still be 6 unless you enabled Section 3.
-- ═════════════════════════════════════════════════════════════════════════════
-- select
--   (select count(*) from information_schema.tables
--      where table_schema = 'public' and table_type = 'BASE TABLE')     as tables_left,
--   (select count(*) from storage.buckets where id = 'business-media')  as bucket_left,
--   (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--      where n.nspname = 'public'
--        and p.proname <> 'rls_auto_enable')                            as app_functions_left,
--   (select count(*) from auth.users)                                   as users_left;

-- ═════════════════════════════════════════════════════════════════════════════
-- NEXT
--   1. psql "$DATABASE_URL" -f supabase/baseline/00000000000000_baseline.sql
--   2. psql "$DATABASE_URL" -f supabase/baseline/00000000000001_seed.sql
--      (edit v_temp_password in the seed first)
--   3. Only if you enabled Section 3: every user resets their password.
--      Left disabled (the default), all logins keep working as they do now.
-- ═════════════════════════════════════════════════════════════════════════════
