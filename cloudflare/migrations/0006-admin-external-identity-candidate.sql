-- Bellaquitas Fest | CANDIDATO OIDC, NO APLICAR A D1 REAL.
-- Vinculación EXPLÍCITA desde administrador existente y sesión Google reciente.
-- El login del proveedor NO inserta perfiles ni concede roles.
-- Proveedor/email son datos diferentes: nunca enlazar cuentas por email.
CREATE TABLE IF NOT EXISTS admin_external_identities (
  provider TEXT NOT NULL CHECK(provider IN ('clerk','auth0')),
  issuer TEXT NOT NULL CHECK(length(issuer) BETWEEN 10 AND 512),
  subject TEXT NOT NULL CHECK(length(subject) BETWEEN 1 AND 256),
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (provider,issuer,subject),
  UNIQUE (provider,profile_id)
);
CREATE INDEX IF NOT EXISTS idx_admin_external_identity_profile
  ON admin_external_identities(profile_id);

-- Esta tabla por sí sola NO habilita autenticación externa.
-- No existe ruta en el Worker actual que cree o lea estas vinculaciones.
