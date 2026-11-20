# Fase 6 — Integración Clerk en modo seguro (20-11-2026)

## Situación confirmada
- Clerk: aplicación **Bellaquitas**, instancia **development**; Google y contraseña habilitados. **0 usuarios** en esa instancia al realizar la revisión.
- Cloudflare Workers de staging y preproducción existentes; los indicadores `CLERK_JWT_ENABLED` y `CLERK_EXCHANGE_ENABLED` permanecen en `no`.
- La base D1 de preproducción contiene **7 perfiles** (uno de prueba o recuperación por conciliar), **2 admins**, **1.999.998 puntos** y **0 visitas**. No alterar saldos durante QA.
- El Worker ya contiene una ruta `GET /v1/auth/clerk/me`, pero necesita la tabla `auth_clerk_links` y una configuración verificada del emisor Clerk. La ruta no debe habilitarse en la web real antes de los ensayos.
- La web actual sigue usando Supabase: `config.js` y `app.js` no han migrado.

## Migración segura
1. Aplicar `migrations/0004-clerk-identity-links.sql` en **D1 QA aislada**; comparar recuentos y saldos antes/después.
2. No crear usuarios a partir del email; vincular `clerk_user_id` al `profile_id` SOLO después de comprobar el identificador Google `sub` ya existente o verificación equivalente sólida en ambos sistemas.
3. Los registros nuevos permanecen `pending`. Pasar a `migration_confirmed` solo con prueba y registro de auditoría, no con un `SELECT` por email.
4. En staging, configurar emisor y origen exactos; activar exclusivamente ruta de lectura `/v1/auth/clerk/me` para pruebas controladas (respuesta 401/403 a tokens no válidos y sin vínculo). El intercambio a sesión y el panel administrador siguen desactivados.
5. Probar sesión y cierre, permisos de socio/puerta/admin, QR, canjes, compatibilidad móvil y ES/FR sin tocar las cuentas de producción. Los admins requieren un segundo control de seguridad.
6. Reconciliar origen y destino con un respaldo restaurable y custodiar la clave antes de decidir el corte.
7. Verificar manualmente la ausencia de un plan facturable y opciones de gastos en Cloudflare y Clerk. El conector OAuth actual devuelve HTTP 403 para datos de facturación: no asumir que el gasto máximo es cero.
8. No fusionar ni desplegar en `main` hasta pasar QA y confirmar presupuesto sin cobros.

## Límites económicos
Workers Free: 100.000 peticiones por día y 10 ms de CPU por invocación; al rebasar el límite de peticiones del plan gratuito, el Worker deja de atender las solicitudes adicionales. Este diseño no garantiza disponibilidad ilimitada sin coste.
Clerk ofrece plan gratuito con límites propios. No se puede asegurar gasto cero sin comprobar el plan efectivo y los métodos de pago.
La comprobación criptográfica de Clerk usa WebCrypto y JWKS, no el cálculo de contraseñas anterior de 136,424 ms, pero **hay que medir CPU en el runtime real** antes de producción.

## Lo que permanece intacto
No modificar `bellaquitas.fr`, DNS, `config.js`, `app.js`, diseño, imágenes, vídeos, datos de socios, puntos, visitas o roles reales durante esta etapa.

## Auditoría adicional no invasiva — 20/11/2026

**Solo lecturas en bases con datos.** Las únicas escrituras ejecutadas durante la auditoría fueron la instalación de **dos triggers de integridad** en `bellaquitas-migration-qa-20261114`, una base aislada con 0 perfiles y 0 enlaces Clerk.

