# Bellaquitas Fest — fase 6: medición real de CPU y ruta de vídeo optimizada

**Fecha:** 19/11/2026. **Estado:** parcialmente resuelto en código, **sin despliegue a producción ni certificación bajo 10 ms**.

## 1. Datos reales de Cloudflare (solo lectura)

Consulta a Cloudflare GraphQL `workersInvocationsAdaptive`, agrupación por script, día y estado. El esquema GraphQL indica expresamente que `cpuTimeP50/P95/P99` se expresan en **microsegundos**.

**19/11/2026 UTC, estado `success`:**

| Worker | Solicitudes exitosas | CPU P50 (ms) | CPU P95 (ms) | CPU P99 (ms) |
|---|---:|---:|---:|---:|
| bellaquitas-api-staging | 5.648 | 0,811 | 19,386 | 136,050 |
| bellaquitas-media-qa | 2.368 | 1,075 | 100,366 | 222,455 |

**17/11/2026 UTC:** Cloudflare registró **62** ejecuciones con status `exceededResources` en cada Worker (podrían reflejar un fallo en cadena entre Workers); estos estados **no se repitieron el 18 o 19/11**. Este estado señala agotamiento de recursos, no permite por sí solo afirmar que cada fallo fue exclusivamente por CPU. Los picos elevados de P99 el 18 y 19 sí continúan, incluso entre las peticiones que finalizaron con status `success`.

Los valores medidos proceden del código ya desplegado en Workers; no se debe afirmar que el cambio guardado hoy en GitHub haya mejorado estas cifras. No existe todavía medida de consumo máximo por petición, perfilado por ruta ni prueba efectiva de KDF/MP4 en la versión candidata.

## 2. Hallazgo nuevo

La lectura real de `GET /accounts/{account_id}/workers/scripts/bellaquitas-media-qa/settings` muestra **`cache_options.enabled=true` y `cross_version_cache=false`** en el Worker MEDIA **ya desplegado**. Por tanto, agregar `"cache":{"enabled":true}` en `cloudflare/wrangler-media-qa.jsonc` es **alineación declarativa del repositorio con un ajuste existente**, NO la activación nueva de una caché. Las peticiones existentes aún exhiben CPU elevada y se necesitan tests de aciertos `Cf-Cache-Status`.

Cloudflare documenta que Workers Cache (sin precio separado) puede gestionar `Range`: recibe el 200 completo, devuelve 206 y lo sirve desde el caché sin ejecutar JS en los aciertos. Los 206 producidos manualmente por el Worker no se cachean. Referencias:
- https://developers.cloudflare.com/workers/cache/configuration/#range-requests
- https://developers.cloudflare.com/workers/cache/
- https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/#range-requests

## 3. Cambios de la rama de migración

1. `cloudflare/wrangler-media-qa.jsonc`: caché habilitada explícitamente, solo en QA multimedia **público**; no en Worker con identidades, D1, QR o administración.
2. `cloudflare/web-mirror.js`: en el host staging exacto, con `STAGING_MUTATIONS=disabled`, `ALLOW_NEW_ACCOUNTS=no` y Service Binding `VIDEO_QA_PROXY`, priorizar ese Worker para **MP4** incluso cuando la API tenga acceso directo a Static Assets. Los demás archivos siguen usando ASSETS directo. No transmitir `Cookie` ni `Authorization`: solo Range. En `SITE_MODE=production` se prohíbe usar dicho proxy QA.
3. `cloudflare/test-free-cpu-policy.mjs`: pruebas sintéticas de 200 público cacheable, 206 correcto para Safari, no cachear `/health` ni ruta privada, aseguramiento de que los headers de identidad no viajan al Worker de vídeo, y prueba del guard de producción.
4. `cloudflare/release-gates-2026-11-15.json`: incorporación de CPU real de hoy, sin marcar `cpu10msVerified=true` ni alterar los requisitos anteriores. Los flags de la optimización indican **`committed=true`, `deployed=false`**.

## 4. Qué impide declarar completado el objetivo 10 ms

- Ejecutar pruebas QA con Worker candidato desplegado y comprobar `Cf-Cache-Status`, HTTP 206 al inicio/final de los 5 MP4, bytes exactos y reproducción Safari/WebKit.
- Medir CPU P50, P95 y P99 por cada Worker y comparar después del despliegue; no atribuir los valores históricos a la nueva versión. Mantener el gate cerrado si P99 o máximos observados siguen superando 10 ms.
- Perfilar operación de contraseña `pbkdf2-chain6-sha256-v1` (600.000 iteraciones) sin utilizar contraseñas reales, así como rutas QR, puntos y administración ficticias. No reducir las iteraciones para forzar el indicador.
- Conservar datos reales 7 perfiles, 2 admins, 1.999.998 puntos y medios originales; **no fusionar PR #3, no cambiar DNS, no activar facturación ni publicar**.
- Esta auditoría también hereda bloqueos previos de custodia externa de respaldo, delta final, revisión de costes y Google/Resend en dominio definitivo.

**Conclusión:** medición real obtenida; problema localizado en rutas multimedia/CPU con picos persistentes; candidato de optimización preparado con pruebas sintéticas. **No se asegura todavía CPU menor de 10 ms en toda petición.**