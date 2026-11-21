# Bellaquitas Fest — autenticación final y DNS de correo (16/11/2026)

## Resultado aplicado a GitHub + Cloudflare
La rama `migracion/fase5-segura-20261114` ahora prepara las rutas reales de los socios y los administradores sin activar la web pública.

1. `production-auth-redirects.js` elimina en **producción** retornos rotos a `/preview`: Google termina en `/#/mi-espacio`, enlace de verificación de correo en `/?verify=<token>#/acceso` y recuperación en `/?reset_token=<token>#/restablecer`; el administrador sigue accediendo en `/administracion/`. Los enlaces en staging no se alteran.
2. `production-auth-readiness.js` niega toda la web/API con HTTP **503** si se activa `SITE_MODE=production` sin Google OAuth, Resend, Turnstile, limitación de intentos, D1, medios estáticos, banderas funcionales y **`PUBLISH_APPROVED=yes`**. No imprime secretos. Además, limita el host a `bellaquitas.fr`, redirige GET/HEAD de `www` al dominio canónico y rechaza POST entre dominios para preservar cookies `__Host-`.
3. Preproducción mantiene `SITE_MODE=preproduction`, `PUBLISH_APPROVED=no`, `STAGING_MUTATIONS=disabled`, `ALLOW_NEW_ACCOUNTS=no`, `EMAIL_AUTH_ENABLED=no` y cero secretos de autenticación en este Worker. Sin URL workers.dev, sin DNS ni Worker Domain. No se ha solicitado a los administradores ninguna contraseña.
4. Tests sin datos reales `test-production-auth-cutover.mjs` añadidos al preflight: URLs de Google, verificación/reset, bandera de publicación, secretos ausentes, host y permisos; GitHub Actions `43934256704` aprobado (seguridad, HTTPS staging, navegador ES/FR). El Worker aislado se desplegó mediante Cloudflare Workers Builds `ef456edb-60ce-4066-a546-f97eefd909d9`, resultado **SUCCESS**.
5. D1 preproducción conservada: siete usuarios, dos administradores, 1.999.998 puntos y 0 visitas. Ni staging ni recuperación originales se alteraron.

## DNS de correo verificado con Resend y Cloudflare
El dominio de envío `bellaquitas.fr` aparece **verified** y sending **enabled** en Resend, región `eu-west-1`. Se cotejaron los registros DNS requeridos con la zona **pendiente**, sin cambiar Hostinger:

- MX `send.bellaquitas.fr` → `feedback-smtp.eu-west-1.amazonses.com`, prioridad 10.
- SPF TXT `send.bellaquitas.fr` → `v=spf1 include:amazonses.com ~all`.
- DKIM TXT `resend._domainkey.bellaquitas.fr` — coincidencia de clave pública comprobada por estructura y estado verificado de Resend.
- **Faltaba** alias `rsend.bellaquitas.fr` CNAME → `send.forge.rmta.net`; se añadió al DNS **pendiente de Cloudflare**, DNS only/no proxy y TTL 3600.
- TXT de verificación de Google Search Console y A/CNAME de la web anterior conservados.

**Total: 10 registros DNS en Cloudflare Free, zona `pending` y servidores de nombres del registrador sin modificar.** No implica que ya funcione el email desde el nuevo Worker: aún faltan sus credenciales y autorización final.

## Recuperación de D1
La API de Cloudflare confirmó bookmarks Time Travel disponibles para restauración de origen, staging y preproducción, sin efectuar ningún restore (operación destructiva). En Workers Free, la retención máxima actual es **7 días**; no sustituye el respaldo cifrado independiente ni garantiza recuperar credenciales del proveedor anterior. Fuente: https://developers.cloudflare.com/d1/platform/limits/ y https://developers.cloudflare.com/d1/reference/time-travel/.

## Bloqueos que permanecen
- No hay secretos **Google OAuth**, **Resend** o **Turnstile** añadidos al nuevo Worker. Los del servidor staging son ocultos por diseño: NO copiarlos desde código ni inventar valores.
- El backend anterior puede tener cambios después de los CSV; no marcar `finalAccountReconciliationCompleted` como true sin comparar un snapshot actual.
- Rotación privada de clave antigua y backup completo de identidad: pendiente de evidencia independiente. El archivo original cifrado del 16/11 **sí existe** y no hay que volver a crear la misma extracción.
- Google OAuth debe permitir la URL de retorno definitiva `https://bellaquitas.fr/v1/auth/google/callback` cuando sea el momento, con cliente de producción autorizado; Turnstile debe coincidir con `bellaquitas.fr`.
- Los accesos reales de los dos administradores, controles de puerta, QA en iPhone/Samsung y revisión visual ES/FR se harán **después de publicar**, tal y como solicitó el propietario.

**No modificar `main`, DNS de Hostinger, usuarios, puntos ni visitas hasta cerrar los gates de datos, autenticación y aprobación final.**
