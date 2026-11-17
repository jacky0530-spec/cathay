-- Version 001: never store plain VIP authorization codes.
CREATE TABLE IF NOT EXISTS vip_codes (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL CHECK(length(label) BETWEEN 1 AND 80),
  code_hash TEXT NOT NULL UNIQUE,
  code_hint TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0, 1)),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_used_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_vip_codes_active ON vip_codes(active);
CREATE TABLE IF NOT EXISTS rate_limits (
  ip_hash TEXT PRIMARY KEY,
  window_expires INTEGER NOT NULL,
  attempts INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS admin_audit (
  id TEXT PRIMARY KEY,
  actor_uid TEXT NOT NULL,
  action TEXT NOT NULL,
  target_id TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_time ON admin_audit(created_at DESC);
