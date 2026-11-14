-- Bellaquitas Fest | Panel SSO SIN segunda contraseña.
-- SOLO candidato local; no aplicar sobre D1 remoto antes de preparar el corte.
-- Una sesión admin está ligada a la sesión pública verificada original.
-- Borrar o caducar la sesión pública invalida automáticamente la administrativa.
CREATE TABLE IF NOT EXISTS admin_sso_sessions (
 token_hash TEXT PRIMARY KEY,
 parent_token_hash TEXT NOT NULL REFERENCES auth_sessions(token_hash) ON DELETE CASCADE,
 profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 expires_at INTEGER NOT NULL,
 created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_admin_sso_parent ON admin_sso_sessions(parent_token_hash);
CREATE INDEX IF NOT EXISTS idx_admin_sso_expiry ON admin_sso_sessions(expires_at);
