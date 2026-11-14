-- Solo para candidato de fase 5. No aplicar sobre D1 remota hasta autorización.
-- Vínculo correo/contraseña al perfil admin EXISTENTE con doble verificación.
CREATE TABLE IF NOT EXISTS auth_admin_activation_tokens (
  token_hash TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  email TEXT NOT NULL COLLATE NOCASE,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  CHECK(length(token_hash) = 43),
  CHECK(expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS idx_admin_activation_expiration
  ON auth_admin_activation_tokens(expires_at);

CREATE TABLE IF NOT EXISTS auth_admin_activation_rate (
  profile_id TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  window_start INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_sent_at INTEGER NOT NULL DEFAULT 0
);
