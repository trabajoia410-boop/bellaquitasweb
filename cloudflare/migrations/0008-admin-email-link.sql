-- Bellaquitas Fest — vinculación de contraseña de administrador, solo tras reautenticación.
-- No cambia los roles, los perfiles ni los saldos.
-- NO aplicar en producción antes de la revisión de seguridad y backup.
CREATE TABLE IF NOT EXISTS auth_admin_email_links (
  token_hash TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  email TEXT NOT NULL COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_iterations INTEGER NOT NULL CHECK(password_iterations >= 600000),
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_email_links_profile ON auth_admin_email_links(profile_id);
CREATE INDEX IF NOT EXISTS idx_admin_email_links_expiry ON auth_admin_email_links(expires_at);
