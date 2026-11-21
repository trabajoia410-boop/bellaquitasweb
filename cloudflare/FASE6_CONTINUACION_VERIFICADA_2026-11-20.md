# Bellaquitas Fest · Fase 6 — Continuación verificada (20/11/2026)

**Ambiente:** rama de migración `migracion/fase5-segura-20261114`, PR #3 borrador. **NO producción**. No cambiar DNS, `main`, puntos, permisos ni sesiones reales.

## 1. Datos y copias: lectura comparativa auténtica

A través de API Cloudflare D1 se hizo `SELECT *` de las 14 tablas siguientes:
`profiles`, `auth_identity_links`, `auth_email_credentials`, `events`, `activity`, `admin_member_changes`, `site_content`, `site_drafts`, `rewards`, `promos`, `redemptions`, `community_suggestions`, `moments_albums`, `moments_photos`.

Se ordenó la representación completa de las filas dentro de la ejecución privada del API y se comparó por igualdad exacta; **no se devolvieron ID, correos, claves, nombres de socios ni hashes a la conversación/GitHub**.

| D1 | Perfiles | Puntos | Administradores | Resultado 14 tablas |
|---|---:|---:|---:|---|
| Producción preparada | 7 | 1.999.998 | 2 | Referencia |
| Staging | 7 | 1.999.998 | 2 | 14/14 iguales |
| Restauración 15/11 | 7 | 1.999.998 | 2 | 14/14 iguales |
| Restauración aislada 14/11 | 7 | 1.999.998 | 2 | 14/14 iguales |
| Origen recuperación 16/11 | 6 | 1.999.998 | 2 | Histórico: no contiene el séptimo perfil |

Las 14 tablas suman 23 filas de negocio/identidad (algunas contienen columnas JSON). No se afirma paridad de las tablas de sesiones efímeras, auditoría de migración ni de las tablas no enumeradas. **No se ha consultado en vivo el origen antiguo tras el snapshot**, por lo que sigue pendiente la conciliación del delta final.

El séptimo perfil ya fue auditado el 15/11: identidad de email verificada, rol socio, cero puntos y cero visitas. **Debe conservarse** hasta una política de fusión/corte explícita.

La copia D1 cifrada y restaurada del 18/11 está documentada en `FASE5_BACKUP_D1_CIFRADO_Y_RESTAURADO_2026-11-18.md`; esa prueba no se repitió indebidamente. Los archivos históricos `BELLAQUITAS_RESPALDO_CIFRADO_2026-11-16.bqbk` y su antigua clave constan en Biblioteca, pero una nueva llamada a `files__materialize` para ambos volvió a informar `This Project file does not have an authorized raw-byte materialization path`. **Rotación REAL del respaldo histórico no realizada.** Mantener copia y clave antiguas fuera de la web.

## 2. Integración Clerk reforzada sobre el trabajo EXISTENTE

Se encontró código previo en PR #3: puente JWT RS256, planificador de identidad Google, intercambio de sesiones condicionado por flags y vista QA con controles. No volver a implementar desde cero ni copiar credenciales.

Se reforzó la migración `cloudflare/migrations/0008-clerk-verified-links.sql` en esta rama:
- Las vinculaciones nuevas se crean como `pending`, nunca confirmadas por defecto.
- `migration_confirmed` exige `verified_at` y prueba del `provider_subject` original asociado al mismo perfil.
- Triggers de integridad rechazan cambio a identidad de origen que pertenezca a otro perfil y reasignación de la ficha.
- El planificador offline conserva `evidenceProvider=google` y `evidenceSubject` verificado; no vincula por email o por nombre.
- Se añadieron seis pruebas SQLite offline `cloudflare/test_clerk_links_guard.py` y ejecución en QA de GitHub.

**Importante:** un match histórico en D1 tampoco prueba posesión actual de Clerk por sí solo. El backend exige JWT firmado por emisor permitido y únicamente consulta vínculos ya confirmados. La confirmación exige verificación independiente del Google `sub` en Clerk. El panel admin mantiene su segundo paso de seguridad.

La nueva tabla **no se ha aplicado a D1 de producción preparada ni a staging**, ya que no hay cuentas Clerk verificadas y la fase 6 está protegida. La prueba SQL se hace en SQLite aislado de CI. Existe una rama separada PR #4 de QA preliminar; tomar PR #3 como integración principal para evitar dos migraciones incompatibles.

## 3. Cuenta y gasto cero

