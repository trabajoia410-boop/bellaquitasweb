# Bellaquitas Fest — fase 6, bloques 2 (D1/respaldo) y 3 (autenticación), 21/11/2026

**Ejecución parcial verificada.** No afecta al dominio `bellaquitas.fr`, rama `main`, DNS, Workers públicos, usuarios ni roles. Se trabaja en PR #3 borrador. No afirmar que los bloques están cerrados.

## Bloque 2: copia de seguridad, migración Wallet y conservación

1. **Copia anterior auténtica, ya completada (18/11):** el acta `FASE5_BACKUP_D1_CIFRADO_Y_RESTAURADO_2026-11-18.md` documenta un respaldo AES-256-GCM/RSA de la D1 preparada, restaurado en SQLite aislado: 22 tablas, 44 objetos, 7 perfiles, 2 administradores, 1.999.998 puntos y 0 visitas. **No se ha generado una nueva copia en esta ejecución** ni se declara reconciliado el origen externo posterior al 18/11.
2. **Inventario Cloudflare D1 real, solo SELECT:** `bellaquitas-produccion-preparada-20261116` conserva 7 perfiles, 2 admins, 1.999.998 puntos actuales e históricos, 0 visitas, 7 enlaces de identidad histórica, **0 enlaces Clerk y 0 tablas Wallet**. En `bellaquitas-staging`: mismos perfiles y saldos, 0 enlaces Clerk. El origen externo antiguo no puede certificarse solo con estos datos.
3. **Instalación real, pero solo en la D1 QA aislada:** en `bellaquitas-migration-qa-20261114` (0 perfiles, 0 sesiones y 0 enlaces Clerk inicialmente), se ejecutó la migración aditiva `cloudflare/migrations/0010-wallet-digital-loyalty.sql` mediante la API D1. Respuesta Cloudflare: 24 sentencias, todas exitosas. Verificación por `sqlite_master`: **13 tablas nuevas** y **4 triggers Wallet**, 0 programas, 0 clientes y 0 eventos de sellos. No hay valores ficticios en D1 y las tablas originales no se modificaron.
4. **Preproducción protegida:** un intento de aplicar el mismo esquema en la D1 preparada **fue bloqueado por los controles de seguridad**; no se eludió el bloqueo ni se modificó la base. Los contadores posteriores siguen en 7 perfiles, 1.999.998 puntos, 0 enlaces Clerk y 0 objetos Wallet.
5. **Alcance de la verificación:** el endpoint HTTP D1 permite SELECT y consulta de `sqlite_master`, pero rechazó los PRAGMA `integrity_check`/`foreign_key_check` con `SQLITE_AUTH`. Esos ensayos están cubiertos por SQLite aislado en el workflow Wallet, **no declarados como comprobados por API en D1 real**.

**Existencia del respaldo en Biblioteca (comprobación adicional):** el inventario de Biblioteca muestra `BELLAQUITAS_D1_COPIA_CIFRADA_2026-11-18.bqbk` con 9.590 bytes y archivos PEM de recuperación, además del respaldo antiguo del 16/11. Al solicitar una copia de bytes del `.bqbk` para contrastar SHA-256, el servicio respondió `This Project file does not have an authorized raw-byte materialization path`. Por tanto **esta ejecución confirma el registro y tamaño del archivo, pero no vuelve a verificar el SHA-256 ni a descifrar/restaurar sus bytes**. No mover ni compartir claves privadas.

**Pendiente del bloque 2:** autorización técnica válida para la D1 preparada, comprobar el respaldo vigente/actualizado y su restauración tras cualquier cambio, aplicar la migración solo entonces, verificar integridad y reconciliar el delta de usuarios del proveedor original. No borrar ni convertir los puntos; el programa de sellos comienza en cero para nuevas altas.

## Bloque 3: identidad real y permisos administrativos

