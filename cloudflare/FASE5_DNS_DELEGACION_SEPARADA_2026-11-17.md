# Bellaquitas Fest — dos fases para los DNS, sin interrumpir la web anterior

**17/11/2026. Estado:** preparado y bloqueado, **NO cambiar Hostinger ni asociar rutas públicas**. Este documento corrige un bloqueo circular: una zona Cloudflare no pasa a `active` hasta que el registrador use sus nameservers, pero publicar el Worker necesita la zona activa.

## Datos reales contrastados en Cloudflare (lectura solamente)
- Zona `bellaquitas.fr`: **pending**, plan **Free Website**, 10 registros.
- Nameservers previstos (NO establecidos en el registrador): `donald.ns.cloudflare.com` y `tricia.ns.cloudflare.com`.
- Cuatro IP A GitHub Pages originales `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`: **exactas y DNS only**, sin proxy.
- `www.bellaquitas.fr`: CNAME a `trabajoia410-boop.github.io`, DNS only.
- `send.bellaquitas.fr` MX de Resend, TXT SPF, TXT DKIM `resend._domainkey` y CNAME `rsend`: presentes. TXT Google Search Console: presente.
- **Cero dominios asociados a Workers**.
- No se ha modificado `main`, el dominio público, Hostinger ni el registro de cuentas.

## Operación A — delegación de nameservers (sin cambiar el sitio)
Solo cuando `cloudflare/check-release-gates.mjs --require-dns-delegation` termine **con éxito** y exista autorización explícita del propietario:

1. Capturar copia de DNS actual del registrador y confirmar todos los registros exactos, incluyendo correo, TXT y A/WWW; no confiar solamente en el registro `passed` del repositorio.
2. Confirmar respaldo completo y clave privada fuera del chat, delta del proveedor anterior, credenciales finales de Google y Resend y Worker/datos preparados. Ninguna comprobación física posterior sustituye estas previas.
3. Actualizar en Hostinger **solo** los nameservers según Cloudflare. No añadir rutas del Worker, no tocar A/WWW/servicio de correo. Con los registros copiados, el sitio anterior debe seguir resolviendo a GitHub Pages durante la delegación.
4. Verificar que Cloudflare haya pasado a `active`, comparar los A/CNAME/MX/TXT con el origen, y comprobar HTTPS, correo y TXT de Search Console. Registrar evidence con fecha.
5. No asumir que los cambios DNS son instantáneos; mantener la infraestructura anterior disponible durante la transición y preparar reversión.

`readyForNameserverDelegation` requiere autorización, preflight y respaldo, datos correctos, Google/Resend/Turnstile reales en el Worker de destino, y zona todavía `pending`. Actualmente es **false**.

## Operación B — activar Worker y API pública (sitio nuevo)
Solo cuando `cloudflare/check-release-gates.mjs --require-release` termine **con éxito**, la zona esté `active` y los NS efectivamente delegados:

1. Verificar que el Worker nuevo usa **la D1 de siete perfiles**, no staging. Revisar sesiones, identidades y protección de privilegios.
2. Confirmar cobertura auténtica de Google OAuth y Resend con origen `https://bellaquitas.fr`; no publicar claves ni utilizar contraseñas heredadas.
3. Verificar foto original `62609.jpg` y cinco MP4 inalterados, panel independiente, ES/FR, QR, `robots.txt` y `sitemap.xml`.
4. Activar la ruta del Worker con `SITE_MODE=production` y `PUBLISH_APPROVED=yes` **solo tras todas las puertas y autorización**. Comprobar rutas de salud, acceso y recuperación reales, con rollback preparado, sin usar cuentas reales para pruebas destructivas.
5. Mantener registro de revertir rutas y frontend sin revertir automáticamente la base D1 (puntos y visitas requieren conciliación independiente).

El controlador distingue la delegación conservadora `readyForNameserverDelegation` de la publicación `readyForControlledPublication`. **Una zona `pending` jamás se considerará producción activa.** La CLI expone ambas salidas como `safeToDelegateNameservers` y `safeToAttachPublicWorkerRoute`, respectivamente.

## Bloqueos que NO se han levantado
- `productionDatabaseBackupConfirmed=false`: la restauración cifrada de ocho CSV originales sí existe, pero **no cubre autenticación original nativa completa**.
- `exposedBackupKeyRotatedOutOfChat=false`: el original `.bqbk` fue generado en una sesión anterior pero su archivo no está disponible actualmente en los archivos accesibles; no se puede autenticar y recifrar sin disponer de sus bytes.
- `phase6ReconciliationAudit.originalProviderDeltaCertified=false`: 16 tablas de negocio/identidad coinciden entre Cloudflare, pero no se ha consultado un snapshot posterior del proveedor anterior.
- `realGoogleClientConfiguredOnTarget=false` y `realResendKeyConfiguredOnTarget=false`: las claves de staging están guardadas como secretos cifrados y Cloudflare **no ofrece lectura de sus valores**; no copiar credenciales de un chat, repositorio o conjetura.
- `productionChangesAuthorized=false`: **no hay firma para alterar el dominio**.

El avance es real en la paridad visual/D1, pero los bloqueos de autenticación, respaldo completo y delta externo siguen siendo prepublicación.
