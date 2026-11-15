# Bellaquitas Fest — espejo staging con cinco MP4 e imágenes originales cargando desde Cloudflare

**Fecha de verificación:** 15/11/2026. **Entorno:** `https://bellaquitas-api-staging.bellaquitas-fest-410.workers.dev/espejo/`. **Producción `bellaquitas.fr` no modificada.**

## Trabajo realmente ejecutado

Se instaló en el Worker de preparación `bellaquitas-api-staging` un fallback de solo lectura de medios **exclusivo del espejo staging**, sin modificar el HTML/CSS/JS original del sitio, usando la conexión interna gratuita de Cloudflare **Service Binding**:

`bellaquitas-api-staging` → `VIDEO_QA_PROXY` → `bellaquitas-media-proxy-qa` → archivos originales del commit fijado en GitHub.

El proxy multimedia es **temporal y no autónomo**: no aloja los ficheros en Static Assets; su origen es GitHub. La conexión Service Binding permite llamadas internas entre Workers de la misma cuenta sin solicitar nuevos tokens, contratar R2 ni exponer cookies/contraseñas en el origen multimedia.

### Protección contra cambios accidentales en producción

El fallback está deshabilitado salvo que se cumplan **todas** las condiciones:

1. El host de la petición es exactamente `bellaquitas-api-staging.bellaquitas-fest-410.workers.dev`.
2. `STAGING_MUTATIONS=disabled` (operaciones de escritura cerradas).
3. `ALLOW_NEW_ACCOUNTS=no` (registro de usuarios cerrado).
4. El Worker tiene un `VIDEO_QA_PROXY` Service Binding funcional y **no** dispone de `ASSETS`.
5. El archivo pertenece a la lista blanca exacta `SITE_MEDIA` de 17 ficheros originales, incluidos los cinco vídeos.

Cuando exista `ASSETS` propio de Cloudflare, el código **le da prioridad** y deja de utilizar el proxy. El envío interno reconstruye una petición nueva con **únicamente el método GET/HEAD y la cabecera Range**, sin transmitir `Cookie`, `Authorization`, sesión de usuario ni cabeceras Origin. El proxy además fija la versión Git de cada recurso.

## Implementación y despliegue

Archivos modificados **solo en la rama de migración**:

- `cloudflare/web-mirror.js`: fallback acotado a staging, conservación de tipo MIME y `Content-Range`, `Cache-Control: no-store`.
- `cloudflare/preview-page.js`: corregidas las menciones antiguas a R2 y los avisos sobre registros y mutaciones desactivados, tanto en español como en francés.
- `cloudflare/test-mirror-temporary-media.mjs`: pruebas en memoria que demuestran que producción, QA genérico, flags inseguros y ausencia de binding no pueden usar el proxy y que ninguna credencial llega al destino.
- `cloudflare/test-staging-mirror-media-online.mjs`: prueba por HTTPS real de los medios del espejo, archivos visuales y traducción francesa.
- `.github/workflows/qa-cloudflare-migration.yml`: ejecuta ambas pruebas.

Versiones de Cloudflare staging:

- Versión del espejo con conexión Service Binding desplegada: `efbaa67c-acd6-4d38-beb8-d4567212402e`.
- Versión anterior recuperable en staging: `970f34ef-bd6f-4568-a5e3-ae7c23be2137`.
- Proxy multimedia QA verificado: `6f2d972d-e289-494e-8857-2d0ed6b248e2`.

El Worker de staging conserva los **15 bindings anteriores** más un único binding de servicio nuevo `VIDEO_QA_PROXY` (16 en total). No se reintroduce R2. La configuración de sesiones, secretos y D1 permanece intacta.

## Comprobación real por HTTPS

GitHub Actions realizó solicitudes al **espejo staging**, no solo al proxy:

| Prueba | Resultado |
| --- | --- |
| `/espejo/` conserva el HTML y es `noindex` | HTTP 200 |
| CSS, JavaScript de la web, puente a Cloudflare y traducción FR | HTTP 200 |
| Cinco vídeos originales (respuesta HEAD) | 5 de 5, tamaños idénticos |
| Cinco vídeos al principio y al final | **10 respuestas HTTP 206 reales** |
| `Content-Range`, `video/mp4` | Correctos |
| Bytes de todos los fragmentos de vídeo | **Coinciden exactamente con Git** |
| Logo navbar, logo principal y favicon | **3 de 3 idénticos byte por byte** |
| Cookies emitidas en solicitudes públicas | Ninguna |
| POST sobre recursos y rutas no autorizadas | Rechazados |
| Datos de D1, cuentas y sesiones admin | Sin modificaciones |

La primera prueba detectó que dos Workers de la misma cuenta no se comunicaban correctamente mediante `fetch()` público (HTTP 503). Se resolvió con `VIDEO_QA_PROXY`, el mecanismo de Service Bindings indicado por Cloudflare. Una prueba posterior de GitHub Actions completó todas las comprobaciones sin errores:

**[QA migración 43761438589, intento final correcto](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43761438589)** (incluye logs de `OK: espejo staging real...`).

### Integridad de usuarios y bloqueo de escritura

La API de Cloudflare confirmó inmediatamente tras desplegar:

- **7 perfiles, 2 administradores, 1.999.998 puntos, 0 visitas, 0 sesiones administrativas reforzadas**.
- `STAGING_MUTATIONS=disabled`, `ALLOW_NEW_ACCOUNTS=no`, `EMAIL_REGISTRATION_ENABLED=no`.
- 16 bindings (incluido Service Binding), ninguna dependencia R2.

## Qué NO se debe confundir con una migración terminada

- El streaming QA mediante proxy y HTTP 206 **no sustituye a Workers Static Assets autónomos**: los medios todavía dependen de GitHub.
- Las comprobaciones automatizadas no prueban la apariencia exacta ni reproducción física en **Safari/iPhone y Android**, ni el rendimiento del dispositivo.
- La igualdad de HTML/CSS y las rutas de traducción no prueban la cobertura visual **100%** de todos los textos ES/FR.
- Los accesos reales de los dos administradores y la copia externa cifrada de producción siguen pendientes.
- No se deben realizar cambios en DNS ni publicar el panel en `bellaquitas.fr/administracion/` hasta cerrar todos los controles de lanzamiento.

**Estado global:** 16 controles, **8 aprobados y 8 bloqueados**; PR #3 sigue borrador, no fusionada.
