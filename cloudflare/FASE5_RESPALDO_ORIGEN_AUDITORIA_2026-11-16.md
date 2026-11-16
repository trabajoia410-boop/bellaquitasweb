# Bellaquitas Fest — auditoría real de respaldos antes de publicación
**Fecha:** 16 de noviembre de 2026. **Ámbito:** solo lecturas Cloudflare D1 y restauración local en memoria. No se ha accedido al proveedor antiguo, ni usado R2, ni escrito datos reales.

## 1. Estado del archivo original de producción: todavía NO confirmado

La cuenta Cloudflare tiene cinco bases D1 denominadas `bellaquitas-staging`, `bellaquitas-migration-qa-20261114`, `bellaquitas-restore-isolated-20261114`, `bellaquitas-restore-postadmin-20261115`, y `bellaquitas-encrypted-backups-20261114`. **Ninguna tiene una identidad de base original de producción acreditada.**

Se encontró en la Biblioteca del proyecto un SQL anterior (subido el **03/11/2026**, de 15.076 bytes). **Se revisó sin acceder a su proveedor de origen y sin imprimir datos privados**: contiene siete declaraciones CREATE TABLE y seis instrucciones INSERT, con estructuras de perfiles/eventos y tablas públicas, pero **no una exportación íntegra de las tablas de identidades/autenticación**. Su fecha e inventario no acreditan el estado actual de la producción. **No se ha importado ni cifrado como si fuese backup actualizado.**

En el repositorio actual de producción (rama `main`), `config.js` aún apunta al backend anterior: el código no demuestra que todos los datos de usuarios vivan ya en Cloudflare. No se ha hecho ninguna solicitud a ese backend ni se han leído secretos de configuración.

**Para completar el control `productionDatabaseBackupConfirmed` hace falta un volcado auténtico y actualizado de la base operativa original** con cuentas, perfiles, identidades, puntos, visitas, recompensas y registros, obtenido legítimamente y sin copiarlo a GitHub. Puede entregarse desde un archivo SQL privado para auditoría offline. La mera existencia de un SQL antiguo no es suficiente.

## 2. Copia cifrada de staging: restaurada y verificada ahora

Archivos cifrados anteriores disponibles en el entorno de trabajo:
- `bellaquitas-d1-staging-respaldo-cifrado-20261115.zip`
- `bellaquitas-d1-staging-clave-privada-20261115.zip` (confidencial)

Se comprobaron los SHA-256 de ambos ZIP contra la documentación registrada el 15/11/2026, se autenticaron las dos partes con AES-256-GCM y RSA-OAEP-SHA256, y se **reconstruyó SQLite exclusivamente en memoria**, sin SQL claro en disco.

Resultados exactos del respaldo **STAGING**:
- 22 tablas, 44 objetos, 44 filas; 7 perfiles, 2 administradores.
- 1.999.998 puntos y 0 visitas.
- `PRAGMA integrity_check=ok`, `PRAGMA foreign_key_check`: cero errores.
- Relación entre esquema/datos verificada mediante SHA-256. Sin mostrar identificadores, correos, contraseñas, tokens ni filas.

**Esto no es una restauración del origen de producción y no cierra su control.**

## 3. Comparación detallada staging actual ↔ restauración del 15/11

Se leyeron los 44 objetos y todas las filas de las 22 tablas de las dos bases D1 vía API, con comparación local dentro del conector y **salida solo de nombres de tablas divergentes y recuentos**, sin datos personales.

- Esquema 44/44 exacto y 22/22 tablas.
- 46 filas en staging actual, **44** en restauración del día anterior.
- ÚNICAS diferencias: `auth_sessions` (**3 frente a 2**) y `auth_admin_sessions` (**1 frente a 0**). Esto demuestra que la restauración anterior es una **foto histórica**, no el estado dinámico actual.
- `PRAGMA foreign_key_check`: 0 errores en ambas.
- Perfiles/identidades/puntos/visitas y demás tablas no presentan divergencias de filas.

Las sesiones antiguas no tienen por qué migrarse al nuevo sistema; es preferible que el cambio definitivo exija autenticación nueva, siempre que las credenciales y el vínculo de cuentas sí estén preservados.

## 4. Auditoría privada de un SQL original — preparada y con CI verde

Herramienta incorporada `cloudflare/audit-production-export.mjs`, sin red ni conexión a ningún proveedor. Lee exclusivamente un SQL privado **fuera del repositorio** y devuelve:
- SHA-256 y longitud del archivo, cantidad de tablas e instrucciones de datos.
- Presencia estructural de perfiles, puntos, visitas y datos de identidades.
- Bloqueos si parece un archivo parcial, solo esquema, o sin vínculos de acceso.

Ejecutar cuando exista el archivo original actualizado (no compartir claves ni información personal en chat):
```bash
node cloudflare/audit-production-export.mjs --inspect "/ruta/privada/exportacion-original-actual.sql"
```

**El resultado `structureReadyForHumanReview: true` solo autoriza seguir revisando**, no certifica fecha, procedencia, cuentas completas ni restauración. El validador **siempre declara** `originalProductionBackupCertified: false` por diseño, hasta obtener verificación adicional contra la base real.

Pruebas con datos inventados `cloudflare/test-audit-production-export.mjs`, incorporadas al flujo `qa-cloudflare-migration.yml`; valida rechazo de SQL parcial/sin identidades y archivos dentro del repositorio.

## 5. Trabajo pendiente sin accesos de origen

1. Obtener **exportación auténtica y reciente** de la base actual (archivo privado, sin enviarla a GitHub, sin usar credenciales a través del chat).
2. Comprobar completitud del origen: personas/cuentas, identidades Google, emails, puntos/visitas, eventos y recompensas; el SQL debe ser coherente con la tabla de perfiles del sistema operativo.
3. Encriptar con clave nueva separada, restaurar en **base aislada**, comparar todas las tablas y sus recuentos antes de permitir el cambio.
4. Recifrar/rotar la clave histórica cuando la copia legítima esté disponible (herramienta `--rotate` existe para formato AES-256-GCM v1, no sirve automáticamente para ZIP RSA de otras versiones).
5. Solo tras superar estas pruebas, autorizar una revisión explícita de corte, DNS, `main`, y verificación postpublicación iPhone/Android.

El usuario comunicó que las cuentas administradoras, vídeo Android y QR/puerta ya funcionan manualmente. La prueba física de Safari iPhone queda diferida por decisión del usuario para el entorno publicado. No se repetirá innecesariamente.

**Estado:** 10/16 gates, `productionChangesAuthorized=false`, PR #3 borrador. No se modificó producción, DNS, sesiones, cuentas, puntos, visitas ni diseño.