- API R2: **0 buckets**; Worker scripts: ocho previamente inventariados.
- Cloudflare Billing y Subscriptions: **403, sin Billing Read**. No afirmar ausencia global de cargos.
- Capturas previas del propietario acreditaron Workers Free. Documentación del proveedor: 100.000 peticiones/día y 10 ms de CPU por petición en Free; al superar se interrumpe la función. **No elevar plan ni activar productos con coste**.
- Clerk: app Bellaquitas, instancia **development**, **0 usuarios** en último recuento; sin instancia de producción. Google desarrollo habilitado; Google producción requiere credenciales propias. No generar nuevas cuentas para completar artificialmente la migración.
- CPU PBKDF2 antigua 136,424 ms medida previamente en el Worker sintético y retirada; no usar esa ruta en Workers Free. El camino Clerk/JWT queda por medir con cargas reales y sin exponer usuarios.
- No se han creado Workers ni buckets nuevos, modificado rutas DNS ni aprobado facturación.

## 4. Puertas que impiden el corte

1. Proveedor original vivo: certificar deltas de usuarios/identidades y reconciliar los siete perfiles sin pérdidas.
2. Clerk producción: configuración final de Google, control de correo/contraseña, identidad de seis Google verificada y séptimo socio preservado.
3. Respaldo histórico: rotación real imposible desde archivos Biblioteca sin permiso de materialización; conservar backup nuevo y llave separados.
4. Gastos: verificar la ausencia de otros planes facturables sin volver a pedir capturas ya aceptadas; el conector no puede leer Billing.
5. CPU, vídeo HTTP 206 y seguridad/roles: QA end-to-end del Worker candidato con actividad real controlada antes de reemplazar.
6. `release-gates-2026-11-15.json` y los flags del Worker de preproducción **permanecen cerrados**. Las pruebas físicas personales siguen diferidas hasta después de publicar.

No se promete que la fase 6 esté terminada ni que la web haya sido migrada. Esta anotación registra trabajo real sin exponer datos sensibles ni activar gastos.

## 5. Staging actualizado mediante Cloudflare Workers Builds (20/11/2026)

GitHub Actions `deploy-bellaquitas-api-staging-safe.yml` compiló y verificó en seco pero omitió el deploy por falta de los secretos de repositorio `CF_API_TOKEN`/`CLOUDFLARE_API_TOKEN`; se respetó ese bloqueo y no se expusieron claves.

Se aprovechó la **integración ya existente** de Cloudflare Workers Builds, asociada a la rama `migracion/fase5-segura-20261114`, sin crear servicios ni activar plan de pago. Se verificó configuración de despliegue únicamente de `bellaquitas-api-staging`, versión anterior recuperable y cuota de Builds disponible. Cloudflare Builds ejecutó el código de la rama y finalizó `success`:

- Build: `a9cdfd6d-e12e-41b6-9793-7444246826ca`.
- Versión desplegada: `39a83855-8054-48e9-a8ba-e033df368880`.
- Versión anterior identificada para rollback: `da846f2f-bbd5-439a-b32e-05ffa482c6ae`.
- Finalización del despliegue: `2026-11-20T04:03:56.385Z` (UTC).
- El log dice `Uploaded bellaquitas-api-staging`, `Deployed bellaquitas-api-staging triggers` y `Success: Deploy command completed`.
- Cloudflare API después del despliegue: `STAGING_MUTATIONS=disabled`, `ALLOW_NEW_ACCOUNTS=no`, `CLERK_JWT_ENABLED` ausente/desactivado, D1 staging intacta, secrets `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`, `EMAIL_RATE_KEY`, `PROVIDER_BROKER_KEY`, `TURNSTILE_SECRET` aún vinculados; proxy de vídeo preservado.
- El Worker **preproducción** sigue sin despliegue adicional, `SITE_MODE=preproduction`, `PUBLISH_APPROVED=no`, `CLERK_JWT_ENABLED=no`, `CLERK_EXCHANGE_ENABLED=no`, `FREE_TIER_BILLING_VERIFIED=no`, `FREE_TIER_CPU_VERIFIED=no` y subdominio desactivado.
- Zona `bellaquitas.fr`: estado `pending`, plan `Free Website`; 0 Worker Routes y 0 Worker Custom Domains. **No se cambió el sitio público**.

**Esquema D1 staging:** aplicada exclusivamente la migración `0008-clerk-verified-links.sql`; 5 objetos DDL correctos, 3 triggers presentes, `auth_clerk_links` con 0 filas; inserción de identidad falsa rechazada. Paridad de 14 tablas con preproducción confirmada otra vez después de aplicar la migración. Perfiles=7, administradores=2, puntos=1.999.998, visitas=0 antes/después.

**QA postdespliegue:** rerun de GitHub Actions `44671273478`, incluyendo pruebas HTTP de staging (sin sesiones ni mutaciones), seguridad/fidelidad y navegador ES/FR, terminó con tres jobs en `success`. Esto valida endpoints y apariencia automática, **no** cuentas Clerk reales, sesión OAuth de producción, garantía de CPU menor a 10 ms ni facturación integral.

