-- These two are declared in 20260608000010_mobile_push.sql but, like much of
-- that era's DDL, never made it to the live project.
create index if not exists idx_dpt_business on public.device_push_tokens(business_id);
create index if not exists idx_dpt_waitlist on public.device_push_tokens(waitlist_entry_id);
