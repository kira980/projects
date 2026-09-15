-- ─────────────────────────────────────────────────────────────────────────────
-- Repair: every FK below was created WITHOUT its ON DELETE action.
-- Live state was NO ACTION ('a'); the repo declares CASCADE or SET NULL.
--
-- Symptom: deleting a business or an auth user fails with 23503
--   "update or delete on table X violates foreign key constraint ..."
--
-- Each action below is taken from the table's own migration, NOT blanket-applied.
-- Deliberately NOT touched (repo declares plain REFERENCES = NO ACTION,
-- so the live state is already correct):
--   appointments_service_id_fkey, appointments_staff_member_id_fkey,
--   appointments_customer_id_fkey   (schema.sql lines 115-117)
--
-- Safe to run once. Not idempotent: re-running fails on the first DROP because
-- the constraint has already been replaced. Verify with the query at the bottom.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

-- ── ON DELETE CASCADE ────────────────────────────────────────────────────────
alter table public.profiles drop constraint profiles_id_fkey,
  add constraint profiles_id_fkey foreign key (id) references auth.users(id) on delete cascade;

alter table public.businesses drop constraint businesses_owner_id_fkey,
  add constraint businesses_owner_id_fkey foreign key (owner_id) references auth.users(id) on delete cascade;

alter table public.services drop constraint services_business_id_fkey,
  add constraint services_business_id_fkey foreign key (business_id) references public.businesses(id) on delete cascade;

alter table public.staff_members drop constraint staff_members_business_id_fkey,
  add constraint staff_members_business_id_fkey foreign key (business_id) references public.businesses(id) on delete cascade;

alter table public.working_hours drop constraint working_hours_business_id_fkey,
  add constraint working_hours_business_id_fkey foreign key (business_id) references public.businesses(id) on delete cascade;

alter table public.working_hour_breaks drop constraint working_hour_breaks_business_id_fkey,
  add constraint working_hour_breaks_business_id_fkey foreign key (business_id) references public.businesses(id) on delete cascade;

alter table public.customers drop constraint customers_business_id_fkey,
  add constraint customers_business_id_fkey foreign key (business_id) references public.businesses(id) on delete cascade;

alter table public.appointments drop constraint appointments_business_id_fkey,
  add constraint appointments_business_id_fkey foreign key (business_id) references public.businesses(id) on delete cascade;

alter table public.tenant_experience_configs drop constraint tenant_experience_configs_business_id_fkey,
  add constraint tenant_experience_configs_business_id_fkey foreign key (business_id) references public.businesses(id) on delete cascade;

alter table public.waitlist_entries drop constraint waitlist_entries_business_id_fkey,
  add constraint waitlist_entries_business_id_fkey foreign key (business_id) references public.businesses(id) on delete cascade;

alter table public.waitlist_entries drop constraint waitlist_entries_service_id_fkey,
  add constraint waitlist_entries_service_id_fkey foreign key (service_id) references public.services(id) on delete cascade;

alter table public.push_subscriptions drop constraint push_subscriptions_business_id_fkey,
  add constraint push_subscriptions_business_id_fkey foreign key (business_id) references public.businesses(id) on delete cascade;

alter table public.push_subscriptions drop constraint push_subscriptions_appointment_id_fkey,
  add constraint push_subscriptions_appointment_id_fkey foreign key (appointment_id) references public.appointments(id) on delete cascade;

alter table public.push_subscriptions drop constraint push_subscriptions_waitlist_entry_id_fkey,
  add constraint push_subscriptions_waitlist_entry_id_fkey foreign key (waitlist_entry_id) references public.waitlist_entries(id) on delete cascade;

alter table public.customer_user_sessions drop constraint customer_user_sessions_customer_user_id_fkey,
  add constraint customer_user_sessions_customer_user_id_fkey foreign key (customer_user_id) references public.customer_users(id) on delete cascade;

alter table public.customer_sessions drop constraint customer_sessions_business_id_fkey,
  add constraint customer_sessions_business_id_fkey foreign key (business_id) references public.businesses(id) on delete cascade;

alter table public.customer_sessions drop constraint customer_sessions_customer_id_fkey,
  add constraint customer_sessions_customer_id_fkey foreign key (customer_id) references public.customers(id) on delete cascade;

alter table public.appointment_events drop constraint appointment_events_business_id_fkey,
  add constraint appointment_events_business_id_fkey foreign key (business_id) references public.businesses(id) on delete cascade;

alter table public.device_push_tokens drop constraint device_push_tokens_business_id_fkey,
  add constraint device_push_tokens_business_id_fkey foreign key (business_id) references public.businesses(id) on delete cascade;

alter table public.wa_message_log drop constraint wa_message_log_business_id_fkey,
  add constraint wa_message_log_business_id_fkey foreign key (business_id) references public.businesses(id) on delete cascade;

-- ── ON DELETE SET NULL ───────────────────────────────────────────────────────
alter table public.waitlist_entries drop constraint waitlist_entries_staff_member_id_fkey,
  add constraint waitlist_entries_staff_member_id_fkey foreign key (staff_member_id) references public.staff_members(id) on delete set null;

alter table public.appointments drop constraint appointments_customer_user_id_fkey,
  add constraint appointments_customer_user_id_fkey foreign key (customer_user_id) references public.customer_users(id) on delete set null;

alter table public.customers drop constraint customers_customer_user_id_fkey,
  add constraint customers_customer_user_id_fkey foreign key (customer_user_id) references public.customer_users(id) on delete set null;

alter table public.appointment_events drop constraint appointment_events_appointment_id_fkey,
  add constraint appointment_events_appointment_id_fkey foreign key (appointment_id) references public.appointments(id) on delete set null;

alter table public.device_push_tokens drop constraint device_push_tokens_waitlist_entry_id_fkey,
  add constraint device_push_tokens_waitlist_entry_id_fkey foreign key (waitlist_entry_id) references public.waitlist_entries(id) on delete set null;

commit;

-- ── Verify: should return only the three intentional NO ACTION rows ──────────
-- select conrelid::regclass::text as child, conname, confdeltype
-- from pg_constraint
-- where contype='f' and connamespace='public'::regnamespace and confdeltype='a'
-- order by 1;
