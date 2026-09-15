alter table public.businesses
  add column if not exists language text not null default 'en'
    check (language in ('en', 'ar'));
