-- =============================================================
-- GMS Events CMS — Initial Schema
-- =============================================================

-- ── Extensions ────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Enums ─────────────────────────────────────────────────────
CREATE TYPE payment_status AS ENUM ('pending', 'verified', 'rejected');
CREATE TYPE scan_type AS ENUM ('toolkit', 'event');
CREATE TYPE staff_role AS ENUM ('super_admin', 'admin', 'viewer', 'scanner');

-- ── Tables ────────────────────────────────────────────────────

CREATE TABLE events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  slug        TEXT        UNIQUE NOT NULL,
  date        DATE        NOT NULL,
  location    TEXT        NOT NULL,
  is_active   BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE packages (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,  -- 'A' | 'B' | 'C'
  price         NUMERIC(12,2) NOT NULL,
  toolkit_items JSONB       NOT NULL DEFAULT '[]'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE registrations (
  id                     UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id               UUID           NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  full_name              TEXT           NOT NULL,
  email                  TEXT           NOT NULL,
  phone                  TEXT,
  gms_church             TEXT           NOT NULL,
  nij                    TEXT,
  package_id             UUID           NOT NULL REFERENCES packages(id),
  payment_screenshot_url TEXT,
  payment_status         payment_status NOT NULL DEFAULT 'pending',
  payment_notes          TEXT,
  qr_token               UUID           UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  created_at             TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, email)
);

CREATE TABLE attendance_logs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID        NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  event_id        UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  scan_type       scan_type   NOT NULL,
  scanned_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  scanned_by      UUID        REFERENCES auth.users(id),
  UNIQUE (registration_id, scan_type)  -- prevent double-scan of the same type
);

CREATE TABLE staff_users (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT        NOT NULL,
  role        staff_role  NOT NULL DEFAULT 'viewer',
  event_scope UUID        REFERENCES events(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX idx_registrations_event_id  ON registrations(event_id);
CREATE INDEX idx_registrations_qr_token  ON registrations(qr_token);
CREATE INDEX idx_registrations_email     ON registrations(email);
CREATE INDEX idx_attendance_reg_id       ON attendance_logs(registration_id);
CREATE INDEX idx_packages_event_id       ON packages(event_id);
CREATE INDEX idx_staff_users_role        ON staff_users(role);

-- ── Security-definer helpers (avoid RLS recursion) ────────────
-- These run as the function owner (postgres), bypassing RLS on staff_users.

CREATE OR REPLACE FUNCTION is_staff()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM staff_users WHERE id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS staff_role
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM staff_users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION get_my_event_scope()
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT event_scope FROM staff_users WHERE id = auth.uid();
$$;

-- ── Row Level Security ─────────────────────────────────────────
ALTER TABLE events          ENABLE ROW LEVEL SECURITY;
ALTER TABLE packages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_users     ENABLE ROW LEVEL SECURITY;

-- events ──────────────────────────────────────────────────────
-- Public: read active events only (for registration form)
CREATE POLICY "public_read_active_events" ON events
  FOR SELECT USING (is_active = true);

-- Staff: read all events (scoped by event_scope or all if null)
CREATE POLICY "staff_read_all_events" ON events
  FOR SELECT USING (is_staff());

-- Super admin: full management
CREATE POLICY "super_admin_manage_events" ON events
  FOR ALL USING (get_my_role() = 'super_admin');

-- packages ────────────────────────────────────────────────────
-- Public: read all packages (displayed on registration form)
CREATE POLICY "public_read_packages" ON packages
  FOR SELECT USING (true);

-- Super admin: full management
CREATE POLICY "super_admin_manage_packages" ON packages
  FOR ALL USING (get_my_role() = 'super_admin');

-- registrations ───────────────────────────────────────────────
-- Anyone can INSERT (public registration form)
CREATE POLICY "public_insert_registrations" ON registrations
  FOR INSERT WITH CHECK (true);

-- Staff can SELECT registrations within their event scope
CREATE POLICY "staff_read_registrations" ON registrations
  FOR SELECT USING (
    is_staff()
    AND (
      get_my_event_scope() IS NULL
      OR get_my_event_scope() = event_id
    )
  );

-- Admin/super_admin can UPDATE registrations (e.g. verify payment)
CREATE POLICY "admin_update_registrations" ON registrations
  FOR UPDATE USING (
    get_my_role() IN ('super_admin', 'admin')
    AND (
      get_my_event_scope() IS NULL
      OR get_my_event_scope() = event_id
    )
  );

-- attendance_logs ─────────────────────────────────────────────
-- Scanner/admin/super_admin can INSERT
CREATE POLICY "scanner_insert_logs" ON attendance_logs
  FOR INSERT WITH CHECK (
    get_my_role() IN ('super_admin', 'admin', 'scanner')
  );

-- All staff can SELECT logs
CREATE POLICY "staff_read_logs" ON attendance_logs
  FOR SELECT USING (is_staff());

-- staff_users ─────────────────────────────────────────────────
-- Staff can read all staff records (own profile needed for role checks in UI)
CREATE POLICY "staff_read_staff_users" ON staff_users
  FOR SELECT USING (is_staff());

-- Super admin: full management
CREATE POLICY "super_admin_manage_staff" ON staff_users
  FOR ALL USING (get_my_role() = 'super_admin');

-- Allow own insert for first super_admin bootstrap via service role
-- (service role bypasses RLS entirely)

-- ── Seed: Test event ──────────────────────────────────────────
INSERT INTO events (id, name, slug, date, location, is_active)
VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'AOG Conference 2026',
  'aog-2026',
  '2026-08-15',
  'GMS Surabaya Convention Center',
  true
);

-- Seed: Packages for AOG Conference 2026
INSERT INTO packages (event_id, name, price, toolkit_items) VALUES
  (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'A',
    350000,
    '["Conference Bag", "Notebook & Pen", "Lanyard", "T-Shirt", "Meals (3×)"]'
  ),
  (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'B',
    250000,
    '["Conference Bag", "Notebook & Pen", "Lanyard", "Meals (2×)"]'
  ),
  (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'C',
    150000,
    '["Lanyard", "Meals (1×)"]'
  );
