# Bellaquitas Fest — Migraciones administrativas 0007 / 0008 instaladas en D1 staging

**Fecha:** 15/11/2026. **Entorno modificado:** solamente D1 `bellaquitas-staging` (`c7ada9c9-d397-4e22-b5b8-3fbd8d13e550`). **No se modificó Supabase, DNS, GitHub main, puntos ni visitas.**

## 1. Protección antes de modificar la base

Se comprobaron, antes de ejecutar SQL:

- Archivo cifrado privado existente `staging-full-20261114-01` en la base D1 privada `bellaquitas-encrypted-backups-20261114`; algoritmo AES-256-GCM. **La clave antigua está marcada para rotación: no se puede considerar resuelto el respaldo definitivo.**
- Restauración independiente `bellaquitas-restore-isolated-20261114` comparada en modo lectura contra D1 staging.
- **20 tablas con esquemas idénticos, 18 objetos adicionales (índices/triggers/vistas) idénticos y 44 registros completos iguales en los dos entornos**, no solo los recuentos.
- Cloudflare D1 Time Travel proporcionó un bookmark previo a la modificación. Se guardó **solo en la base privada de respaldos** bajo `pre-admin-0007-0008-20261115`, vinculado a la restauración aislada y a los 7 perfiles / 1.999.998 puntos. No se añadió el identificador de bookmark ni ninguna credencial a GitHub.
- Worker `bellaquitas-api-staging`: `STAGING_MUTATIONS=disabled`; las altas de cuentas siguen desactivadas. No se activó `ADMIN_EMAIL_LINK_ENABLED`.

## 2. Aplicación real

Se descargó SQL **versionado** desde la rama segura, validando que las seis instrucciones fueran exclusivamente creación de estas dos tablas y cuatro índices:

- `cloudflare/migrations/0007-admin-step-up.sql`: crea `auth_admin_sessions`, `idx_admin_sessions_profile_expiry`, `idx_admin_sessions_regular`.
- `cloudflare/migrations/0008-admin-email-link.sql`: crea `auth_admin_email_links`, `idx_admin_email_links_profile`, `idx_admin_email_links_expiry`.

La operación se ejecutó directamente mediante la API D1 **solo en la base de staging**; no sobre Supabase ni sobre QA.

## 3. Verificación después del cambio

- **22 tablas** en staging: las 20 anteriores más las 2 nuevas.
- **6 objetos nuevos** (2 tablas, 4 índices), con el mismo DDL semántico que en QA. La única diferencia textual era formato/espacios de la sentencia `CREATE TABLE`; no había diferencias estructurales.
- **0 filas** en `auth_admin_sessions` y **0** en `auth_admin_email_links`.
- Los **38 objetos** de esquema previos en la restauración aislada siguen exactamente iguales en staging (20 tablas + 18 índices/triggers/vistas).
- Los **44 registros originales** de las 20 tablas se compararon nuevamente **fila a fila** con la base restaurada: **0 diferencias**.
- **7 perfiles, 1.999.998 puntos, 0 visitas**. `PRAGMA foreign_key_check`: **0 errores**.
- El único socio adicional frente a Supabase se mantiene sin cambios.

**Resultado: migraciones 0007 y 0008 aplicadas y verificadas en D1 staging; sin activación de autenticaciones nuevas.**

## 4. Pendiente antes de producción

1. Recuperar 3 logos y publicar 5 MP4 en Static Assets de QA, verificar HTTP 206 y iPhone/Android reales.
2. Rotar fuera del chat la clave antigua de la copia cifrada; mantener una copia externa y restauración comprobada de producción antes del corte.
3. Confirmar reautenticación de **las 2 cuentas admin reales** y autorización de vinculación de correo y contraseña (flags cerrados mientras tanto).
4. Conciliar el socio de 0 puntos que existe solo en staging.
5. Validar QR/puerta y paridad visual ES/FR en dispositivos.
6. Mantener `bellaquitas.fr`, DNS y la rama `main` **intactos**. No fusionar la PR #3 hasta que los bloqueos se resuelvan.

Nota: el bookmark de D1 Time Travel está sujeto al período de retención del proveedor y NO sustituye un backup externo.
