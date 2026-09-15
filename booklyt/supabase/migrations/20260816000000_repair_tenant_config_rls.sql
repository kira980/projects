-- ─────────────────────────────────────────────────────────────────────────────
-- Repair: the RLS policies from 20260601000000_tenant_experience_configs.sql
-- were never applied to the live project (the table and its columns were, but
-- the unique index and both policies were not).
--
-- Impact while missing: /book/[slug] reads tenant_experience_configs with the
-- anon-key server client (see getPublishedConfig in src/lib/supabase/tenant-config.ts).
-- With no public-read policy the query returns 0 rows, so every visitor falls
-- back to DEFAULT_TEMPLATE and published branding never goes live.
--
-- Idempotent: safe to run repeatedly.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.tenant_experience_configs enable row level security;

-- Required by the onConflict: 'business_id' upserts in saveDraft/publishConfig.
create unique index if not exists tenant_experience_configs_business_id_idx
  on public.tenant_experience_configs(business_id);

drop policy if exists "Business owners can manage their config" on public.tenant_experience_configs;
drop policy if exists "Public can read published configs"       on public.tenant_experience_configs;

-- Anyone (anon included) may read a config that is actually published.
create policy "Public can read published configs"
  on public.tenant_experience_configs
  for select
  using (is_published = true);

-- Owners get full control of their own row, including drafts.
create policy "Business owners can manage their config"
  on public.tenant_experience_configs
  for all
  to authenticated
  using (
    business_id in (select id from public.businesses where owner_id = auth.uid())
  )
  with check (
    business_id in (select id from public.businesses where owner_id = auth.uid())
  );

notify pgrst, 'reload schema';