**Situación:** staging actualizado de forma segura, rama PR #3 continúa borrador, sin merge ni corte DNS. No poner `FREE_TIER_CPU_VERIFIED=yes`, `FREE_TIER_BILLING_VERIFIED=yes` ni `PUBLISH_APPROVED=yes` sin evidencias reales.

## 6. Revisión específica de la tarde del 20/11/2026 — rama principal

**Sin corte ni cambios de datos reales.** Se identificó que la PR #3 es la integración completa con Worker de preproducción, JWT cacheado, intercambio de sesión y SQL `0008-clerk-verified-links.sql`. La PR #5 era un prototipo paralelo basado en `main`, con otra migración `0004-clerk-identity-links.sql`. Para evitar dos esquemas incompatibles, se cerró PR #5 **sin fusionar**; su historial sigue disponible.

### Corrección técnica integrada en PR #3

- Se corrigió `cloudflare/clerk-auth-bridge.js` para limitar el cuerpo de descarga de JWKS a **65.536 bytes de transmisión reales**. El límite anterior solo comprobaba `Content-Length`, que el servidor remoto puede omitir o falsear.
- Se preservaron la caché de cinco minutos, el freno a `kid` desconocidos y los controles de JWT/segundo paso administrativo.
- Se ampliaron las pruebas de `cloudflare/test-clerk-auth-bridge.mjs` con JWKS excesivo sin longitud, respuesta válida con longitud anunciada y streaming fragmentado; verifican que no se absorbe el cuerpo completo.
- GitHub Actions **`Bellaquitas Fase 6 - identidades Clerk sin produccion` terminó `success`** en https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/44800915353. Los otros ensayos de migración tras el cambio también finalizaron satisfactoriamente.
- Cloudflare staging y preproducción **no se desplegaron** como consecuencia de esta corrección. Los Workers mantienen los candados anteriores: `STAGING_MUTATIONS=disabled`; preproducción `SITE_MODE=preproduction`, `CLERK_JWT_ENABLED=no`, `CLERK_EXCHANGE_ENABLED=no`, `PUBLISH_APPROVED=no`, `FREE_TIER_BILLING_VERIFIED=no`, `FREE_TIER_CPU_VERIFIED=no`, `BACKUP_KEY_CUSTODIED=no`, `FINAL_ORIGIN_RECONCILED=no`.

### Cotejo adicional de las bases (solo SELECT)

Se volvieron a comparar **todas las tablas compartidas** entre la D1 de preproducción y dos restauraciones históricas:
- **Restauración aislada 14/11:** 20 tablas comunes, 16 idénticas en filas completas. La base restaurada contiene siete registros antiguos de rate-limit, dos sesiones históricas, tres logs multimedia y nueve registros de auditoría que ya no aparecen en preproducción. Faltan tres tablas creadas después de esa restauración: `auth_admin_email_links`, `auth_admin_sessions` y `auth_clerk_links`.
- **Restauración postadministración 15/11:** 22 tablas comunes, 18 idénticas. Las mismas cuatro diferencias de datos efímeros e históricos; solo falta `auth_clerk_links`, creado con posterioridad.
- En ambos casos `PRAGMA quick_check=ok` y `PRAGMA foreign_key_check=0`.
- Los registros comparados conservan 7 perfiles y 7 vínculos de identidad; preproducción y staging siguen con 7 perfiles, 2 administradores, **1.999.998 puntos, 0 visitas**; la copia de recuperación original con 6 perfiles conserva el mismo saldo.
- **No confundir los backups históricos con una instantánea exacta actual de 23 tablas.** Los controles de esquema y deltas siguen pendientes antes del corte.

### Backups cifrados: distinguir lo realizado de lo pendiente

- El archivo independiente `BELLAQUITAS_D1_COPIA_CIFRADA_2026-11-18.bqbk` ya fue restaurado/validado en SQLite en memoria en la sesión documentada el **18/11**: AES-256-GCM, llave AES envuelta en RSA-3072, 22 tablas, integridad y sumas comprobadas. No repetir el trabajo realizado sin necesidad.
- Su archivo cifrado figura en Library, pero **`files__materialize` sigue denegando los bytes del archivo**; no se ha podido repetir aquí la prueba con su clave RSA. **La custodia externa de la clave privada no está certificada**.
- Se hizo una **exportación oficial D1** de la base `bellaquitas-origen-recuperacion-20261116` el 20/11 y la API devolvió `status=complete` y URL temporal de una hora. La descarga desde este entorno no está habilitada; **esa exportación temporal no se contabiliza como nueva copia duradera ni como restauración.**
- Permanecen pendientes rotación/custodia del backup histórico, reconciliación de identidad del proveedor antiguo, cuentas Clerk reales (0 usuarios en dev/producción), coste 0 verificable y ensayo CPU del Worker candidato. No modificar flags de seguridad o DNS.

