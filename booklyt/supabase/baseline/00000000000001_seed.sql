-- ═════════════════════════════════════════════════════════════════════════════
-- Booklyt — data seed
--
-- Seeds the contents of the current live project (xvmudfouyqywpqtcilvp) into a
-- fresh database. Run AFTER supabase/baseline/00000000000000_baseline.sql.
--
-- All primary keys are preserved verbatim, so every foreign key, manage_token
-- and published builder config lines up exactly as it does today. Every insert
-- is ON CONFLICT DO NOTHING, so re-running changes nothing.
--
-- Row counts: 6 auth users, 1 profile, 1 business, 1 service, 7 working hours,
--             1 appointment, 2 appointment events, 1 builder config, 1 wa log.
--
-- ⚠ BEFORE YOU RUN — two things to know:
--
--   1. PASSWORDS ARE NOT MIGRATED. Supabase stores bcrypt hashes in
--      auth.users.encrypted_password. They are copyable, but a password hash
--      does not belong in a file that lives in git. Section 1 therefore sets one
--      shared temporary password that you must change below, and every user
--      should go through "forgot password" afterwards. If you would rather move
--      the real hashes, do it DB-to-DB and never through this file — see the
--      note at the bottom of Section 1.
--
--   2. THIS FILE CONTAINS PERSONAL DATA — six real email addresses and one
--      customer phone number. That is unavoidable for a data seed, but it means
--      this file should not go into a public repository.
-- ═════════════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

begin;

-- ═════════════════════════════════════════════════════════════════════════════
-- 1. AUTH USERS
--
-- Seeded first because public.profiles.id and public.businesses.owner_id are
-- both foreign keys onto auth.users(id). UUIDs are preserved, so the business
-- stays attached to the same owner.
--
-- Of these six, only ahmed.hosh007@gmail.com has a profile and a business; the
-- other five are signups that never finished onboarding. They are included so
-- nobody loses their account, and they carry no other data.
-- ═════════════════════════════════════════════════════════════════════════════

do $$
declare
  -- ─────────────────────────────────────────────────────────────────────────
  v_temp_password constant text := 'ChangeMe!2026';   -- ← EDIT THIS
  -- ─────────────────────────────────────────────────────────────────────────
  u record;
begin
  for u in
    select * from (values
      ('d6ed30cf-a9b6-4688-aab1-fcdb2f28ef6f'::uuid, 'ahmed.hosh007@gmail.com', 'ahmed hosh', true),
      ('f9941c52-6f82-4039-b571-bc43be3ea292'::uuid, 'kira987650@gmail.com', 'kira987650@gmail.com', false),
      ('3a3c18a3-84d1-42b3-bb22-a8731e3733d6'::uuid, 'nsymysawy8@gmail.com', 'nsem', false),
      ('94b5984b-5e5d-48a0-b095-675434260957'::uuid, 'jwad20844@gmail.com', 'Jwad Ali', true),
      ('f5bad29b-afbb-47b0-a5e9-078318532780'::uuid, 'jwad20855@gmail.com', 'Jwad Ali', true),
      ('b6461dda-9947-4136-a8c5-40fdf47ec2c2'::uuid, 'gawadali046@gmail.com', 'جواد', false)
    ) as t(id, email, full_name, confirmed)
  loop
    -- The eight *_token / email_change / phone_change columns MUST be '' and not
    -- NULL. Four of them (confirmation_token, recovery_token,
    -- email_change_token_new, email_change) have no column default, so a hand
    -- written INSERT leaves them NULL. GoTrue scans them into non-nullable Go
    -- strings, so a NULL makes every login fail with the opaque
    --   "Database error querying schema"
    -- even though the row looks perfectly fine in SQL.
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, phone_change, phone_change_token,
      reauthentication_token
    )
    values (
      '00000000-0000-0000-0000-000000000000',
      u.id, 'authenticated', 'authenticated', u.email,
      crypt(v_temp_password, gen_salt('bf')),   -- resolved via the search_path set above
      case when u.confirmed then now() else null end,
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', u.full_name),
      now(), now(),
      '', '', '', '',
      '', '', '',
      ''
    )
    on conflict (id) do nothing;

    -- GoTrue will not accept an email login without a matching identity row.
    insert into auth.identities (
      id, user_id, provider_id, provider, identity_data, created_at, updated_at
    )
    values (
      gen_random_uuid(), u.id, u.id::text, 'email',
      jsonb_build_object(
        'sub', u.id::text,
        'email', u.email,
        'email_verified', u.confirmed,
        'phone_verified', false
      ),
      now(), now()
    )
    on conflict do nothing;
  end loop;
