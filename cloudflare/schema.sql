-- Exclusivo do catálogo de chaveiros PET. Nunca usar banco do Inventário PET.
CREATE TABLE IF NOT EXISTS documents (
  name TEXT PRIMARY KEY CHECK (name IN ('products', 'config')),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  content TEXT NOT NULL CHECK (json_valid(content)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash TEXT PRIMARY KEY,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_catalog_sessions_exp ON admin_sessions(expires_at);
CREATE TABLE IF NOT EXISTS login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_catalog_login_attempts ON login_attempts(ip_hash, created_at);
