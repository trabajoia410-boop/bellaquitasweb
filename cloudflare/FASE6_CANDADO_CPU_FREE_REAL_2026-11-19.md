# Bellaquitas Fest — fase 6: defensa de CPU y cero gasto (19/11/2026)

**Objetivo:** no abrir `bellaquitas.fr` ni su autenticación si Workers Free no ha sido verificado con operaciones de CPU reales. Sin activar Workers Paid, R2, rutas públicas, registrar usuarios reales, alterar puntos, fusionar `main` ni cambiar DNS.

## Hecho en el código (rama de migración, PR #3)

- `cloudflare/production-auth-readiness.js`: `productionConfigurationReady` exige ahora `FREE_TIER_CPU_VERIFIED=yes` además de autorización explícita, conciliación final, clave custodiada y facturación Free acreditada. Si falta: HTTP 503, `no-store`, sin `Set-Cookie` y sin CORS de producción.
- `cloudflare/wrangler-api-preproduccion.jsonc`: `FREE_TIER_CPU_VERIFIED=no`, con `SITE_MODE=preproduction`, `PUBLISH_APPROVED=no`, `BACKUP_KEY_CUSTODIED=no`, `FINAL_ORIGIN_RECONCILED=no`, `FREE_TIER_BILLING_VERIFIED=no`. **No modificar estos valores para forzar el corte**.
- Las pruebas `test-production-auth-cutover.mjs`, `test-production-worker-options-gate.mjs`, `test-preproduction-config.mjs` y `test-free-cpu-policy.mjs` cubren el cierre por ausencia de esta nueva condición (incluido preflight CORS). Los demás controles de fidelidad, datos y diseño continúan vigentes.
- El cambio de código superó **3/3 flujos de GitHub Actions** antes de activarse el disparador privado de despliegue.

## Worker privado desplegado

Cloudflare Workers Builds `bb024188-d3da-49f5-a20b-8b322345914b` completó `success` el 19/11/2026 10:11:38 UTC. Worker `bellaquitas-api-preproduccion`, versión `2bf4e735-87f9-4ba0-97dc-92bbd4383802`.

Lectura **directa** del estado tras el despliegue por API Cloudflare:

| Comprobación | Estado |
|---|---|
| Workers.dev y vistas previas | Desactivados |
| Rutas públicas de zona | 0 |
| `SITE_MODE` | `preproduction` |
| `FREE_TIER_CPU_VERIFIED` | `no` |
| `FREE_TIER_BILLING_VERIFIED` | `no` |
| `PUBLISH_APPROVED` | `no` |
| `FINAL_ORIGIN_RECONCILED` | `no` |
| `BACKUP_KEY_CUSTODIED` | `no` |
| Registro / mutaciones | Desactivados |
| Enlaces privados de Google/Resend/Turnstile | Conservaron sus secretos y Service Binding |
| D1 destino | 7 perfiles, 2 administradores, **1.999.998 puntos**, 0 visitas |
| Zona Cloudflare | Free Website / pending |
| R2 | 0 buckets |

**No se publicaron enlaces a `bellaquitas.fr`.**

## Consumo observado, sin crear servicios

- Cloudflare GraphQL `workersInvocationsAdaptive` para **19/11/2026 UTC**: **26.662 solicitudes observadas** entre scripts de la cuenta, bajo las 100.000 solicitudes diarias de Workers Free. Esto es telemetría parcial, **no una lectura de facturación**, ni garantía de continuidad si se agota la cuota.
- Resend, conector de cuenta: **0/100 correos diarios**, **3/3.000 mensuales**; sin envíos de prueba.
- Workers Free 0 €/mes había sido acreditado mediante capturas del usuario. La API de facturación integral mantiene permiso denegado; `phase6ZeroSpend.billingAuditComplete=false`, suscripción R2 programada para cancelación y otros productos no observables pendientes. **No declarar facturación global cero garantizada**.
- El último informe CPU por versión (`FASE6_DESPLIEGUE_PRIVADO_CPU_Y_VIDEO_2026-11-19.md`) registra 1.178 solicitudes correctas de staging, CPU P99 4,462 ms, máximo observado 9,179 ms, con vídeos 206 comprobados. No sustituye perfilado KDF (600.000 iteraciones) ni caché fría; los cuatro flags CPU estrictos de publicación permanecen `false`.

## Pendientes reales sin repetir pasos anteriores

1. **CPU de contraseña:** perfilado sintético en Cloudflare con protección de abuso; evitar endpoint público nuevo sin autenticación. No bajar el número de iteraciones PBKDF2 ni habilitar Workers Paid.
2. **Respaldo legado:** existe nuevo respaldo cifrado D1 restaurado y clave RSA nueva custodiada fuera del chat por el propietario. Falta rotar/recifrar el archivo antiguo del 16/11; la biblioteca no permitió materializar sus bytes originales. No solicitar de nuevo la clave nueva.
3. **Gasto cero:** resolver únicamente lo no acreditado (otros servicios y cancelación administrativa R2); las fotografías y Workers Free ya constan aceptados.
4. **Corte final:** nueva lectura de diferencias del origen, archivo de respaldo final, autorización de producción, DNS y pruebas de Google/Resend en hostname canónico. Las comprobaciones físicas manuales del propietario siguen pospuestas hasta después de publicar.

**No confundir las optimizaciones y los 3 CI verdes con aprobación de publicación.** PR #3 continúa borrador y sin fusionar.