end $$;

-- If you ever hand-insert auth users outside this file and logins start failing
-- with "Database error querying schema", this is almost always the cause. Repair:
--   update auth.users set
--     confirmation_token         = coalesce(confirmation_token, ''),
--     recovery_token             = coalesce(recovery_token, ''),
--     email_change_token_new     = coalesce(email_change_token_new, ''),
--     email_change               = coalesce(email_change, ''),
--     email_change_token_current = coalesce(email_change_token_current, ''),
--     phone_change               = coalesce(phone_change, ''),
--     phone_change_token         = coalesce(phone_change_token, ''),
--     reauthentication_token     = coalesce(reauthentication_token, '');

-- Prefer to migrate the real password hashes instead? Skip the block above and
-- copy them directly between databases, e.g. from the OLD project:
--   \copy (select id, email, encrypted_password, email_confirmed_at,
--                raw_user_meta_data from auth.users) to 'users.csv' csv
-- then load into the new one. Delete users.csv afterwards; do not commit it.


-- ═════════════════════════════════════════════════════════════════════════════
-- 2. PROFILES
--
-- Only the owner has a profile on the source project. You may well end up with
-- six here instead of one, and that is fine: the baseline's on_auth_user_created
-- trigger fires as Section 1 inserts each auth user and creates a profile row
-- for it. A profile without a business is inert.
-- ═════════════════════════════════════════════════════════════════════════════

insert into public.profiles (id, full_name, avatar_url, created_at, updated_at)
values ('d6ed30cf-a9b6-4688-aab1-fcdb2f28ef6f', NULL, NULL,
        '2026-08-16 07:57:28.939803+00', '2026-08-16 08:21:33.019889+00')
on conflict (id) do nothing;


-- ═════════════════════════════════════════════════════════════════════════════
-- 3. BUSINESS
--
-- admin_password_hash / admin_password_salt are omitted: they are NULL on the
-- source project (no admin-portal password has been set), and they are the kind
-- of value that should never be committed anyway. Set one from the dashboard.
--
-- business_code is carried over so existing "find by code" links keep working.
-- Note the trg_set_business_code trigger only fills it when NULL, so an explicit
-- value passes straight through.
-- ═════════════════════════════════════════════════════════════════════════════

insert into public.businesses (
  id, owner_id, name, slug, category, phone, address, logo_url, description,
  created_at, updated_at, booking_mode, group_capacity, app_name, app_icon_url,
  appointments_require_confirmation, language, customer_confirmation_enabled,
  time_format, currency, country_code, slot_interval, booking_days_ahead,
  booking_verification_method, timezone, wa_booking_confirmation, wa_reminders,
  wa_waitlist, active, business_code, app_enabled
)
values (
  '2c64b49d-140b-47a5-9481-4c534e9d19ab', 'd6ed30cf-a9b6-4688-aab1-fcdb2f28ef6f',
  'barbershop', 'barb', 'salon', '0527323567', 'kafar manda', NULL, NULL,
  '2026-08-16 08:21:33.285506+00', '2026-08-16 08:21:33.285506+00',
  'appointment', 1, NULL, NULL,
  true, 'en', false,
  '12h', 'USD', '972', 30, NULL,
  'link', 'Asia/Jerusalem', false, true,
  true, true, '044004', true
)
on conflict (id) do nothing;


-- ═════════════════════════════════════════════════════════════════════════════
-- 4. SERVICES
-- ═════════════════════════════════════════════════════════════════════════════

insert into public.services (
  id, business_id, name, description, price, duration_minutes,
  image_url, active, created_at, updated_at
)
values (
  'f03e601a-e704-4c79-91d6-6936817b9650', '2c64b49d-140b-47a5-9481-4c534e9d19ab',
  'haircut', NULL, 50, 30, NULL, true,
  '2026-08-16 08:21:33.546513+00', '2026-08-16 08:21:33.546513+00'
)
on conflict (id) do nothing;


-- ═════════════════════════════════════════════════════════════════════════════
-- 5. WORKING HOURS  (Monday closed; Saturday 10:00–16:00)
-- ═════════════════════════════════════════════════════════════════════════════

