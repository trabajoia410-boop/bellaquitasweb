# Bellaquitas Fest — conciliación comprobada D1, sin acceso al proveedor antiguo

**Fecha:** 17 de noviembre de 2026 · **Modo:** lecturas remotas exclusivamente, sin mutaciones, tokens ni datos personales en este informe.

## Bases comparadas
- Recuperación del export original: `bellaquitas-origen-recuperacion-20261116` (6 perfiles).
- Staging: `bellaquitas-staging` (7 perfiles).
- Destino aislado: `bellaquitas-produccion-preparada-20261116` (7 perfiles).

## Resultado real: 19 tablas revisadas
- **16/16 tablas que deben replicarse coinciden exactamente fila a fila**, incluida `profiles` (7), `auth_identity_links` (7), `auth_email_credentials` (1), `events` (1), `activity` (2), `admin_member_changes` (3), `site_content` (1), `site_drafts` (1) y todas las tablas vacías de negocio.
- **Tres diferencias esperadas, NO errores:** `auth_admin_sessions` (1 sesión en staging, 0 en destino), `media_migration_log` (3 registros técnicos en staging, 0 en destino), `migration_audit` (9 registros técnicos en staging, 0 en destino). No trasladar sesiones ni marcadores técnicos antiguos para evitar sesiones o estados de migración reutilizables; tampoco copiarlos para aparentar paridad.
- Los **6 perfiles y los 6 vínculos Google** de la recuperación original están contenidos íntegros en la D1 destino. El séptimo usuario de staging (correo verificado y credencial) se conserva.
- **44/44 objetos de esquema** idénticos, **0 errores de claves foráneas**.
- Destino: **7 perfiles, 2 admins, 1.999.998 puntos actuales, 1.999.998 puntos históricos, 0 visitas.**
- Solo se ejecutaron SELECT y `PRAGMA foreign_key_check`; no se han copiado o editado datos ni compartido emails, IDs, hashes o credenciales.

## Qué significa y qué NO significa
Esta auditoría **cierra la comparación interna D1** a fecha de verificación. **No acredita** que la antigua plataforma no haya recibido nuevos usuarios, nuevas visitas, cambios de puntos u operaciones desde que se exportaron los ocho CSV. El origen original ya no se consulta, por la instrucción de no usar Supabase. **No inventar ni marcar como completada la conciliación final entre proveedores.**

En el corte definitivo deberán comparar una fuente actual y autorizada o garantizar un periodo de congelación verificable de escrituras y cuentas, conservar la cuenta de correo exclusiva de staging y bloquear divergencias antes de enviar tráfico al nuevo Worker. Si no es posible obtener esa prueba, **la publicación continúa bloqueada**.

## Dependencias que continúan abiertas
- El Worker de preproducción **no** tiene credenciales reales de Google OAuth y Resend; solo staging conserva sus secretos no recuperables en claro.
- Existe respaldo cifrado original AES-256-GCM de los ocho CSV y restauración aislada verificada, pero **no** se ha acreditado nueva clave privada fuera del chat ni un `pg_dump` completo de autenticación de la fuente.
- Cloudflare DNS de `bellaquitas.fr` sigue `pending` y sin rutas públicas.
- El JPG original `62609.jpg`, los MP4, logos, favicon, SEO, ES/FR y la administración independiente ya están recuperados y probados en la rama y los Workers aislados.

No tocar `main`, Hostinger, DNS activo, cuentas, puntos ni visitas para suplir estas pruebas.
