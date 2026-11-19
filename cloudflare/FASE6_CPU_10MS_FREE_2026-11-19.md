# Bellaquitas Fest — fase 6: CPU máximo 10 ms en Workers Free

**Fecha:** 19/11/2026. **Sin despliegue público, sin cambio de DNS, sin fusión del PR #3 y sin alterar D1.**

## Condición obligatoria

Todo el backend definitivo de Bellaquitas Fest debe poder funcionar con el límite de **10 ms de CPU por invocación de Workers Free**, sin conversión a Workers Paid ni extras. La CPU consumida es tiempo de ejecución y NO el tiempo de espera de solicitudes externas/D1. Si se excede el límite de CPU, Cloudflare puede terminar la ejecución con error **1102** (`exceededCpu`). Esto protege del exceso de recursos, **pero no garantiza que la función complete bien**. Documentación oficial: https://developers.cloudflare.com/workers/platform/limits/#cpu-time

Los valores `limits.cpu_ms` de Wrangler no se aumentan: los límites personalizados solo están soportados para el modelo Standard y no sustituyen ni amplían la cuota nativa Free: https://developers.cloudflare.com/workers/wrangler/configuration/#limits

## Optimización de código realizada en la rama de migración (sin afectar producción)

1. `cloudflare/web-mirror.js`: cachear una sola vez por isolate los resultados de `sameDesignHTML` y `sameDesignJS` derivados de un snapshot original **inmutable**. Las peticiones sucesivas no repiten los reemplazos de HTML y JS. La lógica de autenticación, protección de rutas y contenido de D1 NO se cachea.
2. `cloudflare/production-site-route.js`: cachear el HTML público ya auditado y sus cabeceras seguras; conservar el método HEAD, redirecciones y comprobaciones de producción. El router principal ejecuta `productionAccessGate` ANTES de servir contenido del caché.
3. `cloudflare/test-free-cpu-policy.mjs`: verificar que los Wrangler existentes no elevan la CPU ni habilitan modelo de pago o recursos adicionales; que el snapshot estático cacheado no salta el gate; que se mantiene streaming HTTP 206 en vídeos y que **NO** se debilita el cálculo de contraseñas de 600.000 iteraciones.
4. CI existente `.github/workflows/bellaquitas-phase5-preflight.yml`: ejecutar el test de CPU estructural en cada push/PR.
5. `cloudflare/release-policy.mjs`: exigir `cpu10msVerified` para autorizar delegación DNS y publicación. Por defecto está **false** en `release-gates-2026-11-15.json`; no basta con que Free corte los excesos. El test sintético del gate marca true únicamente en copia de memoria para verificar el bloqueo.

## Riesgos de CPU que NO se han ocultado

- `cloudflare/email-auth-routes.js`: operaciones de contraseña PBKDF2 encadenadas con **seis rondas de 100.000**; la ruta de registro, login o reset podría superar 10 ms CPU, dependiendo del coste real de WebCrypto en Cloudflare. **No se han reducido las iteraciones**, porque debilitaría la seguridad y podría invalidar contraseñas existentes. Requiere **perfil real de Worker con datos ficticios aislados** antes de abrir registro público.
- `cloudflare/media-qa-worker.js` y `cloudflare/web-mirror.js`: streaming Byte Range 206 usado por iPhone y vídeos originales. Rango cerca del fin del vídeo puede exigir leer muchos fragmentos del recurso sin soporte directo de Range. No cambiar a `run_worker_first:false` sin pruebas HTTP 206 y sin asegurar que no se eluda `productionAccessGate`.
- No se configuraron soluciones de pago para ampliar CPU o medios.
- 0 incidencias activas reportadas por el endpoint de Cloudflare Observability para `bellaquitas-api-staging` y `bellaquitas-media-qa`; esto **no mide percentiles CPU ni comprueba máximo**. Consulta de claves CPU en Workers Observability no devolvió datos verificables, por lo que no se presenta como benchmark real.

## Pendiente para cumplir el requisito sin perder funciones

Realizar perfilado de CPU en ejecución de Cloudflare sobre QA aislado con solicitudes sintéticas representativas (inicio de sesión con Google, KDF email de nueva cuenta ficticia, restablecimiento, validación QR, puntos, panel, vídeo Range 206 cerca del final y portada), y verificar CPU `P99 < 10 ms`, CPU máxima observada `< 10 ms` y `exceededCpu=0` durante el ensayo. Un muestreo superado tampoco garantiza toda demanda futura: mantener alertas y monitorización y responder de forma segura a fallos sin modificar puntos.

Hasta disponer de esta evidencia, **`cpu10msVerified=false` y publicación/DNS bloqueados**. Este candado no sustituye los bloqueos anteriores de respaldo, facturación y conciliación final.
