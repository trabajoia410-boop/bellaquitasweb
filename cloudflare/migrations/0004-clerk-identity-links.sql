-- Bellaquitas Fest / Fase 6: Vinculación Clerk -> perfiles existentes.
-- No migra usuarios automáticamente ni concede roles.
-- Aplicar inicialmente SOLO en una base D1 aislada de QA.
-- No insertar vínculos 'migration_confirmed' hasta comprobar posesión
-- de la identidad anterior y actual mediante autenticación verificada.
CREATE TABLE IF NOT EXISTS auth_clerk_links (
  clerk_user_id TEXT PRIMARY KEY NOT NULL
    CHECK (clerk_user_id GLOB 'user_*' AND length(clerk_user_id) BETWEEN 15 AND 140),
  profile_id TEXT NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE RESTRICT,
  link_method TEXT NOT NULL DEFAULT 'pending'
    CHECK (link_method IN ('pending', 'migration_confirmed')),
  evidence_provider TEXT NOT NULL CHECK (evidence_provider IN ('google', 'email')),
  evidence_subject TEXT NOT NULL CHECK (length(evidence_subject) BETWEEN 1 AND 250),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  confirmed_at TEXT,
  CHECK (link_method != 'migration_confirmed' OR confirmed_at IS NOT NULL),
  UNIQUE (evidence_provider, evidence_subject)
);
CREATE INDEX IF NOT EXISTS idx_auth_clerk_links_status
  ON auth_clerk_links(link_method);

-- Impedir vincular un perfil a una identidad de origen que pertenezca a otro.
CREATE TRIGGER IF NOT EXISTS trg_clerk_link_proof_insert
BEFORE INSERT ON auth_clerk_links
BEGIN
  SELECT RAISE(ABORT, 'Identidad de origen no pertenece al perfil')
  WHERE NOT EXISTS (
    SELECT 1 FROM auth_identity_links i
    WHERE i.profile_id=NEW.profile_id
      AND i.provider=NEW.evidence_provider
      AND i.provider_subject=NEW.evidence_subject
  );
END;
CREATE TRIGGER IF NOT EXISTS trg_clerk_link_proof_update
BEFORE UPDATE OF link_method, evidence_provider, evidence_subject, confirmed_at
ON auth_clerk_links
BEGIN
  SELECT RAISE(ABORT, 'Identidad de origen no pertenece al perfil')
  WHERE NOT EXISTS (
    SELECT 1 FROM auth_identity_links i
    WHERE i.profile_id=NEW.profile_id
      AND i.provider=NEW.evidence_provider
      AND i.provider_subject=NEW.evidence_subject
  );
END;

-- Una vinculación validada no puede cambiar de identidad o de perfil.
-- Cualquier reparación requiere una migración administrativa auditada.
CREATE TRIGGER IF NOT EXISTS trg_clerk_link_identity_immutable
BEFORE UPDATE OF clerk_user_id, profile_id ON auth_clerk_links
BEGIN
  SELECT RAISE(ABORT, 'La identidad vinculada es inmutable');
END;