insert into public.working_hours (id, business_id, day_of_week, is_open, open_time, close_time, created_at, updated_at)
values ('cf1fde58-044b-4467-ada8-f63d3b2e0144','2c64b49d-140b-47a5-9481-4c534e9d19ab',0,'t','09:00:00','18:00:00','2026-08-16 08:21:33.466749+00','2026-08-16 08:21:33.466749+00') on conflict (id) do nothing;
insert into public.working_hours (id, business_id, day_of_week, is_open, open_time, close_time, created_at, updated_at)
values ('be12623e-9ebf-437e-b0f4-1e9262694fcb','2c64b49d-140b-47a5-9481-4c534e9d19ab',1,'f','09:00:00','18:00:00','2026-08-16 08:21:33.466749+00','2026-08-16 08:21:33.466749+00') on conflict (id) do nothing;
insert into public.working_hours (id, business_id, day_of_week, is_open, open_time, close_time, created_at, updated_at)
values ('421decd4-b10e-429c-bc30-7e0e39566025','2c64b49d-140b-47a5-9481-4c534e9d19ab',2,'t','09:00:00','18:00:00','2026-08-16 08:21:33.466749+00','2026-08-16 08:21:33.466749+00') on conflict (id) do nothing;
insert into public.working_hours (id, business_id, day_of_week, is_open, open_time, close_time, created_at, updated_at)
values ('2f3d6496-81cc-4e53-80aa-9943137e9c19','2c64b49d-140b-47a5-9481-4c534e9d19ab',3,'t','09:00:00','18:00:00','2026-08-16 08:21:33.466749+00','2026-08-16 08:21:33.466749+00') on conflict (id) do nothing;
insert into public.working_hours (id, business_id, day_of_week, is_open, open_time, close_time, created_at, updated_at)
values ('0de31591-fa06-464b-8cb9-3e6ab9de1707','2c64b49d-140b-47a5-9481-4c534e9d19ab',4,'t','09:00:00','18:00:00','2026-08-16 08:21:33.466749+00','2026-08-16 08:21:33.466749+00') on conflict (id) do nothing;
insert into public.working_hours (id, business_id, day_of_week, is_open, open_time, close_time, created_at, updated_at)
values ('498d1f30-7d25-4c24-9b16-7634a44e49af','2c64b49d-140b-47a5-9481-4c534e9d19ab',5,'t','09:00:00','18:00:00','2026-08-16 08:21:33.466749+00','2026-08-16 08:21:33.466749+00') on conflict (id) do nothing;
insert into public.working_hours (id, business_id, day_of_week, is_open, open_time, close_time, created_at, updated_at)
values ('e7e1e939-73ea-4b28-b9f9-11d3870f25ca','2c64b49d-140b-47a5-9481-4c534e9d19ab',6,'t','10:00:00','16:00:00','2026-08-16 08:21:33.466749+00','2026-08-16 08:21:33.466749+00') on conflict (id) do nothing;

-- No staff_members and no working_hour_breaks exist on the source project.


-- ═════════════════════════════════════════════════════════════════════════════
-- 6. APPOINTMENTS
--
-- One cancelled booking. customer_id is NULL on the source row, so no
-- public.customers row is needed.
-- ═════════════════════════════════════════════════════════════════════════════

insert into public.appointments (
  id, business_id, service_id, staff_member_id, customer_id,
  customer_name, customer_phone, customer_email,
  appointment_date, start_time, end_time, status, notes,
  created_at, updated_at, participants_count, manage_token, cancelled_at,
  customer_user_id, customer_confirmed_at, notify_token,
  wa_reminder_sent_at, push_reminder_sent_at
)
values (
  '3e4736c9-8724-4f5f-a3f4-8fe2e535f85d', '2c64b49d-140b-47a5-9481-4c534e9d19ab', 'f03e601a-e704-4c79-91d6-6936817b9650', NULL, NULL,
  'ahnmed hoah', '0527323567', NULL,
  '2026-08-16', '12:00:00', '12:30:00', 'cancelled', '',
  '2026-08-16 08:22:02.757247+00', '2026-08-16 08:29:03.299+00', 1,
  '2f99558437edc85fe1dbc8333ac38547abdb8a1be7c39ae7',
  '2026-08-16 08:29:03.299+00',
  NULL, NULL, NULL, NULL, NULL
)
on conflict (id) do nothing;


-- ═════════════════════════════════════════════════════════════════════════════
-- 7. APPOINTMENT EVENTS  (the dashboard activity timeline)
-- ═════════════════════════════════════════════════════════════════════════════

insert into public.appointment_events (
  id, business_id, appointment_id, event_type, title, description, metadata, created_at
)
values (
  'cd5ec6ed-6444-4341-aff3-33aeeb57ec72', '2c64b49d-140b-47a5-9481-4c534e9d19ab', '3e4736c9-8724-4f5f-a3f4-8fe2e535f85d',
  'reservation', 'New reservation',
  'ahnmed hoah booked 2026-08-16 Time 12:00.',
  '{"status": "pending", "start_time": "12:00", "customer_name": "ahnmed hoah", "appointment_date": "2026-08-16"}'::jsonb,
  '2026-08-16 08:22:03.08835+00'
)
on conflict (id) do nothing;

