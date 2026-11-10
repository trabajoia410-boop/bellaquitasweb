# Bellaquitas Fest — acceso por correo en Cloudflare
Actualizado: 11 de noviembre de 2026.

## Implementado y habilitado SOLO EN STAGING (prueba de envío por registro pendiente)

- Rutas /v1/auth/email/status, /register, /verify, /login, /forgot, /reset.
- Tablas aisladas en D1 (migración `0006-email-auth.sql` aplicada): `auth_email_credentials`,
  `auth_email_tokens` y `auth_email_rate_limits`, inicialmente vacías.
- Contraseñas protegidas con PBKDF2-HMAC-SHA256 (600.000 iteraciones,
  salt aleatorio de 256 bits por contraseña), sin contraseña en texto claro.
- Token aleatorio de un solo uso de 256 bits para confirmación (30 minutos)
  y recuperación (20 minutos), almacenado solo como SHA-256.
- Revocación de las sesiones tras restablecer contraseña.
- Límite de intentos por dirección IP y correo usando claves HMAC
  seudonimizadas, validación JSON/longitud y control Origin estricto.
- Integración de **Resend** para correo transaccional y **Cloudflare Turnstile**
  para altas y recuperación; tokens Turnstile verificados en servidor,
  incluido el hostname esperado.
- Autenticación con cookies HttpOnly + Secure + SameSite=Lax del mismo
  origen, ya existente para Google.
- Formularios para login/registro/verificación/recuperación en `/preview`,
  visibles en staging tras completar la configuración.
- Cuentas antiguas con Google: **no se importan contraseñas, no se vincula
  automáticamente una cuenta por coincidencia de correo**. Deben entrar con Google.
- `ALLOW_NEW_ACCOUNTS=no`, `STAGING_MUTATIONS=disabled` siguen activos.
  `EMAIL_AUTH_ENABLED=yes` y `EMAIL_REGISTRATION_ENABLED=yes` SOLO en el Worker staging;
  permiten cuentas **de pruebas** tras verificación por correo. Google sigue
  con altas nuevas desactivadas gracias a `ALLOW_NEW_ACCOUNTS=no`.

## Configuración y pasos para completar las pruebas de email

1. [COMPLETADO] Crear un proyecto de **Resend** con plan Free, sin activar
   sobrecostes/pay-as-you-go, y verificar el dominio remitente
   `bellaquitas.fr` mediante los registros DNS que solicite Resend en
   Hostinger (no trasladar el dominio ni cambiar el hosting).
   Precio público consultado 10/11/2026: Free $0/mes, 3.000 emails/mes,
   máximo 100 al día. Ver https://resend.com/pricing
2. [COMPLETADO] Crear un widget **Cloudflare Turnstile** para el hostname del Worker de
   pruebas `bellaquitas-api-staging.bellaquitas-fest-410.workers.dev`;
   conservar la site key pública y el secret privado.
3. En `bellaquitas-api-staging` añadir secretos (no enviarlos por chat):
   - `RESEND_API_KEY`: API token de Resend (tipo Secreto).
   - `EMAIL_RATE_KEY`: valor aleatorio secreto de 32 bytes o más, en texto
     seguro; no reutilizar contraseñas ni tokens de Google (tipo Secreto).
   - `TURNSTILE_SECRET`: clave secreta del widget (tipo Secreto).
4. Añadir variables públicas:
   - `RESEND_FROM`: una dirección del dominio verificado, por ejemplo
     `acceso@bellaquitas.fr` **solo si esa dirección y dominio quedan
     autorizados para envío**.
   - `TURNSTILE_SITE_KEY`: site key pública del widget.
   - `TURNSTILE_EXPECTED_HOSTNAME`: hostname exacto del staging si se
     utiliza un hostname distinto a `PUBLIC_ORIGIN`.
5. **Aplicado en staging:** `EMAIL_AUTH_ENABLED=yes` y `EMAIL_REGISTRATION_ENABLED=yes`.
   Se mantiene `ALLOW_NEW_ACCOUNTS=no` (no se abren nuevas cuentas Google) y
   `STAGING_MUTATIONS=disabled` (no se modifican puntos ni visitas).
6. Probar registro con una cuenta FICTICIA nueva, confirmación, login,
   persistencia, logout, recuperación y doble uso de tokens; retirar al
   terminar el usuario ficticio si procede. Verificar que ningún dato de
   los seis perfiles importados cambió. Probar también iPhone y Android.

## Avisos operativos

- Sin las credenciales, los endpoints regresan HTTP 503 o indican
  `registration:false`; no simulan un email enviado.
- El proveedor elegido no puede activarse sin verificar DNS, y el API
  token de Resend no puede inventarse. Son pasos que necesitan acceso a
  cuentas externas.
- La API de pruebas ya tiene protección de origen y roles. Aun así,
  antes de abrir registros al público se necesita revisión de seguridad
  adicional, comprobación de entregabilidad y monitorización.
