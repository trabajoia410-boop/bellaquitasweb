-- Bellaquitas Fest / Fase 6: inmutabilidad de evidencia YA confirmada.
-- DDL ONLY: no accounts, points, visits, sessions or roles are modified.
-- A verified Clerk link must never swap proof from Google to a different
-- identity from the same legacy profile; revocation requires separate audit.
CREATE TRIGGER IF NOT EXISTS trg_clerk_confirmed_evidence_immutable
BEFORE UPDATE OF evidence_provider,evidence_subject,verified_at,linked_at
ON auth_clerk_links
WHEN OLD.link_method='migration_confirmed' AND (
  NEW.evidence_provider IS NOT OLD.evidence_provider OR
  NEW.evidence_subject IS NOT OLD.evidence_subject OR
  NEW.verified_at IS NOT OLD.verified_at OR
  NEW.linked_at IS NOT OLD.linked_at
)
BEGIN
  SELECT RAISE(ABORT,'Evidencia Clerk confirmada inmutable');
END;