insert into public.appointment_events (
  id, business_id, appointment_id, event_type, title, description, metadata, created_at
)
values (
  '45861cb6-8b82-489d-9ffe-05a4adba3502', '2c64b49d-140b-47a5-9481-4c534e9d19ab', '3e4736c9-8724-4f5f-a3f4-8fe2e535f85d',
  'cancellation', 'Booking cancelled',
  'ahnmed hoah cancelled 2026-08-16 Time 12:00.',
  '{"start_time": "12:00:00", "customer_name": "ahnmed hoah", "appointment_date": "2026-08-16"}'::jsonb,
  '2026-08-16 08:29:03.479133+00'
)
on conflict (id) do nothing;


-- ═════════════════════════════════════════════════════════════════════════════
-- 8. WEBSITE BUILDER CONFIG
--
-- The soft-salon template with the rose palette, published 2026-08-19.
-- is_published = true, so /book/barb renders the branded page immediately.
--
-- ⚠ content.heroImage IS DELIBERATELY STRIPPED from all three JSON columns.
-- On the source project it holds "blob:https://booklyt.net/ebd760f4-…", a local
-- object URL that only ever resolved inside the browser tab that created it —
-- the artefact of the failed-upload bug. Seeding it forward would recreate a
-- broken hero image on day one. Re-upload the photo from the builder instead.
-- ═════════════════════════════════════════════════════════════════════════════

