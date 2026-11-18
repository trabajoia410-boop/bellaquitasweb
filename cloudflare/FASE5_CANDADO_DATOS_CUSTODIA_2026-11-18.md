# Bellaquitas Fest — doble candado de publicación y nueva revisión D1 (18/11/2026)

## Trabajo realizado sobre el Worker REAL de preproducción
Se actualizó `cloudflare/production-auth-readiness.js` para exigir simultáneamente, al activar `SITE_MODE=production`:
- `PUBLISH_APPROVED=yes` y proveedores Google OAuth, Resend y Turnstile configurados y verificados según el procedimiento de corte.
- `FINAL_ORIGIN_RECONCILED=yes`: debe haber una comparación actual del origen legado que pruebe que no se han perdido altas, visitas, roles o puntos después de los CSV del 16/11. **No basta comparar staging contra otra D1 del propio Cloudflare.**
- `BACKUP_KEY_CUSTODIED=yes`: el propietario debe confirmar que puede recuperar la copia cifrada y la clave privada se encuentra fuera de ChatGPT y en ubicación separada, y que el respaldo anterior expuesto no sigue siendo el respaldo activo.

Hasta ese momento devuelve `HTTP 503` antes de servir HTML, API, login, panel o preflight CORS, incluso si alguien añade por error una ruta pública. Dos flags nuevos explícitos `no` en `cloudflare/wrangler-api-preproduccion.jsonc`.

**Cloudflare Workers Builds:** `a8189ab3-0738-4c6b-ba43-ff1c80f6a141`, **SUCCESS**, Worker `bellaquitas-api-preproduccion`. Comprobados por API: `SITE_MODE=preproduction`, `PUBLISH_APPROVED=no`, `FINAL_ORIGIN_RECONCILED=no`, `BACKUP_KEY_CUSTODIED=no`, cuentas y mutaciones desactivadas, workers.dev/preview desactivados, cero Worker Domains, zona `pending`. No se modificó la web pública.

## Tests CI
- `test-production-auth-cutover.mjs` demuestra con env sintético que ambas certificaciones se requieren incluso con Google/Resend/Turnstile ficticios y `PUBLISH_APPROVED=yes`.
- `test-production-worker-options-gate.mjs` demuestra que no se puede eludir el candado mediante `OPTIONS`.
- `test-preproduction-config.mjs` confirma que ambos valores siguen `no` en el entorno privado.
- GitHub Actions: [Seguridad y navegador](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/44246262396), [Migración](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/44246262378), [Cloudflare QA](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/44246262386).

## Comprobación EXTRA del respaldo local
Se abrió en contenedor el archivo cifrado `BELLAQUITAS_D1_COPIA_CIFRADA_2026-11-18.bqbk` y su clave privada RSA separada, sin imprimir ninguno. Se verificó el SHA-256 de archivo **`c4f3e2003329336015d949a3a45f3bf29b7f9c03b5124d358707000be7c4b456`**, se desempaquetó RSA-OAEP SHA-256 + AES-256-GCM + gzip y se restauró SQLite `:memory:`: **22 tablas, 17 índices, 5 triggers, `integrity_check=ok`, 0 errores FK, 7 perfiles, 2 admins, 1.999.998 puntos y 0 visitas**. No se entregaron filas o hashes privados al chat, ni se escribió en D1.

## Paridad D1 remota sin alteraciones
Cloudflare D1 staging y preproducción, SELECT únicamente, **16/16 tablas de negocio/identidad idénticas**, ambas 7 perfiles y 2 admins, 1.999.998 puntos, 0 visitas. La base recuperada de ocho CSV conserva 6 perfiles y 6 enlaces Google. **El delta de la plataforma original posterior al 16/11 no está verificado**.

## Qué NO se ha hecho ni se debe declarar
- No se han creado credenciales Google y Resend en el Worker definitivo: Google Cloud Console no está conectada; los secretos del Worker antiguo staging son irrecuperables mediante GET. El conector de Resend exige **mostrar en el chat** cualquier token nuevo creado: se ha evitado generar un token de envío vulnerable en un historial.
- No se ha recifrado con clave privada nueva el archivo heredado original `.bqbk`: el archivo está indexado en la Biblioteca pero el sistema ha denegado su copia en bytes al entorno; la herramienta offline independiente existe. El nuevo backup D1 sí está cifrado/restaurado, pero no revoca copias antiguas.
- No se ha consultado el antiguo proveedor de origen ni alterado puntos, roles o visitas.
- No se ha cambiado Hostinger, `main` ni `bellaquitas.fr`, y no se han habilitado servicios de pago, R2 ni Worker público.

**Estado:** Fase 5 abierta, nueva capa de prevención aplicada. Las verificaciones de iPhone/QR físico/admin real permanecen tras la publicación por decisión del propietario, sin aplazar los controles previos de credenciales y datos.
