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


-- Estatísticas agregadas do catálogo. Não guarda IP, nome ou navegador.
-- O identificador aleatório aceito pelo visitante só vira um hash diferente a cada dia.
CREATE TABLE IF NOT EXISTS analytics_daily (
  day TEXT PRIMARY KEY,
  views INTEGER NOT NULL DEFAULT 0,
  visitors INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS analytics_visitors (
  day TEXT NOT NULL,
  visitor_hash TEXT NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  actions INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, visitor_hash)
);
CREATE TABLE IF NOT EXISTS analytics_actions (
  day TEXT NOT NULL,
  kind TEXT NOT NULL,
  product_id TEXT NOT NULL DEFAULT '',
  total INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, kind, product_id)
);
CREATE INDEX IF NOT EXISTS idx_catalog_analytics_actions_day ON analytics_actions(day);


-- Teto de gravações: limita o impacto de acessos automatizados no plano gratuito.
CREATE TABLE IF NOT EXISTS analytics_budget (
  day TEXT PRIMARY KEY,
  events INTEGER NOT NULL DEFAULT 0
);
