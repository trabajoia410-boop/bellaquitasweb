# Bellaquitas Fest — nueva copia cifrada D1 y restauración auténtica (18/11/2026)

**Estado: realizado y validado; no es una declaración de migración publicada.** No se ha alterado ni `main`, ni la zona DNS, ni los usuarios ni puntos reales.

## Nueva copia independiente de la base de preproducción

Se leyó por la API de Cloudflare la D1 europea **bellaquitas-produccion-preparada-20261116** en modo estrictamente **SELECT**, sin devolver filas privadas a mensajes o a GitHub. La exportación SQL oficial de D1 entregó una URL temporal, pero su descarga resultó 403; no se contabilizó como archivo restaurable. Para resolver ese bloqueo, se realizó una exportación de todas las tablas y definiciones SQL vía lecturas autorizadas de D1 y se cifró **antes** de traer los datos al entorno de validación:

- **22 tablas**, con todas sus filas y columnas de la D1 de preproducción.
- **44 objetos de SQLite**: 22 tablas, 17 índices, 5 triggers.
- **7 perfiles**, incluidas las 6 cuentas originales Google y el séptimo email verificado; **2 roles admin**.
- **1.999.998 puntos actuales**, **1.999.998 puntos históricos**, **0 visitas**.
- Compresión gzip; cifrado autenticado **AES-256-GCM**, secreto AES aleatorio envuelto en clave pública **RSA-OAEP-3072-SHA256**.
- Archivo cifrado: `BELLAQUITAS_D1_COPIA_CIFRADA_2026-11-18.bqbk`, **9590 bytes**. SHA-256 archivo: `c4f3e2003329336015d949a3a45f3bf29b7f9c03b5124d358707000be7c4b456`. Hash de cuerpo cifrado: `65ea99d27f4f8132758d5a80cdffb6649c0405bdcdbd123ca490e0438bebce8f`.
- Una clave privada RSA-3072 **distinta y generada en esta sesión** se guarda en un archivo `.pem` independiente que se entrega al propietario mediante archivo descargable; **no se escribe ni se sube a GitHub**, ni se muestra en texto del chat. El propietario deberá descargarlos y custodiar la clave fuera de ChatGPT.
- Se preparó un recuperador HTML **100 % local**, compatible con WebCrypto, sin llamadas de red ni dependencias externas; también un comprobador genérico Python para restaurar sin generar SQL temporal. No es necesario PowerShell.

## Restauración comprobada (SIN tocar D1 ni publicar)

Se verificaron **6/6 segmentos de transferencia cifrada por SHA-256**, SHA-256 final, descifrado RSA, autenticación AES-GCM y descompresión gzip. Los datos cifrados se recuperaron a memoria y se reconstruyó una SQLite `:memory:`:

- **22 tablas y 44 objetos reconstruidos** con las mismas definiciones.
- Todas las filas verificadas mediante COUNT por tabla.
- **PRAGMA foreign_key_check → 0 errores**.
- **PRAGMA integrity_check → ok**.
- 7 perfiles, 2 administradores, 1.999.998 puntos actuales/históricos, 0 visitas exactos.
- El programa HTML se ensayó con WebCrypto en un entorno de JavaScript Node, descifrando exactamente el archivo y la clave reales. No se disponía de un navegador Playwright gráfico instalado para certificarlo en Chrome o Safari físico.

**Ninguna fila, correo, hash de contraseña, clave RSA o material AES se ha incorporado al repositorio.** El repositorio solo documenta el procedimiento, evidencia y hashes públicos.

## Restricciones pendientes — no alterar gates indebidamente

1. El respaldo **antiguo** `BELLAQUITAS_RESPALDO_CIFRADO_2026-11-16.bqbk`, creado y restaurado desde 8 CSV, no ha sido recifrado con clave nueva y su clave antigua **no consta rotada fuera del chat**. La nueva copia de D1 **no revoca** aquella clave antigua.
2. No se ha acreditado un `pg_dump` completo de identidades de la plataforma anterior ni un delta fechado después de los 8 CSV. Los seis Google se preservaron por vínculo, no por recuperar contraseñas antiguas.
3. La D1 nueva sí es un respaldo autenticado/restaurable, pero su disponibilidad duradera **fuera de ChatGPT** solo puede certificarse después de que el propietario descargue y custodie los archivos en lugares separados.
4. Faltan Google OAuth y una credencial nueva de envío Resend configuradas directamente en `bellaquitas-api-preproduccion`. Los secrets de staging son irrecuperables en claro. Por seguridad no se emitió un token Resend que deba publicarse en el chat, ni se inventó cliente OAuth.
5. `productionChangesAuthorized=false`, la zona Cloudflare `pending` y cero rutas Worker públicas. El sitio GitHub Pages/Hostinger está intacto.

**Los gates de `productionDatabaseBackupConfirmed` y `exposedBackupKeyRotatedOutOfChat` permanecen false** hasta demostrar cobertura completa y custodia/rotación fuera del chat. La nueva copia de D1 consta en `phase6IndependentEncryptedD1Backup`, diferenciada de la anterior.

## Uso por el propietario sin instalaciones

Descargar **tres archivos** entregados en el chat:
1. Copia `.bqbk`.
2. Clave privada `.pem`.
3. Página local `.html` de recuperación. Abrirla haciendo doble clic, cargar la copia y la clave y pulsar **Descifrar y comprobar copia**. No se transmiten datos a internet. Después de comprobar, conservar los dos primeros archivos en lugares separados y evitar subir una restauración JSON no cifrada.

Nunca subir la clave `.pem` a Cloudflare, GitHub o formularios de terceros. No compartirla en chats, ni junto con el `.bqbk` por correo.