insert into public.tenant_experience_configs (
  id, business_id, brand_json, layout_json, content_json, meta_json,
  published_config_json, draft_config_json, is_published, created_at, updated_at
)
values (
  '0b31ab69-f710-4a34-b6af-8b18a7161531', '2c64b49d-140b-47a5-9481-4c534e9d19ab',
  '{"font": "DM Serif Display", "radius": "16px", "cardStyle": "elevated", "textColor": "#2d1b1e", "mutedColor": "#9b7b80", "accentColor": "#f9e4e8", "buttonStyle": "pill", "primaryColor": "#b76e79", "surfaceColor": "#ffffff", "backgroundColor": "#fff9f8"}'::jsonb,
  '{"sections": [{"id": "hero", "type": "hero", "order": 0, "variant": "centered", "visible": true}, {"id": "services", "type": "services", "order": 1, "variant": "default", "visible": true}, {"id": "gallery", "type": "gallery", "order": 2, "variant": "default", "visible": true}, {"id": "staff", "type": "staff", "order": 3, "variant": "centered", "visible": true}, {"id": "booking", "type": "booking", "order": 4, "variant": "default", "visible": true}, {"id": "testimonials", "type": "testimonials", "order": 5, "variant": "default", "visible": true}, {"id": "contact", "type": "contact", "order": 6, "variant": "default", "visible": true}, {"id": "offers", "type": "offers", "order": 7, "variant": "default", "visible": false}], "pageStyle": "light", "spacingStyle": "spacious", "templateName": "soft-salon"}'::jsonb,
  '{"heroTitle": "Your Hair,\nYour Confidence.", "heroCtaText": "Book Appointment", "heroEyebrow": "LOOAK SHARP.", "heroSubtitle": "Expert styling tailored just for you.", "showHeroText": true}'::jsonb,
  '{"app": {"mobileNavStyle": "bottom-tabs", "defaultOpenMode": "standalone"}, "booking": {"calendarType": "monthly", "capacityBehavior": "per-slot", "staffSelectionBehavior": "optional"}, "branding": {}, "language": "en", "bookingMode": "appointment", "businessType": "general"}'::jsonb,
  '{"meta": {"app": {"mobileNavStyle": "bottom-tabs", "defaultOpenMode": "standalone"}, "booking": {"calendarType": "monthly", "capacityBehavior": "per-slot", "staffSelectionBehavior": "optional"}, "branding": {}, "language": "en", "bookingMode": "appointment", "businessType": "general"}, "brand": {"font": "DM Serif Display", "radius": "16px", "cardStyle": "elevated", "textColor": "#2d1b1e", "mutedColor": "#9b7b80", "accentColor": "#f9e4e8", "buttonStyle": "pill", "primaryColor": "#b76e79", "surfaceColor": "#ffffff", "backgroundColor": "#fff9f8"}, "layout": {"sections": [{"id": "hero", "type": "hero", "order": 0, "variant": "centered", "visible": true}, {"id": "services", "type": "services", "order": 1, "variant": "default", "visible": true}, {"id": "gallery", "type": "gallery", "order": 2, "variant": "default", "visible": true}, {"id": "staff", "type": "staff", "order": 3, "variant": "centered", "visible": true}, {"id": "booking", "type": "booking", "order": 4, "variant": "default", "visible": true}, {"id": "testimonials", "type": "testimonials", "order": 5, "variant": "default", "visible": true}, {"id": "contact", "type": "contact", "order": 6, "variant": "default", "visible": true}, {"id": "offers", "type": "offers", "order": 7, "variant": "default", "visible": false}], "pageStyle": "light", "spacingStyle": "spacious", "templateName": "soft-salon"}, "content": {"heroTitle": "Your Hair,\nYour Confidence.", "heroCtaText": "Book Appointment", "heroEyebrow": "LOOAK SHARP.", "heroSubtitle": "Expert styling tailored just for you.", "showHeroText": true}, "publishedAt": "2026-08-19T18:02:34.092Z"}'::jsonb,
  '{"meta": {"app": {"mobileNavStyle": "bottom-tabs", "defaultOpenMode": "standalone"}, "booking": {"calendarType": "monthly", "capacityBehavior": "per-slot", "staffSelectionBehavior": "optional"}, "branding": {}, "language": "en", "bookingMode": "appointment", "businessType": "general"}, "brand": {"font": "DM Serif Display", "radius": "16px", "cardStyle": "elevated", "textColor": "#2d1b1e", "mutedColor": "#9b7b80", "accentColor": "#f9e4e8", "buttonStyle": "pill", "primaryColor": "#b76e79", "surfaceColor": "#ffffff", "backgroundColor": "#fff9f8"}, "layout": {"sections": [{"id": "hero", "type": "hero", "order": 0, "variant": "centered", "visible": true}, {"id": "services", "type": "services", "order": 1, "variant": "default", "visible": true}, {"id": "gallery", "type": "gallery", "order": 2, "variant": "default", "visible": true}, {"id": "staff", "type": "staff", "order": 3, "variant": "centered", "visible": true}, {"id": "booking", "type": "booking", "order": 4, "variant": "default", "visible": true}, {"id": "testimonials", "type": "testimonials", "order": 5, "variant": "default", "visible": true}, {"id": "contact", "type": "contact", "order": 6, "variant": "default", "visible": true}, {"id": "offers", "type": "offers", "order": 7, "variant": "default", "visible": false}], "pageStyle": "light", "spacingStyle": "spacious", "templateName": "soft-salon"}, "content": {"heroTitle": "Your Hair,\nYour Confidence.", "heroCtaText": "Book Appointment", "heroEyebrow": "LOOAK SHARP.", "heroSubtitle": "Expert styling tailored just for you.", "showHeroText": true}, "savedAt": "2026-08-19T18:02:32.839Z"}'::jsonb,
  true,
  '2026-08-16 09:07:14.560364+00', '2026-08-19 18:02:34.092+00'
)
on conflict (business_id) do nothing;


-- ═════════════════════════════════════════════════════════════════════════════
-- 9. WHATSAPP MESSAGE LOG
-- ═════════════════════════════════════════════════════════════════════════════

insert into public.wa_message_log (
  id, business_id, message_type, recipient_phone, status, created_at
)
values (
  '0696ae3d-adfa-4bab-a69c-99e3453371b9', '2c64b49d-140b-47a5-9481-4c534e9d19ab',
  'verification_link', '0527323567', 'failed', '2026-08-16 08:22:03.5117+00'
)
on conflict (id) do nothing;

commit;


-- ═════════════════════════════════════════════════════════════════════════════
-- VERIFY — expected: 6, 1, 1, 1, 7, 1, 2, 1, 1, and published = true
-- ═════════════════════════════════════════════════════════════════════════════
-- select
--   (select count(*) from auth.users)                  as auth_users,
--   (select count(*) from public.profiles)             as profiles,
--   (select count(*) from public.businesses)           as businesses,
--   (select count(*) from public.services)             as services,
--   (select count(*) from public.working_hours)        as working_hours,
--   (select count(*) from public.appointments)         as appointments,
--   (select count(*) from public.appointment_events)   as events,
--   (select count(*) from public.tenant_experience_configs) as configs,
--   (select count(*) from public.wa_message_log)       as wa_log,
--   (select is_published from public.tenant_experience_configs limit 1) as published;