**Resultado:** la rama principal es la fuente de verdad; las pruebas de seguridad pasan, y los datos reales permanecen intactos. La fase 6 sigue bloqueada para publicación hasta resolver condiciones verificables restantes.


## 7. Refuerzo Clerk + conciliación D1 (20/11, tarde)

- **Sin tocar Workers desplegados ni producción:** modificación exclusivamente de `clerk-auth-bridge.js` y sus pruebas sintéticas.
- El subrequest JWKS usa `AbortSignal.timeout(5000)`, con fallo cerrado cuando un proveedor deja de responder. No se habilita login real ni se añade proveedor de pago.
- Si la descarga/verificación estructural del JWKS falla, se aplica un **cooldown de 30 segundos por emisor permitido**, reduciendo reintentos seriales maliciosos que pueden consumir la cuota gratuita. Los tokens sin firma verificable siguen rechazados; las claves válidas cacheadas pueden seguir verificándose durante su TTL.
- La prueba anterior que exigía recuperar instantáneamente el mismo emisor tras una respuesta maliciosa no era compatible con ese cooldown; se separó la prueba positiva en un emisor sintético independiente. Se añadieron pruebas de fallo con 25 reintentos (una única solicitud externa) y recuperación tras el cooldown. No se confundió ese hallazgo de QA con un fallo de la web pública.
- **Origen recuperado D1**: 6 perfiles, 6 vínculos, 0 huérfanos, 0 duplicados de `provider,provider_subject`, 1.999.998 puntos y 0 visitas. La tabla `legacy_auth_users_for_migration` existe pero tiene **0 filas**, por lo que su ausencia en preproducción no significa que falten usuarios dentro de esa tabla.
- **Preproducción D1**: 7 perfiles, 7 vínculos, 0 huérfanos, 0 duplicados de `provider,provider_subject`, 1.999.998 puntos y 0 visitas. El séptimo perfil sigue conservado y no debe tratarse como cuenta descartable.
- Exportación D1 SQL oficial temporal: la API completa la tarea, pero la descarga firmada no está accesible desde este entorno. **No afirmar nueva copia duradera** ni acceso a la clave privada RSA sin evidencia. Continúa válida la prueba histórica de cifrado/restauración de 18/11.
- Bloqueos de publicación **sin cambios**: 0 cuentas Clerk vinculadas, verificación completa de gasto cero ausente, CPU del Worker final sin certificar, custodia de clave externa no confirmada y reconciliación del proveedor antiguo en vivo aún pendiente. `main` y DNS permanecen intactos.


## 8. Prueba independiente de restauración con respaldo cifrado (21/11/2026)

Se ejecutó una **nueva restauración local en SQLite `:memory:`**, a partir de los archivos de recuperación del 18/11 entregados al propietario dentro del ZIP de 19/11. La prueba no contactó servicios externos, no generó SQL desencriptado en disco, no envió la clave a conectores y no realizó ninguna escritura en Cloudflare D1.

- Integridad del ZIP (CRC) y SHA-256 de `.bqbk` iguales al manifiesto.
- RSA-OAEP-3072-SHA256: desenrollado de la clave AES exitoso; **AES-256-GCM**: autenticación y descifrado exitosos; compresión gzip correcta.
- Paquete `bellaquitas-d1-private` restaurado con tablas y filas, seguido de índices y triggers en **SQLite solo memoria**.
- **22 tablas**, **17 índices**, **5 triggers** (44 objetos).
- **7 perfiles**, **2 administradores**, **1.999.998 puntos**, **0 visitas**, **7 vínculos de identidad**, **0 vínculos huérfanos** y **0 identificadores de proveedor duplicados**.
- `PRAGMA integrity_check = ok` y `PRAGMA foreign_key_check` = **0 errores**. Los resultados coinciden exactamente con el manifiesto.
- No se publicaron nombres, correos, credenciales, contraseñas, filas de usuarios ni material criptográfico.

**Límites de la comprobación:** demuestra la recuperación correcta del snapshot cifrado del 18/11, **no** la sincronía con la base viva posterior ni una copia actual. `BACKUP_KEY_CUSTODIED` permanece en `no`, porque una validación criptográfica no confirma custodia segura y exclusiva fuera del chat. **Se debe renovar la clave de cifrado antes de publicación**, generándola localmente bajo control del propietario y cifrando de nuevo el respaldo con su clave pública; la clave antigua no debe considerarse exclusiva después de haber sido transferida. El propietario debe mantener la copia anterior hasta comprobar la nueva restauración.

Los controles de publicación, presupuesto gratuito, reconciliación del proveedor antiguo y pruebas de cuentas Clerk reales continúan bloqueados. No se ha tocado `main`, Workers, DNS, puntos ni visitas.
