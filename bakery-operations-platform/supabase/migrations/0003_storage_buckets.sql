-- Stage 2: private storage buckets. Files live under {business_id}/...
-- Admins access via RLS below; kiosk/driver uploads go through
-- server-only service-role actions.

insert into storage.buckets (id, name, public)
values
  ('receipts', 'receipts', false),
  ('proofs', 'proofs', false),
  ('documents', 'documents', false)
on conflict (id) do nothing;

create policy "business members read files"
  on storage.objects for select
  using (
    bucket_id in ('receipts', 'proofs', 'documents')
    and (storage.foldername(name))[1] = public.current_business_id()::text
  );

create policy "business members upload files"
  on storage.objects for insert
  with check (
    bucket_id in ('receipts', 'proofs', 'documents')
    and (storage.foldername(name))[1] = public.current_business_id()::text
  );

create policy "business members delete files"
  on storage.objects for delete
  using (
    bucket_id in ('receipts', 'proofs', 'documents')
    and (storage.foldername(name))[1] = public.current_business_id()::text
  );
