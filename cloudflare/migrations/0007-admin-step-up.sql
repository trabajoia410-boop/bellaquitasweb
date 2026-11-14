-- Bellaquitas Fest: acceso administrativo reforzado (SOLO rama de pruebas).
-- La apertura de /administracion/ exige volver a autenticarse con Google o contraseña verificada.
-- No concede roles ni modifica puntos, visitas o credenciales.
CREATE TABLE IF NOT EXISTS auth_admin_sessions (
  token_hash TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  regular_session_hash TEXT NOT NULL REFERENCES auth_sessions(token_hash) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_profile_expiry ON auth_admin_sessions(profile_id,expires_at);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_regular ON auth_admin_sessions(regular_session_hash);
