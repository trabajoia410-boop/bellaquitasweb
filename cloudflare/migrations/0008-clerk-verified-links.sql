-- Bellaquitas Fest / Fase 6 - enlaces Clerk verificados, nunca por correo.
-- No modificar perfiles, puntos, visitas, identidades Google ni sesiones legadas.
-- Ejecutar exclusivamente en una base de prueba/tras copia y validación de corte.
CREATE TABLE IF NOT EXISTS auth_clerk_links (
  clerk_user_id TEXT PRIMARY KEY
    CHECK(clerk_user_id GLOB 'user_*' AND length(clerk_user_id) BETWEEN 15 AND 140),
  profile_id TEXT NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  link_method TEXT NOT NULL DEFAULT 'migration_confirmed'
    CHECK(link_method='migration_confirmed'),
  verified_at INTEGER NOT NULL CHECK(verified_at>0),
  linked_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_clerk_links_profile ON auth_clerk_links(profile_id);
-- No hay INSERT ni UPDATE de perfiles. Nunca emparejar correo de forma automática.
