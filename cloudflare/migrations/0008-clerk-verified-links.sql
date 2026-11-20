-- Bellaquitas Fest / Fase 6: enlaces Clerk verificados, nunca por email o nombre.
-- NO migrar perfiles ni puntos; NO ejecutar en producción sin autenticación
-- previa de ambas identidades y conciliación confirmada por administrador.
-- Solo vínculos con estado migration_confirmed autorizan la sesión.
CREATE TABLE IF NOT EXISTS auth_clerk_links (
  clerk_user_id TEXT PRIMARY KEY NOT NULL
    CHECK(clerk_user_id GLOB 'user_*' AND length(clerk_user_id) BETWEEN 15 AND 140),
  profile_id TEXT NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE RESTRICT,
  link_method TEXT NOT NULL DEFAULT 'pending'
    CHECK(link_method IN ('pending','migration_confirmed')),
  evidence_provider TEXT NOT NULL CHECK(evidence_provider IN ('google','email')),
  evidence_subject TEXT NOT NULL CHECK(length(evidence_subject) BETWEEN 1 AND 250),
  verified_at INTEGER CHECK(verified_at IS NULL OR verified_at > 0),
  linked_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(evidence_provider,evidence_subject),
  CHECK(link_method != 'migration_confirmed' OR verified_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_clerk_links_profile
  ON auth_clerk_links(profile_id);

-- La identidad histórica demostrada debe pertenecer exactamente al mismo perfil.
-- NO prueba por sí sola que el sujeto Clerk exista: esto se verifica por JWT
-- firmado y por identidad externa del proveedor ANTES de confirmar el vínculo.
CREATE TRIGGER IF NOT EXISTS trg_clerk_source_proof_insert
BEFORE INSERT ON auth_clerk_links
BEGIN
  SELECT RAISE(ABORT,'Identidad de origen no coincide con el perfil')
  WHERE NOT EXISTS (
    SELECT 1 FROM auth_identity_links old
    WHERE old.profile_id=NEW.profile_id
      AND old.provider=NEW.evidence_provider
      AND old.provider_subject=NEW.evidence_subject
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_clerk_source_proof_update
BEFORE UPDATE OF link_method,verified_at,evidence_provider,evidence_subject
ON auth_clerk_links
BEGIN
  SELECT RAISE(ABORT,'Identidad de origen no coincide con el perfil')
  WHERE NOT EXISTS (
    SELECT 1 FROM auth_identity_links old
    WHERE old.profile_id=NEW.profile_id
      AND old.provider=NEW.evidence_provider
      AND old.provider_subject=NEW.evidence_subject
  );
  SELECT RAISE(ABORT,'Vínculo confirmado no puede perder verificación')
  WHERE OLD.link_method='migration_confirmed'
    AND NEW.link_method!='migration_confirmed';
END;

-- Ninguna actualización ordinaria puede reasignar un perfil/usuario existente.
CREATE TRIGGER IF NOT EXISTS trg_clerk_no_reassignment
BEFORE UPDATE OF clerk_user_id,profile_id ON auth_clerk_links
BEGIN
  SELECT RAISE(ABORT,'Enlace Clerk inmutable');
END;
