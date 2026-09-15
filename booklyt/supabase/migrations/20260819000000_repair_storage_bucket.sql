-- ─────────────────────────────────────────────────────────────────────────────
-- Repair: the `business-media` bucket and its storage.objects policies from
-- 20260601000000_tenant_experience_configs.sql / 20260601000001_storage_policies.sql
-- were never applied to the live project (storage.buckets was empty).
--
-- Impact while missing: every builder image upload failed at
-- createSignedUploadUrl (see /api/builder/upload-url). The builder and the
-- onboarding wizard both fall back to the local `blob:` preview URL, which then
-- gets saved and published into content_json.heroImage. The blob URL resolves
-- only inside the tab that created it, so the editor preview looks correct while
-- the live site renders a broken image — i.e. "publishing doesn't change the
-- website".
--
-- Idempotent: safe to run repeatedly.
-- ─────────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'business-media',
  'business-media',
  true,
  31457280,  -- 30 MB, matches the cap enforced in /api/builder/upload-url
  array['image/jpeg','image/png','image/webp','image/gif','image/avif','image/svg+xml']
)
on conflict (id) do update
  set public             = true,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Authenticated users can upload media" on storage.objects;
drop policy if exists "Users can update own media"           on storage.objects;
drop policy if exists "Users can delete own media"           on storage.objects;
drop policy if exists "Public can read business media"       on storage.objects;

-- Uploads go through a service-role signed upload URL, but keep the
-- authenticated path open so direct client uploads work too.
create policy "Authenticated users can upload media"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'business-media');

create policy "Users can update own media"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'business-media'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

create policy "Users can delete own media"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'business-media'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

-- Public read: the booking site serves these images to anonymous visitors.
create policy "Public can read business media"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'business-media');