- **No desplegar este flujo de correo en el dominio público sin
  validar cuenta/contraseña, CSRF, envío real y protección antiabuso.**

## Trabajo pendiente para retirar Supabase
- Adaptar todas las secciones y el editor completo de la web al backend
  Cloudflare, comprobar el QR/cámara en iPhone real, controles de puerta
  y rol admin. Probar la escritura **únicamente con perfiles ficticios**.
- Copias de seguridad, migración incremental final, permisos, DNS,
  HTTPS, OAuth de origen propio y plan de reversión.
- Mantener el sitio actual `bellaquitas.fr` en GitHub Pages + Supabase
  hasta completar las pruebas.

Fuentes técnicas: https://resend.com/docs/send-with-cloudflare-workers
y https://developers.cloudflare.com/workers/runtime-apis/web-crypto/

## Histórico: estado previo a la activación, 11 de noviembre de 2026

- Resend: dominio `bellaquitas.fr` **verified** en región `eu-west-1`, envío habilitado.
- Resend: creada API key de permiso **sending_access**, restringida a
  `bellaquitas.fr`. **GUARDADA por el usuario** como secreto `RESEND_API_KEY`
  en Cloudflare; su presencia fue verificada sin consultar el valor. Nunca copiar la
  clave a GitHub, capturas o archivos del repositorio.
- Cloudflare Turnstile: widget **Bellaquitas Fest - registro staging**
  creado para el hostname staging y clave secreta instalada como
  `TURNSTILE_SECRET`.
- Clave pública `TURNSTILE_SITE_KEY`, `TURNSTILE_EXPECTED_HOSTNAME`
  y remitente `RESEND_FROM=no-reply@bellaquitas.fr` configurados.
- `EMAIL_AUTH_ENABLED=no`, `ALLOW_NEW_ACCOUNTS=no` y
  `STAGING_MUTATIONS=disabled`: permanecen **desactivados**.
- **GUARDADO por el usuario**: secreto independiente `EMAIL_RATE_KEY` en
  Cloudflare. Se verificó su presencia sin mostrar el valor.
- **NO activar** registro ni contraseñas antes de comprobar
  `RESEND_API_KEY` y `EMAIL_RATE_KEY` instalados, entrega efectiva
  de correo, protección Turnstile y QA con identidades ficticias.
- No se han modificado cuentas, visitas o puntos reales.

## Histórico: control previo de secretos (11/11/2026)
- Se comprobó en Cloudflare la presencia de los cinco secretos:
  `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`,
  `EMAIL_RATE_KEY` y `TURNSTILE_SECRET`. No se leyeron sus valores.
- Petición pública de solo lectura a `/v1/auth/email/status` respondía
  `login:false`, `registration:false`, `turnstileSiteKey:null`: protección cerrada correcta.
- D1: 6 perfiles, 1.999.998 puntos, 0 visitas; 0 cuentas por email, 0 tokens pendientes.
- No se han activado `EMAIL_AUTH_ENABLED` ni `ALLOW_NEW_ACCOUNTS`;
  la web pública continúa sin cambios.
- **Prueba de envío aún pendiente**: se necesita un remitente autorizado y un destino de prueba
  para ejecutar una prueba real a través del Worker/Resend. No debe usarse un correo real sin indicar el destinatario.

## Estado vigente tras activar los formularios de PRUEBAS (11/11/2026)

- **Resend:** dominio `bellaquitas.fr` verificado, remitente `no-reply@bellaquitas.fr`; clave de envío limitada al dominio ya presente como secreto en Cloudflare.
- **Turnstile:** widget Managed vinculado exactamente al hostname del Worker staging; site key y secreto presentes, sin revelar sus valores.
- **Staging:** `EMAIL_AUTH_ENABLED=yes`, `EMAIL_REGISTRATION_ENABLED=yes`.
  El registro por correo se controla de manera separada a las altas nuevas de Google (`ALLOW_NEW_ACCOUNTS=no`).
- **Datos protegidos:** `STAGING_MUTATIONS=disabled` sigue bloqueando visitas, canjes y alteraciones de puntos.
- **D1 tras despliegue:** 6 perfiles existentes, 1.999.998 puntos y 0 visitas; 0 credenciales email y 0 tokens de alta al hacer la comprobación.
- **Pruebas realizadas:** handlers con entorno ficticio muestran `login=true` y `registration=true`; si falta secreto Turnstile, registro se bloquea. Navegador remoto confirmó que el formulario de registro de staging es visible y el aviso de uso exclusivo para pruebas aparece.
- **Pendiente:** recorrer el registro con una dirección real destinada a pruebas, recepción del email enviado desde el Worker, enlace de verificación, login con contraseña, logout, restablecimiento y antiabuso real. No afirmar que el flujo completo funciona hasta terminarlo.
- **Producción intacta:** `bellaquitas.fr` continúa en GitHub Pages + Supabase. Nunca reutilizar contraseñas de producción en staging.
