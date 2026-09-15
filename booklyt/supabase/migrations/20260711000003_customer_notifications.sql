-- ─────────────────────────────────────────────────────────────────────────────
-- Customer notification center + business announcements.
-- customer_notifications: one row per notification per customer (in-app feed;
-- push/WhatsApp fan-out happens in application code).
-- business_announcements: audit + rate-limit record for broadcast messages.
-- Recipients of announcements are ALWAYS derived server-side from
-- customer_businesses (notifications_enabled = true) — never client-supplied.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.customer_notifications (
  id               uuid        primary key default gen_random_uuid(),
  customer_user_id uuid        not null references public.customer_users(id) on delete cascade,
  business_id      uuid        references public.businesses(id) on delete set null,
  type             text        not null check (type in (
                     'booking_confirmed', 'booking_reminder', 'booking_cancelled',
                     'booking_changed', 'waitlist', 'announcement', 'rebooking'
                   )),
  title            text        not null,
  body             text        not null,
  url              text,
  read_at          timestamptz,
  created_at       timestamptz not null default now()
);

create index if not exists idx_customer_notifications_user_created
  on public.customer_notifications(customer_user_id, created_at desc);

create index if not exists idx_customer_notifications_user_unread
  on public.customer_notifications(customer_user_id)
  where read_at is null;

create table if not exists public.business_announcements (
  id              uuid        primary key default gen_random_uuid(),
  business_id     uuid        not null references public.businesses(id) on delete cascade,
  title           text        not null,
  body            text        not null,
  sent_at         timestamptz,
  recipient_count integer,
  created_at      timestamptz not null default now()
);

create index if not exists idx_business_announcements_business
  on public.business_announcements(business_id, created_at desc);

-- Best-effort backfill: link historical appointments to global customer
-- accounts by normalized phone so "My Bookings" shows past bookings.
update public.appointments a
set customer_user_id = cu.id
from public.customer_users cu
where a.customer_user_id is null
  and a.customer_phone is not null
  and regexp_replace(a.customer_phone, '[^0-9]', '', 'g') <> ''
  and regexp_replace(a.customer_phone, '[^0-9]', '', 'g')
      = regexp_replace(cu.phone, '[^0-9]', '', 'g');

-- Service-role access only
alter table public.customer_notifications enable row level security;
alter table public.business_announcements enable row level security;
