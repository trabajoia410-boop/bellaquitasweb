# Bellaquitas Fest — incidente de vídeo iOS/Range y recuperación de panel (16/11/2026)

**Entorno afectado:** Cloudflare Workers Static Assets, exclusivamente Workers `bellaquitas-media-qa` y `bellaquitas-api-staging`. No se modificó `bellaquitas.fr`, `main`, DNS, R2, puntos, visitas ni diseño.

## Hallazgo reproducido: HTTP 206 sin cuerpo al final del MP4
- En GitHub Actions se captó que `Bellaquitas Fest para móvil.mp4` devolvía `206` con cabecera `Content-Range: bytes 9072021-9072276/9072277` pero **cuerpo de 0 bytes** en vez de 256. El comienzo del archivo de 256 bytes se entregaba bien. Prueba previa [43864657765](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43864657765).
- El camino Worker reenviaba el encabezado `Range` a `env.ASSETS.fetch` y aplicaba después un recorte propio a la respuesta `200`, lo que hacía posible un doble recorte, especialmente al final del archivo. Documentación Cloudflare: Workers Static Assets no sirve `206` de forma nativa y devuelve `200` al solicitar rango; el Worker debe construir `206` y el cuerpo correcto.
- **Cambio:** `cloudflare/media-qa-worker.js` ahora retira `Range` y validadores condicionales del GET al asset cuando debe construir un rango. El Worker recibe así el cuerpo completo y `streamByteRange` entrega solo el intervalo pedido, sin recodificación de ningún vídeo.
- Prueba de regresión: `test-media-range-static-assets.mjs` emula un caché que devolvería `200` pero con contenido previamente recortado si recibe Range; se verifica que no se reenvía.
- Build en Cloudflare media QA [`deb88acf-72da-49c7-b151-67ba4831b2a7`](https://dash.cloudflare.com/): **success** tras commit `5e9536c109dce86126f0a7e33aaa8ddc6c75b829`.
- Reprueba pública real [GitHub QA `43865798651`](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43865798651): **success**. Cinco MP4: 10 solicitudes `206` (primeros y últimos 256 bytes), cuerpo 256/256 y coincidencia binaria con originales en Git, 3 logos sin recomprimir.
- Refuerzo posterior: `test-media-qa-online.mjs` añadió un rango central de 64 KiB para cada uno de los cinco MP4. Se verifica navegación/búsqueda en archivos sin pérdida de bytes (registro GitHub QA).
- La web espejo REAL `/espejo/assets` también entrega las diez respuestas 206 correctas y bytes originales en [pipeline fase5 43866243768](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43866243768).
- No afirmar que un iPhone físico reproduce sin fallos: esa comprobación continúa pospuesta según la indicación del propietario.

## Recuperación de contraseña en panel independiente
- En `cloudflare/admin-console.js` se añadió un enlace **¿Has olvidado tu contraseña? / Mot de passe oublié ?** junto al inicio por email; abre `/espejo/#/recuperar` en nueva pestaña, preservando el panel.
- Diccionario ES/FR adaptado. `test-admin-console.mjs` validó **67 etiquetas visibles** y 12 estados traducidos, JavaScript del panel, CSP nonce y reautenticación.
- Prueba de autenticación ampliada `test-admin-email-link.mjs`: dos administradores **sintéticos**, Turnstile y Resend interceptados sin ninguna llamada externa, token de restablecimiento de un solo uso, sesiones antiguas invalidadas, contraseña antigua rechazada, acceso nuevo permitido, segundo admin inalterado, no revelar existencia de correo y perfiles/roles/puntos/visitas idénticos. No se ha restablecido ninguna contraseña REAL.
- Cloudflare Workers Builds staging [`7b726c2b-6684-4441-bb02-95eee298a070`](https://dash.cloudflare.com/): **success** tras commit `73e6ac7a934e9d312133c1e5e07206b549518246`.
- Se conserva `STAGING_MUTATIONS=disabled`, `ALLOW_NEW_ACCOUNTS=no`, 17 bindings, cinco secretos y cero bindings R2.

## Comprobación de conservación
Tras pruebas y despliegues, Cloudflare D1 staging: **7 perfiles, 2 administradores, 1.999.998 puntos actuales/históricos y cero visitas**. D1 origen aislada: seis perfiles, dos administradores y los mismos 1.999.998 puntos y cero visitas.

## Gates restantes (NO autorizar producción)
`realHttp206AndIosAndroidPlayback`, `bothRealAdminLoginsVerified`, `productionDatabaseBackupConfirmed`, `exposedBackupKeyRotatedOutOfChat`, `realDeviceQrDoorTest`, `finalEsFrMobileVisualParity`.

No rebajar controles, no elevar con tests sintéticos las pruebas físicas o autenticación humana; `productionChangesAuthorized=false`.
