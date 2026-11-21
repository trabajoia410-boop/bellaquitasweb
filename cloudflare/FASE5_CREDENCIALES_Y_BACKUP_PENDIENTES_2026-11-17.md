# Bellaquitas Fest — último corte de autenticación pendiente, sin PowerShell

**Fecha:** 17/11/2026. **Estado:** Worker privado preparado. **NO activar el dominio todavía.**

## Verificado en los servicios conectados
- Cloudflare staging conserva `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`, `EMAIL_RATE_KEY`, `TURNSTILE_SECRET`. Esos bindings son secretos y **sus valores originales no se pueden consultar** desde la API. Nunca convertirlos en variables de texto, subirlos a GitHub ni reenviarlos al chat.
- Cloudflare `bellaquitas-api-preproduccion` dispone ya de `DB` EU de siete perfiles, `ASSETS` originales, `TURNSTILE_SECRET`, `TURNSTILE_SITE_KEY` y una nueva `EMAIL_RATE_KEY`. Conserva `SITE_MODE=preproduction`, `PUBLISH_APPROVED=no`, altas/escrituras desactivadas, `workers.dev` y previews cerrados, sin rutas públicas.
- **Faltan únicamente en el Worker final** el par `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` y `RESEND_API_KEY`, además de pruebas de autenticación con origen definitivo. La presencia de un binding NO demuestra el éxito de login OAuth.
- Resend tiene dominio `bellaquitas.fr` verificado, envío habilitado, remitente `no-reply@bellaquitas.fr`, y la clave de staging ya creada. Crear una nueva clave mediante la integración conectada obligaría a **mostrar una clave que solo se revela una vez en el propio chat**, por lo que no se hizo para no repetir la exposición de secretos.
- No hay acceso conectado de administración de clientes OAuth de Google Cloud. No es posible obtener ni inventar Client Secret desde la API de Cloudflare o la clave de staging.

## Procedimiento seguro para la única configuración privada restante
Estas acciones se reservarán para la intervención autorizada del propietario, en la web gráfica correspondiente **sin PowerShell** y sin compartir secretos con ChatGPT:

1. **Google Cloud Console**: en `https://console.cloud.google.com/apis/credentials`, editar o crear cliente OAuth de tipo **Web application**, conservando los redirects antiguos mientras el sitio previo siga publicado. Añadir el redirect final **exacto** `https://bellaquitas.fr/v1/auth/google/callback`. Pegar los datos de cliente directamente como *Secrets* `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` en el Worker nuevo.
2. **Resend**: en la propia consola del proveedor, crear credencial independiente con permiso **sending_access**, limitada al dominio `bellaquitas.fr`. Insertarla **directamente** en Cloudflare Worker `bellaquitas-api-preproduccion` como secreto `RESEND_API_KEY`. No copiar ni pegar el token aquí ni utilizar una clave de acceso global si basta el envío.
3. Verificar que Cloudflare mantiene `PUBLIC_ORIGIN=https://bellaquitas.fr`, `RESEND_FROM=no-reply@bellaquitas.fr` y que el widget Turnstile de producción cubre el hostname final.
4. Revalidar CI, la identidad Google por `provider_subject`, la denegación anónima del panel, el correo de recuperación y cookies seguras **en un entorno de prueba adecuado**. No vincular contraseñas de administradores reales automáticamente ni modificar puntos.

## Otros dos bloqueos independientes de las credenciales
- **Nuevo backup cifrado con clave privada distinta del chat:** el backup original de ocho CSV **se generó y restauró correctamente** el 16/11. El binario histórico `.bqbk` solo se había compartido como enlace del sandbox de otra sesión y no está accesible para recifrar ahora. La clave antigua figura en Library, pero no sirve rotar sin el respaldo original. El export firmado temporal de D1 se solicitó, pero no se pudo descargar por restricción del servicio, así que **no se afirma tener un nuevo backup externo**. Las tres bases D1 conservan puntos de restauración Time Travel, con retención limitada.
- **Delta del proveedor anterior:** las bases Cloudflare contienen los seis usuarios exportados + uno nuevo de email verificada, y 16/16 tablas replicables idénticas; la antigua fuente no puede considerarse congelada por simple coincidencia interna. Falta una prueba fechada del estado del origen después del export.

## Activación
La política no permite delegación de nameservers ni ruta pública hasta completar respaldo, credenciales, delta externo y autorización: `node cloudflare/check-release-gates.mjs --require-dns-delegation` y posteriormente `--require-release`.

La página, vídeos, idioma y diseño continúan como antes. Ningún cambio en el DNS efectivo de Hostinger ni en `main`. No se habilita ningún servicio de pago.
