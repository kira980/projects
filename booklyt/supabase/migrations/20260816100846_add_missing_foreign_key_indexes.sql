-- Covering indexes for unindexed foreign keys (linter 0001).
-- Purely additive. These also matter for the ON DELETE CASCADE repair: without
-- them, deleting a business forces a sequential scan of every child table.

create index if not exists idx_appointments_business          on public.appointments(business_id);
create index if not exists idx_appointments_service           on public.appointments(service_id);
create index if not exists idx_appointments_staff             on public.appointments(staff_member_id);
create index if not exists idx_appointments_customer          on public.appointments(customer_id);
create index if not exists idx_appointments_customer_user     on public.appointments(customer_user_id);

create index if not exists idx_appointment_events_business    on public.appointment_events(business_id);
create index if not exists idx_appointment_events_appointment on public.appointment_events(appointment_id);

create index if not exists idx_services_business              on public.services(business_id);
create index if not exists idx_staff_members_business         on public.staff_members(business_id);
create index if not exists idx_working_hours_business         on public.working_hours(business_id);
create index if not exists idx_working_hour_breaks_business   on public.working_hour_breaks(business_id);

create index if not exists idx_customers_business             on public.customers(business_id);
create index if not exists idx_customers_customer_user        on public.customers(customer_user_id);

create index if not exists idx_customer_sessions_business     on public.customer_sessions(business_id);
create index if not exists idx_customer_sessions_customer     on public.customer_sessions(customer_id);
create index if not exists idx_customer_user_sessions_user    on public.customer_user_sessions(customer_user_id);
create index if not exists idx_customer_notifications_business on public.customer_notifications(business_id);

create index if not exists idx_waitlist_business              on public.waitlist_entries(business_id);
create index if not exists idx_waitlist_service               on public.waitlist_entries(service_id);
create index if not exists idx_waitlist_staff                 on public.waitlist_entries(staff_member_id);

create index if not exists idx_push_subs_business             on public.push_subscriptions(business_id);
create index if not exists idx_push_subs_appointment          on public.push_subscriptions(appointment_id);
create index if not exists idx_push_subs_waitlist             on public.push_subscriptions(waitlist_entry_id);

create index if not exists idx_wa_message_log_business_fk     on public.wa_message_log(business_id);
