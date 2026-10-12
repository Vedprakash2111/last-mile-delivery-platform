-- Admin console migration — idempotent, safe to re-run on Neon.
-- Run with: psql $DATABASE_URL -f db/migrations/2026_10_admin.sql

-- =====================================================================
-- 1. Audit log table
-- =====================================================================
CREATE TABLE IF NOT EXISTS admin_audit_log (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    actor_user_id  uuid        REFERENCES users(id) ON DELETE SET NULL,
    action         text        NOT NULL,
    target_type    text        NOT NULL CHECK (target_type IN ('user','driver','merchant','warehouse')),
    target_id      uuid        NOT NULL,
    target_label   text        NOT NULL,          -- snapshot, e.g. driver name, so the log stays readable
    details        jsonb       NOT NULL DEFAULT '{}'::jsonb,   -- never secrets/tokens/passwords
    ip             inet,
    occurred_at    timestamptz NOT NULL DEFAULT now()
);

-- =====================================================================
-- 2. Immutability trigger (append-only)
-- =====================================================================
CREATE OR REPLACE FUNCTION admin_audit_log_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'admin_audit_log is append-only'; END $$;

DROP TRIGGER IF EXISTS trg_admin_audit_log_immutable ON admin_audit_log;
CREATE TRIGGER trg_admin_audit_log_immutable
  BEFORE UPDATE OR DELETE ON admin_audit_log
  FOR EACH ROW EXECUTE FUNCTION admin_audit_log_immutable();

-- =====================================================================
-- 3. Indexes on admin_audit_log
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_audit_occurred ON admin_audit_log (occurred_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor    ON admin_audit_log (actor_user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_target   ON admin_audit_log (target_type, target_id);

-- =====================================================================
-- 4. Supplemental indexes on existing tables
-- =====================================================================
-- Case-insensitive unique merchant name (used by uq_merchants_name_ci constraint in admin create)
CREATE UNIQUE INDEX IF NOT EXISTS uq_merchants_name_ci ON merchants (lower(btrim(name)));

-- Orders list / cursor pagination
CREATE INDEX IF NOT EXISTS idx_orders_created        ON orders (created_at DESC, id DESC);

-- Activity page: filter by to_status and occurred_at
CREATE INDEX IF NOT EXISTS idx_order_events_occurred ON order_events (occurred_at, to_status);

-- Driver segment tabs and overview
CREATE INDEX IF NOT EXISTS idx_drivers_status        ON drivers (status);
