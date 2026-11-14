# Bellaquitas Fest — pruebas REALES de Cloudflare D1 (14/11/2026)

**Proyecto:** arquitectura futura exclusivamente Cloudflare Workers + D1 + GitHub Pages. **Rama:** `auditoria/fase5-2026-11-11`. **No se ha realizado el corte**, ni migrado usuarios reales, ni se ha cambiado DNS, Github `main`, credenciales, puntos o visitas.

## Exportación de D1

- Se invocó mediante la API oficial de Cloudflare `POST /accounts/{account_id}/d1/database/{database_id}/export` con `output_format=polling` y compatibilidad `d1`.
- **Respuesta: `status=complete`**, con archivo SQL temporal y enlace firmado de descarga. Esto demuestra que Cloudflare ha creado una exportación auténtica de la base de pruebas `bellaquitas-staging`.
- **El archivo SQL NO se ha guardado de forma permanente ni cifrada**. La descarga desde el entorno de ejecución de este chat fue rechazada y no se pudo comprobar su SHA-256 ni restaurarlo en una copia aislada. El enlace firmado CADUCA. La mera respuesta de exportación NO cumple el requisito de copia privada recuperable.
- Cloudflare D1 Free **Time Travel** se encuentra activo sin habilitarlo y permite recuperar hasta **7 días** en la versión Free; se confirmó que la base devuelve un bookmark válido por la API. Time Travel **no permite clonar** la base y restaurar en su lugar sería destructivo. No se ha invocado restore.
- Para obtener el archivo cifrado y verificar la restauración real, ejecutar en el equipo privado `cloudflare/backup_d1_solo.py --run`, `--verify` y `--restore-local` conforme a la [guía Windows](./GUIA_BACKUP_D1_SIN_SUPABASE_WINDOWS.md). Nunca publicar GPG, SQL o clave en GitHub.
- Referencia oficial: https://developers.cloudflare.com/d1/best-practices/import-export-data/ y https://developers.cloudflare.com/d1/reference/time-travel/

## Migraciones probadas en el servicio Cloudflare REAL — solo base aislada

Se creó **una D1 de ensayos adicional, sin perfiles**, con nombre `bellaquitas-migration-qa-20261114`, ubicación **EU**, UUID `5b6bcea0-5dfe-4bfa-a34a-e1ef7b4b6f09`.

Se han aplicado CON ÉXITO en este entorno vacío las migraciones del repositorio:

1. `0001-schema.sql`: 17 sentencias.
2. `0003-oauth-sessions.sql`: 5 sentencias.
3. `0005-auth-session-method.sql`: 2 sentencias.
4. `0007-admin-sso-sessions.sql`: 3 sentencias.
5. `0002-auth-and-invariants.sql`: 9 sentencias; se ejecutó al final porque la nueva base estaba completamente vacía.

**Todas devolvieron `success=true` sin errores.** Verificación read-only posterior:
- D1 aislada: `profiles=0`, columna `auth_sessions.auth_method` PRESENTE, tabla `admin_sso_sessions` PRESENTE, `auth_identity_links` PRESENTE.
- D1 antigua de pruebas `bellaquitas-staging`: **7 perfiles** (seis vinculados y uno de ensayo); columna `auth_method` AUSENTE, tabla `admin_sso_sessions` AUSENTE, enlaces de identidad existentes. **Sin modificaciones de esquema ni puntos.**

Las migraciones se ejecutaron sin socios auténticos, por lo que **el ensayo NO valida la continuidad de sesiones reales, el login de dos admins ni la migración de puntos**. La base aislada nueva se mantiene disponible para pruebas autorizadas futuras; forma parte de los recursos D1 Free y no contiene datos de clientes. No se ha creado ningún Worker público ni dominio.

## Seguridad de salida fase 6

Se reforzó `phase6_readiness.py` para exigir simultáneamente:
- `isolated_d1_migrations_verified`: ensayo genuino de migraciones en D1 aislada.
- `staging_auth_schema_after_private_backup_verified`: **migraciones del destino solo después del backup cifrado/restore real**.
- `staging_d1_schema_id_matches_production_target`: verificar UUID de destino para evitar confundir la base aislada con la oficial.

Una prueba en la D1 aislada **nunca satisface por sí sola el criterio de publicación**. [Test automático del candado: aprobado](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43569735038).

## Medios del proveedor retirado — API pública, sin cambios en D1

La base staging conserva una referencia histórica de logotipo externo en `site_content`. El candidato de Worker aplica `stripRetiredStorage()` en las respuestas públicas para usar originales `/assets/logo-bellaquitas.webp` y `/assets/logo-navbar.png`, sin alterar los datos fuente. También limpia imágenes de eventos y premios que apuntaran al proveedor anterior y conserva traducciones. [QA aprobado](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43569150443). **Los logos alternativos deben ser visualmente comparados en el navegador real antes de publicar para garantizar paridad.**

## Pendiente y prohibido hasta superar controles

- Copia D1 original GPG **real**, separada, verificada por SHA-256, con restauración SQLite local real, pendiente.
- Activación de `0005` y `0007` sobre el destino con datos reales: **PROHIBIDA** hasta el backup íntegro, reconciliación y autorización.
- Login Google auténtico de los administradores, validación de QR en dispositivos reales y URLs de retorno OAuth en el dominio aún NO probados.
- Correo/contraseña, registro/recuperación gratis sin servicio facturable y sugerencias con Turnstile siguen cerrados.
- Sin zona Cloudflare para el dominio `bellaquitas.fr`; web pública GitHub Pages original intacta. No cambiar DNS ni `main` sin verificación de diseño, seguridad, respaldo y rollback.

**Situación: fase 5/6 EN CURSO; fase 6 NO autorizada.**
