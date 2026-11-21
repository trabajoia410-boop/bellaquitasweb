-- Bellaquitas Fest | correo/contraseña | STAGING ONLY
-- Las cuentas actuales de Google no tienen contraseña ni se vinculan por email.
-- Esta migración agrega tablas aisladas; no actualiza perfiles/puntos/visitas.
CREATE TABLE IF NOT EXISTS auth_email_credentials (
 email TEXT PRIMARY KEY COLLATE NOCASE,
 profile_id TEXT NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
 password_hash TEXT NOT NULL,
 password_salt TEXT NOT NULL,
 password_iterations INTEGER NOT NULL CHECK(password_iterations >= 600000),
 verified_at INTEGER NOT NULL,
 created_at INTEGER NOT NULL DEFAULT (unixepoch()),
 updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_email_credentials_profile ON auth_email_credentials(profile_id);
CREATE TABLE IF NOT EXISTS auth_email_tokens (
 token_hash TEXT PRIMARY KEY,
 email TEXT NOT NULL COLLATE NOCASE,
 purpose TEXT NOT NULL CHECK (purpose IN ('register','reset')),
 profile_name TEXT,
 password_hash TEXT,
 password_salt TEXT,
 password_iterations INTEGER,
 expires_at INTEGER NOT NULL,
 created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_email_tokens_email_purpose ON auth_email_tokens(email,purpose);
CREATE INDEX IF NOT EXISTS idx_email_tokens_expiry ON auth_email_tokens(expires_at);
CREATE TABLE IF NOT EXISTS auth_email_rate_limits (
 key_hash TEXT PRIMARY KEY,
 attempts INTEGER NOT NULL DEFAULT 0,
 expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_email_limits_expiry ON auth_email_rate_limits(expires_at);
