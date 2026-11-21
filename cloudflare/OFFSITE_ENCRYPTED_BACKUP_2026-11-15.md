# Bellaquitas Fest — copia cifrada externa sin reutilizar la clave expuesta

**Fecha:** 15/11/2026. **Estado:** herramienta funcional incorporada a la rama privada de migración y ensayada en CI con datos ficticios. **No se ha realizado aún un respaldo cifrado fuera de Cloudflare sobre los datos reales**: se necesitan soportes locales adecuados y, si se exporta D1 por API, un token que debe mantenerse fuera del chat. El respaldo de **Supabase producción** continúa pendiente de una exportación auténtica y verificable.

## Objetivo y límites

`cloudflare/offsite-d1-backup.mjs` ofrece cifrado **AES-256-GCM**, compresión gzip, huella SHA-256, clave aleatoria de **32 bytes generada localmente**, nonce aleatorio de **12 bytes** y comprobación de la autenticidad en memoria antes de declarar el resultado. Usa exclusivamente el Node.js incorporado; no requiere cuenta premium, servicio R2 ni bibliotecas de terceros.

- Genera **una clave NUEVA** por copia; jamás utiliza `BF_BACKUP_KEY` ni la clave histórica expuesta.
- Exige destinos de respaldo y clave en **carpetas distintas y fuera del repositorio**.
- Crea los archivos con exclusión de sobrescritura; aplica permisos `0600` en sistemas POSIX.
- El archivo SQL de D1 descargado desde la URL firmada de exportación se cifra **sin guardar un SQL en claro en disco**.
- La copia local proporcionada por el administrador sí tiene un archivo de origen SQL sin cifrar en su equipo: **no lo elimina automáticamente** y hay que protegerlo hasta verificar.
- El modo `--verify` comprueba el descifrado y SHA-256 **sin crear un SQL en claro**.
- El modo `--restore` crea un SQL de recuperación solo en una ubicación externa al repositorio, con nombre nuevo y permiso restringido. Se debe importar en una base **aislada**, verificar los perfiles y después borrar el SQL en claro según las políticas del equipo.
- Límite de seguridad de esta versión: **64 MiB de SQL**; archivos mayores se rechazan sin declarar éxito.
- El script reconoce explícitamente **`cloudflare-d1-staging`** o **`local-sql-unverified`**. Cifrar un archivo local nunca certifica que provenga del proyecto de producción.

## Prueba sin secretos ni datos personales

Desde la raíz de `bellaquitasweb`, en Node.js 22 o superior:

```sh
node cloudflare/offsite-d1-backup.mjs --self-test
```

Crea una SQL **ficticia**, una clave temporal, un archivo cifrado temporal y prueba recuperación, detección de cambios de contenido, rechazo de claves falsas, prohibición de sobrescritura y prohibición de guardar dentro de Git. Elimina todos los datos temporales al finalizar.

## Opción A — Cifrar un archivo SQL original en el equipo (también exportaciones de producción)

Descargar el archivo SQL **original** desde la interfaz administrativa autorizada del proveedor de origen o producirlo con su herramienta oficial; **no** copiar datos en una conversación ni exportar solamente una tabla. Esta herramienta no crea la exportación de Supabase ni garantiza que un archivo local sea auténtico.

En Windows, crear antes **dos carpetas fuera de Git**, idealmente en soportes físicos distintos. Ejemplo con rutas ilustrativas:

```powershell
node cloudflare/offsite-d1-backup.mjs --encrypt-local-sql "C:\Respaldos\export-original.sql" "D:\Bellaquitas-Respaldos\copia-2026-11-15.enc.json" "E:\Claves-Bellaquitas\clave-2026-11-15.b64"
node cloudflare/offsite-d1-backup.mjs --verify "D:\Bellaquitas-Respaldos\copia-2026-11-15.enc.json" "E:\Claves-Bellaquitas\clave-2026-11-15.b64"
```

**No se debe compartir ni subir** `clave-2026-11-15.b64`, `copia-2026-11-15.enc.json` o `export-original.sql`. Pueden contener datos de usuarios. El archivo descifrado se mantiene fuera del repositorio. Los destinos deben existir como carpetas, y los nombres de los archivos nuevos no deben existir todavía.

**Importante:** `--encrypt-local-sql` acredita que la copia es descifrable y que no ha cambiado, **no** prueba que el SQL contenga todas las tablas de producción. La confirmación exige también restauración independiente, comparación de perfiles, identidades, puntos, visitas, roles, esquemas y registros tras elegir el momento definitivo de corte.

## Opción B — Exportar y cifrar directamente Cloudflare D1 staging

Para realizarla en **un equipo de confianza**, se necesita un token local de acceso D1 y el ID de cuenta Cloudflare. El Worker y su D1 staging **nunca se modifican** con esta operación. Ejemplo genérico: configurar `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` en el entorno del terminal **sin publicarlos**, y ejecutar:

```powershell
node cloudflare/offsite-d1-backup.mjs --export-staging "D:\Bellaquitas-Respaldos\staging.enc.json" "E:\Claves-Bellaquitas\staging.b64"
node cloudflare/offsite-d1-backup.mjs --verify "D:\Bellaquitas-Respaldos\staging.enc.json" "E:\Claves-Bellaquitas\staging.b64"
```

`--export-staging` está **fijado** a la D1 `bellaquitas-staging`. No acepta otros ID de bases ni el dominio público como argumentos. Utiliza la API oficial de exportación D1 en modo polling; la URL firmada caduca. La descarga SQL se procesa en memoria y se escribe únicamente la copia cifrada. **No exporta ni sustituye Supabase producción.**

## Recuperación en caso de desastre

```powershell
node cloudflare/offsite-d1-backup.mjs --restore "D:\Bellaquitas-Respaldos\copia-2026-11-15.enc.json" "E:\Claves-Bellaquitas\clave-2026-11-15.b64" "D:\Restauracion-Aislada\recuperada.sql"
```

La importación del SQL debe realizarse en un motor compatible: una exportación **PostgreSQL** se restaura en PostgreSQL, una exportación **D1** en D1/SQLite según el formato. No ejecutar este SQL contra la base actual. Tras importar, comparar número de usuarios, roles, identidades, puntos y visitas y revisar las relaciones entre tablas.

## Controles que deben seguir bloqueados

El informe `ADMIN_TWO_ACCOUNTS_AND_RESTORE_2026-11-15.md` acredita la copia D1 **aislada dentro de Cloudflare**, pero no la salida física del respaldo. Hasta completar y probar los pasos reales externos:

- `productionDatabaseBackupConfirmed=false`.
- `exposedBackupKeyRotatedOutOfChat=false`.
- No borrar el respaldo histórico hasta tener uno nuevo certificado y separado.
- No modificar producción, GitHub `main`, DNS o `bellaquitas.fr`.
- La PR #3 debe continuar en borrador.

**No se ha compartido, generado en el chat ni almacenado en GitHub ninguna clave real nueva.** Esta separación es deliberada.
