alter table public.businesses
  add column if not exists app_name text,
  add column if not exists app_icon_url text;
