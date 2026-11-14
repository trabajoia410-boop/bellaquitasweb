# Fase 5 — Ensayo de recuperación PostgreSQL con datos ficticios

**12 de noviembre de 2026. Estado: ensayo técnico aprobado; aún NO hay respaldo real privado ni restauración de la base productiva.**

## Qué se verificó

Se realizó un inventario **de solo lectura** de los esquemas `public`, `auth` y `storage` del proyecto de Supabase. La versión PostgreSQL de origen actualmente es **17.11**. Se endureció `cloudflare/backup_privado_local.py` para exigir que el formato `pg_restore --list` incluya los datos de las **18 tablas esenciales** siguientes:

| Esquema | Tablas mínimas |
|---|---|
| `public` | `activity`, `admin_member_changes`, `community_suggestions`, `events`, `moments_albums`, `moments_photos`, `profiles`, `promos`, `redemptions`, `rewards`, `site_content`, `site_drafts` |
| `auth` | `users`, `identities`, `sessions`, `refresh_tokens` |
| `storage` | `buckets`, `objects` |

Esta es una **lista mínima**, no un filtro de exportación. El respaldo ejecuta `pg_dump` sin excluir tablas. Los ficheros **binarios** de Supabase Storage se descargan por separado, porque no forman parte de `pg_dump`.

## Ensayo completo ejecutado

Archivo: `cloudflare/test_pg_restore_isolated.py`.

En GitHub Actions se ejecuta una **matriz de dos contenedores aislados: PostgreSQL 16 y PostgreSQL 17**. En cada versión se crean dos bases exclusivamente ficticias y se utilizan `pg_dump` y `pg_restore` oficiales **de la misma versión mayor que su servidor**. El proceso:

1. Crea 18 tablas mínimas de `public`, `auth` y `storage` con cuentas inventadas.
2. Registra **dos perfiles inventados, 62 puntos y 3 visitas**; también crea eventos, canjes, sesiones y objetos inventados.
3. Exporta la primera base mediante `pg_dump --format=custom`.
4. Comprueba que el listado del volcado contiene exactamente los nombres de las 18 tablas mínimas.
5. Comprueba que un listado sin `auth.sessions` **es rechazado**.
6. Restaura el volcado con `pg_restore --exit-on-error` en la segunda base ficticia recién creada.
7. Compara los recuentos de **18/18 tablas**, así como los puntos, visitas, usuarios, identidades y sesiones: **todos coinciden**.

**Resultado aprobado en PostgreSQL 16 y 17:** https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43249197005

### Fallo detectado y corregido

La primera versión del ensayo utilizó herramientas PostgreSQL 18 del runner contra un servidor PostgreSQL 16. La restauración falló al recibir la opción `transaction_timeout`, incompatible con el servidor 16. Después se cambió el entorno para obtener `psql`/`pg_dump`/`pg_restore` directamente de los contenedores oficiales PostgreSQL **16 y 17**, sin servicios de pago. **Ambas restauraciones pasaron**.

Como el **Supabase original es PostgreSQL 17.11**, el respaldo **privado real** deberá usar herramientas de **PostgreSQL 17**. Se incorporó `verify_postgres_versions()` en `cloudflare/backup_privado_local.py`, que identifica la versión mayor del servidor y rechaza herramientas de otras versiones **antes de exportar datos personales**. Pruebas negativas ficticias en `cloudflare/test_pg_backup_versions.py` validan 16/17/18 y diferencias entre `pg_dump`, `pg_restore` y `psql`.

## Lo que el ensayo NO demuestra todavía

- No se ha creado ninguna copia real de Supabase, ni de D1, ni de archivos R2/Storage.
- No se ha restaurado un volcado real de Supabase en una instancia aislada. Esta prueba utiliza un **esquema sintético simplificado**, no los tipos, políticas, extensiones o funciones completos de Supabase.
- No se han probado las claves de cifrado raíz de Supabase Auth, roles específicos ni todas las extensiones y configuraciones necesarias para recrear un proyecto Supabase real. La documentación oficial advierte de diferencias en restauraciones de `auth`/`storage`, privilegios, extensiones y claves.
- No se ha desplegado ningún código, cambiado el dominio ni escrito sobre los puntos o visitas reales.

**Para pasar a la fase 6:** crear una copia REAL en un entorno privado, incluir archivos binarios y configuración necesaria, comprobar su restauración en una instancia de ensayo con versión/roles compatibles y confirmar un plan de vuelta atrás. El candado `cloudflare/phase6_readiness.py` debe seguir rechazando el corte hasta que existan esas evidencias y autorización expresa.

Referencia oficial: https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
