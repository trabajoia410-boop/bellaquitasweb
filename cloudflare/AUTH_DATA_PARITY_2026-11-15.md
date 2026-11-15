# Bellaquitas Fest — conciliación de identidad y preflight de administración

Fecha: **15/11/2026**. Consultas de solo lectura sobre Supabase activo y D1 staging. No se copiaron identificadores ni emails a GitHub.

## Datos de contenido (comparación campo a campo)

Se verificaron *todos* los registros existentes y campos compartidos de:
- `profiles`: 6 registros iguales; 1 registro adicional solo en Cloudflare
- `events`: 1 igual, 0 distintos
- `activity`: 2 iguales, 0 distintos
- `admin_member_changes`: 3 iguales, 0 distintos
- `site_content`: 1 igual, incluyendo `page_settings` completo
- `site_drafts`: 1 igual, incluyendo `settings` completo

Se normalizaron los formatos de fechas, booleanos y JSON por diferencias Postgres/SQLite. Comparaciones por la clave primaria real y todas las claves/valores compartidos. Se han revisado **14 registros idénticos** y un perfil extra en Cloudflare; no implica que el sistema de autenticación esté listo para publicación.

## Correspondencia Google y control de roles

Supabase:
- 6 filas en `auth.users`, 6 identidades Google y 6 perfiles.
- **0 perfiles huérfanos y 0 usuarios de Auth sin perfil**.
- 2 administradores y 1 personal de puerta, con identidades Google existentes.

Cloudflare staging:
- 7 perfiles, 7 identidades vinculadas: **6 Google + 1 correo**.
- Los **6 pares `profile_id` y `google provider_subject`** de staging coinciden EXACTAMENTE con la clave del perfil y el identificador `provider_id`/`sub` de Supabase.
- Los 2 administradores y el personal de puerta están vinculados a los mismos registros.
- La identidad extra por correo es el socio sin puntos ni visitas creado solo en Cloudflare; no eliminar hasta resolver si es una prueba o una cuenta legítima.

**Esto prueba correspondencia de cuentas, NO que el inicio de sesión real de Google/correo funcione en Cloudflare**; se requieren OAuth/secretos configurados y ensayo interactivo de los dos administradores.

## Incidencia: la D1 de preparación no tiene todavía las tablas del panel reforzado

| Tabla administrativa | D1 staging | D1 QA aislada |
| --- | --- | --- |
| `auth_admin_sessions` (migración 0007) | **AUSENTE** | Presente |
| `auth_admin_email_links` (migración 0008) | **AUSENTE** | Presente |

Las rutas del panel requieren `auth_admin_sessions`. Por tanto, **no se puede considerar lista la reautenticación administrativa en staging**, aunque las dos cuentas Google estén correctamente importadas.

La migración `0007-admin-step-up.sql` y la `0008-admin-email-link.sql` están versionadas. El archivo `cloudflare/test-admin-migration-preflight.mjs` ensaya la aplicación de ambas sobre SQLite en memoria con una cuenta ficticia: dos ejecuciones seguidas, índices, FK, ausencia de cambios de puntos/sesiones y resistencia a duplicados.

**No se ha ejecutado ninguna de estas migraciones sobre la D1 de staging ni Supabase en esta comprobación**. Antes de aplicarlas a staging: copia/snapshot verificable, revisión de migración, autorización de ventana controlada y prueba de rollback. `ADMIN_EMAIL_LINK_ENABLED` debe permanecer en `no` durante el ensayo no interactivo.

## Reglas de publicación

- Mantener `bellaquitas.fr` y DNS tal como están.
- Mantener PR #3 como borrador.
- Repetir concordancia completa de Google, roles, perfiles, eventos y contenido inmediatamente antes del corte final.
- No activar panel administrativo hasta tener esquema 0007, 0008, doble inicio real y recuperación segura.
- Nunca publicar cuentas/IDs/correos, hashes de tokens ni claves de respaldo en registros o comentarios.
