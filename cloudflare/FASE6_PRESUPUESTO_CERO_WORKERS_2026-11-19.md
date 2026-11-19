# Bellaquitas Fest — fase 6: política de presupuesto operativo cero

Fecha: 19/11/2026. **Sin DNS, sin merge, sin despliegue a la web pública, sin escrituras D1.**

## Requisito contractual del propietario

**0 € de gastos recurrentes y 0 € de sobregastos de infraestructura.** No habilitar Workers Paid, R2, Stream, Images, KV de pago ni adicionales; no asumir que plan Free para la zona equivale a plan Free de Workers. No sustituir servicios actuales que ya funcionan por suscripciones.

## Límites oficiales relevantes (consultados 19/11/2026)

- Workers Free: 100.000 invocaciones diarias **compartidas a nivel de cuenta** (reinicio a las 00:00 UTC). A partir del límite Cloudflare detiene la ejecución con error, no añade cobros por peticiones excedentes **si de verdad se está en el plan Workers Free**. No prometer servicio ininterrumpido tras ese límite. El comportamiento de ruta debe ser **fail closed** para auth, QR, puntos, admin y API, nunca fail open para ahorrar cuota.
- CPU Free: 10 ms por petición, memoria 128 MB. Un fallo por CPU también puede impedir operaciones, pero no debe afectar saldos ya confirmados.
- Workers Static Assets: archivos servidos sin ejecutar el Worker, gratis e ilimitados; `run_worker_first:true` **sí consume invocaciones**. Los rangos HTTP 206 exigidos por iPhone requieren un Worker adaptador según Cloudflare; por eso **NO quitarlo** de `bellaquitas-media-qa` sin pruebas de compatibilidad. La preproducción actual también requiere ejecutar el guard antes de servir HTML/JS para evitar fuga por host canónico si se conecta una ruta por error.
- D1 Free: 5 millones filas leídas/día, 100.000 escritas/día, 5 GB de almacenamiento en total; cuando se agota cuota, falla la consulta, no debe modificar puntos incorrectamente. No crear bases innecesarias.
- Los límites de Resend y otros terceros son independientes; que el dominio Resend esté verificado no acredita por sí solo su modalidad de suscripción.

Referencias: https://developers.cloudflare.com/workers/platform/limits/ ; https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/ ; https://developers.cloudflare.com/d1/platform/pricing/

## Comprobaciones hechas en Cloudflare y resultado

- La **zona DNS** `bellaquitas.fr` consta como **Free Website**.
- API Cloudflare de suscripciones de la cuenta: 403 **Billing Read** no autorizado. API de gasto/spend policies: 403. **No se ha podido certificar el plan Workers ni ausencia de servicios de pago con esta conexión.**
- Una spend policy `usage_block` exige `threshold_cents >= 1` según la especificación; **no satisface un tope monetario estricto de 0 €** y no se crea.
- No se han creado recursos, borrado Workers ni habilitado facturación. Los scripts `bellaquitas-api-staging` y `bellaquitas-media-qa` siguen protegidos y se mantienen los recursos de prueba.

## Bloqueos nuevos introducidos en esta rama (no desplegados)

1. `cloudflare/production-auth-readiness.js` exige además `FREE_TIER_BILLING_VERIFIED=yes` cuando `SITE_MODE=production`. Sin evidencia, todas las rutas del Worker final devuelven HTTP 503 sin CORS ni cookies; los tests lo simulan sin tocar datos.
2. En `cloudflare/wrangler-api-preproduccion.jsonc` el flag queda **`FREE_TIER_BILLING_VERIFIED=no`** por defecto. Mantener así hasta la comprobación real de facturación y un plan de ruta seguro.
3. `cloudflare/release-policy.mjs` exige `phase6ZeroSpend` con cuatro booleanos verdaderos **antes de delegar nameservers y antes de publicar**: `zoneFreeVerified`, `workersFreePlanVerified`, `otherPaidProductsAbsentVerified` y `billingAuditComplete`. Por defecto las tres últimas son **false**, sin autoaprobarse. Esto es una barrera administrativa verificada en CI, no una consulta a facturación.
4. Test de regresión de la política y de Worker/OPTIONS actualizado. En GitHub Actions se ejecutan las pruebas existentes `test-production-auth-cutover`, `test-production-worker-options-gate`, `test-release-gates` y `test-preproduction-config`.

## Optimización futura SIN sacrificar seguridad

Tras acreditar el plan Workers Free y finalizar los bloqueos de seguridad actuales, clasificar rutas: las APIs, QR, panel y páginas HTML que deben pasar por auth/productionAccessGate siguen dinámicas; los archivos verdaderamente públicos (CSS, JS, imágenes), servidos de forma segura directamente por Static Assets con control de despliegue, pueden dejar de invocar Worker. Mantener el adaptador de rangos de MP4 si Safari lo necesita. No aplicar `run_worker_first:false` globalmente a la preproducción, porque saltaría `productionAccessGate`; tampoco al servidor multimedia hasta ensayar HTTP 206 real.

**Advertencia:** la cuota de 100.000 es un **límite máximo de Workers Free**. No equivale a una garantía de disponibilidad; una alta demanda puede dejar sin funciones backend hasta el reinicio UTC. Reducir invocaciones estáticas mejora margen, pero no puede garantizar que nunca haya picos o abusos. No es correcto afirmar que el consumo ha quedado limitado artificialmente a 90.000 sin un mecanismo global comprobado.

## Próximas puertas

Para asegurar gasto cero, hay que verificar el plan Workers (además de DNS) y el listado de productos facturables directamente en Cloudflare Billing con permisos apropiados. Hasta entonces **la publicación sigue bloqueada**. No pedir al usuario que repita configuraciones Google, Resend, D1, vídeos o PowerShell ni publicar por aproximación.