- **Clerk:** producción y desarrollo existen, 0 usuarios en ambas instancias. La integración Google OAuth de producción declara las credenciales configuradas; habilitada la contraseña y la verificación por correo. El dominio `bellaquitas.fr` presenta DNS, TLS y correo con estado `complete`. Esto NO acredita que un usuario original haya iniciado sesión.
- **Conciliación D1:** origen de recuperación 6 perfiles, preproducción 7. Las 6 filas antiguas de `profiles` y sus 6 `auth_identity_links` coinciden **campo a campo**. Las filas de `activity` (2), `admin_member_changes` (3), `events` (1), `site_content` (1) y `site_drafts` (1) coinciden **campo a campo**; las tablas vacías examinadas siguen vacías.
- **Saldos sin cambio:** suma 1.999.998 puntos, 0 visitas y 2 roles admin en recuperación y preproducción. El séptimo perfil adicional en preproducción es un socio con 0 puntos y 0 visitas, más un vínculo de identidad; no borrar ni asumir que es una cuenta oficial.
- **Seguridad D1:** la base QA contiene los cinco triggers `trg_clerk_*`, incluidos los que impiden alterar o borrar vínculos `migration_confirmed`; 0 perfiles, 0 enlaces. Los tests de migración ejecutan comprobaciones de integridad únicamente con SQLite en memoria.
- **Banderas de seguridad en preproducción:** `CLERK_JWT_ENABLED=no`, `CLERK_EXCHANGE_ENABLED=no`, `STAGING_MUTATIONS=disabled`, `PUBLISH_APPROVED=no`, `ALLOW_NEW_ACCOUNTS=no`, `FREE_TIER_BILLING_VERIFIED=no`, `FREE_TIER_CPU_VERIFIED=no`, `BACKUP_KEY_CUSTODIED=no`, `FINAL_ORIGIN_RECONCILED=no`.
- **R2:** el listado de buckets de la cuenta devuelve 0; el Worker de preproducción no declara un binding R2 activo.
- **Facturación:** los endpoints de suscripciones, uso y políticas de gasto devuelven HTTP 403 por permisos. No se puede confirmar el plan efectivo, el límite de gasto 0 o la imposibilidad de cobros. No marcar como verificado.
- **Límite público de Workers Free:** 100.000 solicitudes/día y 10 ms de CPU/solicitud; al rebasar el límite Cloudflare puede devolver errores en vez de servir la aplicación. Ver documentación oficial: https://developers.cloudflare.com/workers/platform/limits/ .
- **Laboratorio:** ya existe en el Worker `bellaquitas-api-staging`; panel lateral, categorías, plantillas y vistas están en código desplegado. Su presencia no acredita publicación segura de cambios reales.

### Criterios para continuar

1. Verificar una **copia final exportada, cifrada, custodiada y restaurada**, con comparación posterior a los últimos cambios reales. El cotejo de las filas anteriores **no** reemplaza esa prueba.
2. Verificar identidades reales de las dos cuentas administradoras y usuarios originales antes de enlazar Clerk por su `sub` verificado, nunca por coincidencia de correo.
3. Medir el consumo de CPU de JWT/WebCrypto y el desempeño real en Workers Free (señal de 10 ms).
4. Confirmar con acceso al panel de facturación, dado que la API conectada devuelve 403, la opción de **ningún gasto facturable**.
5. Ensayar funcionalidades, navegación ES/FR, QR y Safari/iPhone antes del corte reversible. Las pruebas manuales del usuario quedan reservadas para el final.
6. Conservar `main`, `bellaquitas.fr`, DNS, imágenes, vídeos, puntos y visitas intactos hasta resolver todos los bloqueos.

## Auditoría de restauraciones y CPU — 20/11/2026, segunda revisión

**Método:** solo lecturas en D1 y consulta de métricas reales de Workers vía `events.workersInvocations`. Ningún cambio de configuración, DNS, roles, puntos o publicación.

### Restauraciones existentes

- Se localizaron **dos bases aisladas ya restauradas**: `bellaquitas-restore-isolated-20261114` y `bellaquitas-restore-postadmin-20261115`.
- `PRAGMA quick_check` devuelve `ok` para ambas restauraciones, el origen de recuperación y el almacén de respaldos cifrados.
- Se compararon **15 tablas de negocio y auditoría** en cada restauración frente a `bellaquitas-staging`, comprobando las filas completas sin publicar datos personales. **Cero diferencias** entre registros comparados. Incluyen 7 perfiles, 7 vínculos de identidad, 2 actividades, 3 cambios administrativos, 1 evento, 1 contenido, 1 borrador, 9 entradas de auditoría y 3 entradas de migración multimedia; las restantes tablas examinadas están vacías.
- El almacén D1 `bellaquitas-encrypted-backups-20261114` contiene **un archivo cifrado** `staging-full-20261114-01`, con `AES-256-GCM`, datos SQL gzip y `plaintext_bytes=30134`; creación 14/11/2026. Hay **dos registros de bookmarks** de restauración del 15/11/2026. La presencia del archivo y las restauraciones no prueba que ese archivo concreto se pueda descifrar hoy sin una clave custodiada.
- La base de recuperación independiente conserva **6 perfiles**, frente a 7 en staging/preproducción. Los 6 originales coinciden campo por campo en la comparación previa. El séptimo socio se creó en staging el 10/11/2026; tiene 0 puntos, 0 puntos acumulados y 0 visitas. **No borrar sin verificar origen**.

