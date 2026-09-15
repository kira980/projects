-- Run this in the Supabase SQL editor if the bucket already exists
-- but uploads are blocked by RLS.

-- Allow any authenticated user to upload into business-media
create policy "Authenticated users can upload media"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'business-media');

-- Allow users to overwrite/update their own uploads
create policy "Users can update own media"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'business-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow users to delete their own uploads
create policy "Users can delete own media"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'business-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow anyone to read (bucket is public, but policy is belt-and-suspenders)
create policy "Public can read business media"
  on storage.objects
  for select
  using (bucket_id = 'business-media');
