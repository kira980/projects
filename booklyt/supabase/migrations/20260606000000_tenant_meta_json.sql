alter table public.tenant_experience_configs
  add column if not exists meta_json jsonb not null default '{}'::jsonb;
