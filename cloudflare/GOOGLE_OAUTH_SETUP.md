# Google OAuth para Bellaquitas Fest: configuración pendiente

La API de pruebas y las vinculaciones de las seis identidades de Google
ya están preparadas. El inicio de sesión está **desactivado** hasta
configurar un cliente OAuth autorizado. No se debe cambiar la web
pública hasta probarlo.

## 1. Cliente OAuth de Google
En [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
crear o editar un **OAuth 2.0 Client ID** de tipo *Web application*.

Añadir esta **Authorized redirect URI** para las pruebas:

`https://bellaquitas-api-staging.bellaquitas-fest-410.workers.dev/v1/auth/google/callback`

No borrar las URI de Supabase existentes; la web pública sigue
utilizándolas. La futura URI para el dominio definitivo sería
`https://bellaquitas.fr/v1/auth/google/callback` una vez que Cloudflare
pueda servir la API desde ese origen.

## 2. Secretos en Cloudflare
Cloudflare Dashboard → Workers & Pages → `bellaquitas-api-staging`
→ Settings → Variables and Secrets.

Añadir **como secretos**:
- `GOOGLE_CLIENT_ID` — Client ID del proyecto de Google.
- `GOOGLE_CLIENT_SECRET` — Client Secret del proyecto de Google.

NO enviarlos a ChatGPT, ni pegarlos en GitHub ni en `config.js`.
La conexión de ChatGPT con Cloudflare permite verificar que existen
los bindings sin mostrar sus valores.

## 3. Pruebas
Abrir
`https://bellaquitas-api-staging.bellaquitas-fest-410.workers.dev/v1/auth/google/start`

El Worker usa authorization code flow con PKCE SHA-256, estado OAuth
de uso único y nonce; verifica la firma RS256 del ID Token de Google,
emisor, audiencia, caducidad, nonce e identidad. Vincula el Google
`sub` a su perfil D1, sin depender del email para asignar permisos.
Las cookies de sesión son HttpOnly, Secure y SameSite=Lax.

**Durante staging:** `ALLOW_NEW_ACCOUNTS=no`, por lo que las identidades
no importadas no pueden abrir cuentas nuevas. `STAGING_MUTATIONS=disabled`.

## Antes de habilitar producción
Mover el endpoint de autenticación a primera parte, bajo
`bellaquitas.fr`, mediante Cloudflare DNS y Worker Route o un Worker
que sirva tanto la SPA como la API; las cookies en `workers.dev`
son de un sitio diferente del de la web GitHub Pages.

El registro por email/contraseña requiere un sistema de envío de
correo con verificación y recuperación. Las seis cuentas importadas
son de Google y no tienen contraseñas para migrar.
