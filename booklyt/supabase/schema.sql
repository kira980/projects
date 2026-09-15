-- ============================================================
-- BookFlow – Supabase Schema + RLS Policies
-- ============================================================

-- ─────────────────────────────────────────
-- Extensions
-- ─────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────
-- PROFILES
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- BUSINESSES
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS businesses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  category    TEXT NOT NULL,
  phone       TEXT,
  address     TEXT,
  logo_url    TEXT,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS businesses_owner_id_idx ON businesses(owner_id);
CREATE INDEX IF NOT EXISTS businesses_slug_idx ON businesses(slug);

-- ─────────────────────────────────────────
-- SERVICES
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS services (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  description      TEXT,
  price            NUMERIC(10,2) NOT NULL DEFAULT 0,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  image_url        TEXT,
  active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS services_business_id_idx ON services(business_id);

-- ─────────────────────────────────────────
-- SERVICE CATEGORIES
-- Owner-defined groupings shown as filters on the booking page.
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS service_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS service_categories_business_id_idx ON service_categories(business_id);

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES service_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS services_category_id_idx ON services(category_id);

-- ─────────────────────────────────────────
-- STAFF MEMBERS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  role        TEXT,
  avatar_url  TEXT,
  bio         TEXT,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS staff_members_business_id_idx ON staff_members(business_id);

-- Which staff member performs which service. An empty set for a member means
-- "performs every service", so businesses that never assign services still work.
CREATE TABLE IF NOT EXISTS staff_services (
  staff_member_id UUID NOT NULL REFERENCES staff_members(id) ON DELETE CASCADE,
  service_id      UUID NOT NULL REFERENCES services(id)      ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (staff_member_id, service_id)
);

CREATE INDEX IF NOT EXISTS staff_services_service_id_idx ON staff_services(service_id);

-- ─────────────────────────────────────────
-- WORKING HOURS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS working_hours (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  day_of_week  SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  is_open      BOOLEAN NOT NULL DEFAULT TRUE,
  open_time    TIME,
  close_time   TIME,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (business_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS working_hours_business_id_idx ON working_hours(business_id);

-- ─────────────────────────────────────────
-- CUSTOMERS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  phone       TEXT,
  email       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS customers_business_id_idx ON customers(business_id);
CREATE INDEX IF NOT EXISTS customers_email_idx ON customers(email);

-- ─────────────────────────────────────────
-- APPOINTMENTS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS appointments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  service_id       UUID NOT NULL REFERENCES services(id),
  staff_member_id  UUID REFERENCES staff_members(id),
  customer_id      UUID REFERENCES customers(id),
  customer_name    TEXT NOT NULL,
  customer_phone   TEXT,
  customer_email   TEXT,
  appointment_date DATE NOT NULL,
  start_time       TIME NOT NULL,
  end_time         TIME NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','confirmed','cancelled','completed')),
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS appointments_business_id_idx  ON appointments(business_id);
CREATE INDEX IF NOT EXISTS appointments_date_idx         ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS appointments_staff_id_idx     ON appointments(staff_member_id);

-- ─────────────────────────────────────────
-- UPDATED_AT TRIGGER
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at        BEFORE UPDATE ON profiles        FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER businesses_updated_at      BEFORE UPDATE ON businesses      FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER services_updated_at        BEFORE UPDATE ON services        FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER service_categories_updated_at BEFORE UPDATE ON service_categories FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER staff_members_updated_at   BEFORE UPDATE ON staff_members   FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER working_hours_updated_at   BEFORE UPDATE ON working_hours   FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER customers_updated_at       BEFORE UPDATE ON customers       FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER appointments_updated_at    BEFORE UPDATE ON appointments    FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ─────────────────────────────────────────
-- NEW-USER PROFILE TRIGGER
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses     ENABLE ROW LEVEL SECURITY;
ALTER TABLE services            ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_categories  ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_services      ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE working_hours  ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments   ENABLE ROW LEVEL SECURITY;

-- ─── PROFILES ─────────────────────────────
CREATE POLICY "profiles: owner select"
  ON profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles: owner insert"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles: owner update"
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- ─── BUSINESSES ───────────────────────────
CREATE POLICY "businesses: owner all"
  ON businesses FOR ALL USING (owner_id = auth.uid());

CREATE POLICY "businesses: public select"
  ON businesses FOR SELECT USING (true);

-- ─── SERVICES ─────────────────────────────
CREATE POLICY "services: owner all"
  ON services FOR ALL USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );

CREATE POLICY "services: public select active"
  ON services FOR SELECT USING (active = true);

-- ─── SERVICE CATEGORIES ───────────────────
CREATE POLICY "service_categories: owner all"
  ON service_categories FOR ALL USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );

CREATE POLICY "service_categories: public select"
  ON service_categories FOR SELECT USING (true);

-- ─── STAFF SERVICES ───────────────────────
CREATE POLICY "staff_services: owner all"
  ON staff_services FOR ALL USING (
    staff_member_id IN (
      SELECT id FROM staff_members
      WHERE business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
    )
  );

CREATE POLICY "staff_services: public select"
  ON staff_services FOR SELECT USING (true);

-- ─── STAFF MEMBERS ────────────────────────
CREATE POLICY "staff: owner all"
  ON staff_members FOR ALL USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );

CREATE POLICY "staff: public select active"
  ON staff_members FOR SELECT USING (active = true);

-- ─── WORKING HOURS ────────────────────────
CREATE POLICY "hours: owner all"
  ON working_hours FOR ALL USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );

CREATE POLICY "hours: public select"
  ON working_hours FOR SELECT USING (true);

-- ─── CUSTOMERS ────────────────────────────
CREATE POLICY "customers: owner all"
  ON customers FOR ALL USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );

CREATE POLICY "customers: public insert"
  ON customers FOR INSERT WITH CHECK (true);

-- ─── APPOINTMENTS ─────────────────────────
CREATE POLICY "appointments: owner all"
  ON appointments FOR ALL USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );

CREATE POLICY "appointments: public insert"
  ON appointments FOR INSERT WITH CHECK (true);

CREATE POLICY "appointments: public select own"
  ON appointments FOR SELECT USING (true);

-- ─────────────────────────────────────────
-- STORAGE BUCKETS
-- ─────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos',   'logos',   true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('services','services', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "logos public read"
  ON storage.objects FOR SELECT USING (bucket_id = 'logos');

CREATE POLICY "logos owner upload"
  ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'logos' AND auth.uid() IS NOT NULL
  );

CREATE POLICY "logos owner update"
  ON storage.objects FOR UPDATE USING (
    bucket_id = 'logos' AND auth.uid() IS NOT NULL
  );

CREATE POLICY "avatars public read"
  ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "avatars owner upload"
  ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'avatars' AND auth.uid() IS NOT NULL
  );

CREATE POLICY "services public read"
  ON storage.objects FOR SELECT USING (bucket_id = 'services');

CREATE POLICY "services owner upload"
  ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'services' AND auth.uid() IS NOT NULL
  );

-- ─────────────────────────────────────────
-- PUSH REMINDERS
-- ─────────────────────────────────────────
-- Track when a push reminder was sent so the cron doesn't re-send it.
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS push_reminder_sent_at TIMESTAMPTZ;
