-- Seguridad del acceso administrador: probar que la sesión se emitió
-- al completar Google OAuth, no por un login cualquiera del mismo perfil.
-- Fase 5; SOLO candidato local. No aplicar a Cloudflare D1 remoto.
ALTER TABLE auth_sessions ADD COLUMN auth_method TEXT NOT NULL DEFAULT 'unknown'
  CHECK(auth_method IN ('unknown','google','email'));
CREATE INDEX IF NOT EXISTS idx_auth_sessions_admin_reauth
  ON auth_sessions(profile_id,auth_method,created_at);

-- Las sesiones antiguas pasan a 'unknown' y NO podrán activar contraseñas
-- de administrador hasta realizar un Google OAuth nuevo y verificado.
