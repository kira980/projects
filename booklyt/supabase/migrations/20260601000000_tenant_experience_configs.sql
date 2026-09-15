create table if not exists public.tenant_experience_configs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  brand_json jsonb not null default '{}'::jsonb,
  layout_json jsonb not null default '{}'::jsonb,
  content_json jsonb not null default '{}'::jsonb,
  published_config_json jsonb,
  draft_config_json jsonb,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists tenant_experience_configs_business_id_idx
  on public.tenant_experience_configs(business_id);

alter table public.tenant_experience_configs enable row level security;

create policy "Business owners can manage their config"
  on public.tenant_experience_configs
  for all
  using (
    business_id in (
      select id from public.businesses where owner_id = auth.uid()
    )
  );

create policy "Public can read published configs"
  on public.tenant_experience_configs
  for select
  using (is_published = true);

-- Storage bucket for business hero images and assets
insert into storage.buckets (id, name, public)
values ('business-media', 'business-media', true)
on conflict (id) do nothing;

-- Allow authenticated users to upload their own files
create policy "Authenticated users can upload media"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'business-media');

-- Allow anyone to read public media
create policy "Public can read business media"
  on storage.objects
  for select
  using (bucket_id = 'business-media');