### CPU medida (datos muestreados)

Consulta analítica para el período `2026-11-19` a `2026-11-21` (UTC, intervalo con límite exclusivo). `cpuTimeUs` expresado en microsegundos; `approx_max` representa un máximo **aproximado**, no una medición exhaustiva.

| Worker | CPU media | Máximo aprox. |
| --- | ---: | ---: |
| `bellaquitas-api-staging` | 2,91 ms | 483,51 ms |
| `bellaquitas-api-qa` | 1,58 ms | 18,94 ms |
| `bellaquitas-media-qa` | 10,73 ms | 366,29 ms |
| `bellaquitas-device-qa` | 0,50 ms | 2,96 ms |
| `bellaquitas-admin-visual-preview` | 0,57 ms | 3,54 ms |

**Interpretación:** la API principal y el flujo multimedia muestran picos incompatibles con asumir que todas las solicitudes respetan el objetivo de 10 ms de CPU. No confundir el promedio con el máximo. Esta métrica no mide por separado el proceso JWT/WebCrypto de Clerk. No habilitar tráfico real basado solo en las medias.

### Bloqueos restantes

- Obtener y custodiar fuera de GitHub la clave del backup cifrado, restaurar **ese archivo concreto** y comparar una instantánea actualizada de origen frente a destino. No guardar secretos en el repositorio público.
- Crear/vincular usuarios Clerk únicamente tras autenticación verificada de la identidad Google previa y de la nueva; producción y desarrollo Clerk todavía tenían **cero usuarios** en la comprobación.
- Aislar las rutas con picos de CPU (sobre todo multimedia) y demostrar funcionamiento dentro de los límites reales del plan, antes de habilitar el Worker para producción.
- La API de suscripciones/facturación sigue sin permisos suficientes (**403**); gasto cero **sin verificar**.
- Pruebas del usuario en dispositivos reales se reservan para el final, tal como se acordó. No cortar DNS ni fusionar la rama antes de resolver bloqueos.

## Correcciones del 20/11/2026 — rutas R2 eliminadas y coste operativo

- La API de staging ahora responde **404** si se solicita un logo permitido sin binding R2, en lugar de lanzar `TypeError` y devolver 503. Las fotografías también devuelven 404 cuando no existe un cliente `MEDIA.get`; `/health` solo muestra almacenamiento configurado cuando existe `MEDIA.get`.
- En las rutas protegidas de carga de fotos, si ya pasó la autenticación, autorización de origen y la bandera de pruebas pero **R2 no tiene `put` y `delete`**, devuelve **503 antes de leer el cuerpo o escribir en D1**. Las escrituras continúan bloqueadas por `STAGING_MUTATIONS=disabled`.
- Dos nuevos test suites offline: `cloudflare/test-staging-no-r2.mjs` y `cloudflare/test-protected-no-r2.mjs`, ambos incluidos en el flujo GitHub Actions `.github/workflows/qa-clerk.yml`. La ejecución https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/44790437667 finalizó `success`.
- Se consultaron los **8 Workers** de la cuenta Cloudflare: **ninguno tiene Cron Triggers programados**, y ninguno de sus bindings actuales es de tipo R2. El listado de buckets R2 de la cuenta está vacío. No se tocaron esos Workers.
- El `cloudflare/README.md` indica que la documentación inicial sobre R2 quedó obsoleta, para evitar reactivarlo por error.
- **Limitación importante:** esto evita errores de R2 en el código propuesto, no migra las fotos a un almacenamiento nuevo ni demuestra que los vídeos se sirvan por rutas finales sin CPU. Sin presupuesto confirmado y sin validación de usuarios reales, la web pública y DNS no se modifican.