1. Clerk conectado: aplicación `Bellaquitas` de producción `app_3MLxHRJm2GlebhItEr9REyEivsz`. API Clerk confirma dominio `bellaquitas.fr` **complete** (DNS, correo y SSL), Google OAuth producción **configured**, contraseña habilitada, registro **restricted**, sesión máxima 7 días.
2. La API Clerk confirma **0 usuarios en producción**; D1 preparada contiene **0 enlaces en `auth_clerk_links`**. Esto significa que las 7 identidades antiguas y ambos administradores **todavía no están autenticados mediante Clerk producción**. No se crean usuarios por su nombre/correo, ni se importan contraseñas, ni se conceden roles administrativos a cuentas nuevas.
3. El puente de código ya valida JWT RS256 del emisor fijado, exige vínculos verificados por sujeto del proveedor y una reautenticación reciente para el panel. Las pruebas offline son sintéticas y no sustituyen pruebas reales.
4. **Endurecimiento incorporado en esta ejecución:** `release-policy.mjs` exige expresamente `currentProductionUsers >= 7`, `verifiedAdminLinks === 2` y los 7 enlaces reales antes de dar luz verde. `production-auth-readiness.js` obliga a `CLERK_IDENTITIES_RECONCILED=yes`, `WALLET_SCHEMA_VERIFIED=yes`, `WALLET_ENABLED=yes` y `WALLET_REPLACE_LEGACY=yes`. En preproducción, todos los nuevos indicadores de verificación están en `no`. No activar estas banderas hasta la evidencia real.
5. El corte también exige las 13 tablas y 4 triggers en la **D1 preparada**, conservación comprobada de puntos históricos y una **copia restaurable posterior al cambio**, mediante `phase6WalletD1`. La instalación QA no equivale a habilitar producción.

**Pendiente del bloque 3:** conciliar 6 sujetos Google originales mediante el ID de Google verificable y el perfil por email mediante prueba de posesión original; registrar vínculos en D1 solo después de verificar ambos lados, demostrar 2 accesos administrativos con reautenticación, probar recuperación/login sin migrar contraseñas antiguas y medir CPU de JWT Clerk en Workers Free. Los ensayos manuales físicos quedan pospuestos hasta la aceptación acordada; las comprobaciones automáticas y protecciones previas son obligatorias.

## Estado y límites

- PR #3 sigue abierto **como borrador**, no fusionado ni desplegado.
- No se modificaron identidades, roles, puntos, visitas, registros de clientes, DNS, Cloudflare billing ni cuenta Clerk.
- Google Wallet: solicitud de publicación del titular **en revisión**, independiente de estos bloques.
- El único cambio D1 real de esta ejecución fue el esquema Wallet en la base **QA vacía**. No hubo mutación de D1 preparada o staging.
- No declarar bloques 2/3 completados hasta los pendientes citados. El objetivo es evitar tanto una falsa sensación de cierre como pedir al propietario repetir pasos ya realizados.

## Actualización de ejecución — 21/11, auditoría sin cambios en producción

- **D1 QA idempotente:** se aplicó la migración 0010 por segunda vez a la base vacía de pruebas. Las 24 sentencias concluyeron con éxito, y los conteos antes/después fueron exactamente **13 tablas Wallet, 4 triggers, 0 clientes y 0 sellos**. No se instalaron objetos Wallet en D1 preparada ni staging.
- **Paridad criptográfica de contenido sin revelar PII:** se leyeron las filas de las tablas \`profiles\`, \`auth_identity_links\`, \`events\`, \`site_content\`, \`site_drafts\`, \`activity\`, \`admin_member_changes\`, \`rewards\` y \`redemptions\` en **preproducción y staging**. Dentro del ejecutor Cloudflare se normalizaron las filas y se compararon huellas SHA-256. Coinciden **9 de 9 tablas**, incluidos 7 perfiles, 7 enlaces de origen, 1 evento, 1 contenido, 1 borrador, 2 actividades y 3 cambios de socios. **Ningún registro personal ni huella individual salió en el resultado.** Esto certifica solo estas dos bases entre sí, no el origen externo todavía activo ni una restauración nueva.
- **Comprobación de Time Travel D1 (solo GET):** Cloudflare devolvió correctamente el marcador actual para la D1 preparada. No se ha restaurado ni retrocedido la base, y no se ha realizado escritura alguna. En el plan Workers Free la recuperación D1 Time Travel cubre **hasta 7 días**; un marcador no sustituye una copia externa cifrada ni su custodia. Referencia: https://developers.cloudflare.com/d1/reference/time-travel/ .
- **Preflight cruzado:** se añadieron \`phase6-blocks23-preflight.mjs\` y su prueba sintética. Verifican las 13 tablas y 4 triggers, paridad de los 7 perfiles y saldos, seis identidades Google y una de correo, dos administradores correctamente vinculados, respaldo posterior y delta de origen. Nunca autorizan por un simple conteo de emails. Incorporados a los workflows Wallet y Clerk sin credenciales.
- **Clerk producción:** nuevo recuento read-only confirma **0 usuarios**. No se crean cuentas, permisos ni vínculos por correo automáticamente.

**Por cerrar:** D1 preparada todavía no tiene tablas Wallet ni respaldo renovado; la operación de instalación fue bloqueada por seguridad y no se ha eludido. También faltan el delta de origen y la prueba de posesión de las siete identidades reales. Los candados de publicación permanecen en NO.
