-- Stage 31: phone attendance for workers at the production place.
--
-- Some of the crew work away from the bakery, where there is no kiosk
-- tablet. They clock in and out from their own phone instead, through a
-- small PWA at /attendance.
--
-- The existing worker record stays the single source of truth: a phone is
-- only an extra way to write the SAME worker_shifts rows the kiosk writes,
-- so every report, salary calculation and the שעות screen keep working
-- untouched. No second worker account exists anywhere.
--
-- Trust model, mirroring android_devices (migration 0022): the phone holds
-- an opaque random token, only its SHA-256 lands in the database, and a
-- device can be revoked without losing the history behind it.

-- ── Where clocking in is allowed ────────────────────────────────────────
--
-- One site per business — the production place. The owner sets it by
-- standing there and pressing "use my current location", and registers the
-- network by pressing "register this network" while on its Wi-Fi. Both
-- checks are made server-side; the phone is never believed on its own.
create table public.attendance_settings (
  business_id  uuid primary key references public.businesses (id) on delete cascade,
  latitude     double precision,
  longitude    double precision,
  -- How far from that point a clock-in is still accepted.
  radius_m     integer not null default 100 check (radius_m between 20 and 5000),
  -- Public IPs the site is seen as. A site can have more than one, and
  -- they change when the ISP re-issues them, hence a list the owner can
  -- add to rather than a single value.
  allowed_ips  text[] not null default '{}',
  -- Off until the owner has set both a location and a network.
  is_active    boolean not null default false,
  updated_at   timestamptz not null default now(),
  updated_by   uuid references public.profiles (id)
);

create trigger attendance_settings_set_updated_at
  before update on public.attendance_settings
  for each row execute function public.set_updated_at();

-- ── Registered phones ───────────────────────────────────────────────────
create table public.worker_devices (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  worker_id    uuid not null references public.workers (id) on delete cascade,
  -- SHA-256 (hex) of the opaque token held by the phone. The raw token is
  -- returned once, at registration, and never stored.
  token_hash   text not null unique,
  label        text not null default '',
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz,
  -- Set when the phone is replaced or disconnected; the row stays so the
  -- shifts it recorded keep their provenance.
  revoked_at   timestamptz
);

create index worker_devices_business_id_idx on public.worker_devices (business_id);
create index worker_devices_token_hash_idx on public.worker_devices (token_hash);
create index worker_devices_worker_idx on public.worker_devices (worker_id);

-- One live phone per worker. Replacing a device revokes the old row first,
-- which is what lets this be enforced here rather than in app code.
create unique index worker_devices_one_active_idx
  on public.worker_devices (worker_id)
  where revoked_at is null;

-- ── One-time enrollment sessions ────────────────────────────────────────
--
-- The QR code and the WhatsApp link are two renderings of ONE session, so
-- whichever the worker uses first registers the phone and kills the other.
create table public.device_enrollments (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  worker_id    uuid not null references public.workers (id) on delete cascade,
  -- SHA-256 (hex) of the enrollment token that travels in the QR/link.
  token_hash   text not null unique,
  created_by   uuid references public.profiles (id),
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  -- Set the moment a phone registers with it; single use.
  used_at      timestamptz,
  device_id    uuid references public.worker_devices (id) on delete set null,
  -- Set when the owner closes the box without waiting.
  cancelled_at timestamptz
);

create index device_enrollments_business_id_idx on public.device_enrollments (business_id);
create index device_enrollments_token_hash_idx on public.device_enrollments (token_hash);
create index device_enrollments_worker_idx on public.device_enrollments (worker_id, created_at desc);

-- ── How a shift was clocked ─────────────────────────────────────────────
--
-- The same rows the kiosk writes, with a note of where each end of the
-- shift came from and the fix the phone reported, so a disputed hour can
-- be traced afterwards.
alter table public.worker_shifts
  add column if not exists started_via text
    check (started_via in ('kiosk', 'phone', 'admin')),
  add column if not exists ended_via text
    check (ended_via in ('kiosk', 'phone', 'admin')),
  add column if not exists started_lat double precision,
  add column if not exists started_lng double precision,
  add column if not exists ended_lat   double precision,
  add column if not exists ended_lng   double precision,
  add column if not exists started_device_id uuid
    references public.worker_devices (id) on delete set null,
  add column if not exists ended_device_id uuid
    references public.worker_devices (id) on delete set null;

-- ── RLS ─────────────────────────────────────────────────────────────────
--
-- The owner manages all three from the dashboard, which is admin-only. The
-- worker's phone never uses an RLS client: /attendance runs server-side
-- with the service role and resolves the device token itself.
do $$
declare
  t text;
begin
  foreach t in array array['attendance_settings', 'worker_devices', 'device_enrollments']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "business members full access" on public.%I
         for all
         using (business_id = public.current_business_id())
         with check (business_id = public.current_business_id())',
      t
    );
  end loop;
end;
$$;

notify pgrst, 'reload schema';
