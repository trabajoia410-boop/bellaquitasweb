# Bellaquitas Fest — Cloudflare staging

**La web pública sigue en GitHub Pages + Supabase.** No pasar tráfico de
producción a Cloudflare antes de validar Google, correo/contraseña y permisos.

## Infraestructura conectada y verificada

- Cloudflare D1: `bellaquitas-staging` (jurisdicción UE).
- Cloudflare R2: `bellaquitas-media-staging` (ubicación WEUR; privado).
- Cloudflare Worker: `bellaquitas-api-staging`.
- URL de pruebas:
  `https://bellaquitas-api-staging.bellaquitas-fest-410.workers.dev`
- Bindings: `DB` (D1), `MEDIA` (R2), `PUBLIC_ORIGIN`,
  `ALLOW_NEW_ACCOUNTS=no`, `STAGING_MUTATIONS=disabled`.
- Ruta `GET /health` verificada por HTTP en Cloudflare Browser Rendering:
  estado OK, base de datos conectada y R2 configurado.
- 12 tablas de negocio en D1 + tablas privadas de OAuth, sesiones y auditoría.
- Datos copiados desde Supabase, incluyendo seis perfiles y seis vínculos
  de Google. Recuentos y suma de puntos y visitas verificados.
- Copia de datos pública: 1 evento y 1 configuración de página.
- Reglas atómicas para evitar dobles visitas, aplicar canjes y auditar
  cambios administrativos. Probadas con perfiles FICTICIOS; limpiados
  posteriormente. Saldos reales de producción NO modificados.

## Código y migraciones

- `bellaquitas-api-staging.js`: lectura pública y despacho a rutas privadas.
- `auth-routes.js`: Google OAuth con PKCE + nonce + verificación de firma
  de ID token, estados de un solo uso y cookies de sesión HttpOnly.
- `protected-routes.js`: rutas para perfil, puerta, canjes, administración
  de socios y fotografías R2. **Escrituras desactivadas** por defecto.
- `migrations/0001-schema.sql`: tablas de negocio.
- `migrations/0002-auth-and-invariants.sql`: identidades, auditoría y
  triggers de seguridad transaccional.
- `migrations/0003-oauth-sessions.sql`: estados OAuth y sesiones.
- `migrate-media-worker.js`: migrador TEMPORAL de tres imágenes públicas
  desde Supabase a R2 (sin endpoints HTTP, ejecución programada de una sola
  operación lógica). Detener los Cron Triggers tras verificar resultado.

## Estado del acceso y de la interfaz de pruebas (10/11/2026)

El cliente OAuth de Google ya tiene `GOOGLE_CLIENT_ID` y
`GOOGLE_CLIENT_SECRET` como secretos del Worker. El usuario ha confirmado
el inicio de sesión, el rol de administrador, la persistencia y el cierre
de sesión mediante capturas del mismo navegador.

La nueva pantalla de pruebas está disponible en:
`https://bellaquitas-api-staging.bellaquitas-fest-410.workers.dev/preview`

Incluye:
- Inicio y cierre de sesión con Google con cookies del mismo origen.
- Perfil de socio y QR personal generado de manera local, con opción ampliar.
- Lector de cámara para puerta con biblioteca `jsQR` local como alternativa
  a las API nativas, orientado a Safari/iPhone y Android.
- **Control de puerta de solo lectura**: consulta de códigos autorizada
  a personal de puerta y administrador, sin registrar visitas.
- Movimientos propios, resumen de administrador solo lectura,
  catálogo público de eventos, selector ES/FR.
- Formularios opcionales de correo/contraseña **ocultos y desactivados**.

### Correo y contraseña

La migración `0006-email-auth.sql` ya creó tablas privadas vacías de
credenciales y tokens en Cloudflare D1 staging; el código contiene rutas
de registro, verificación, login, recuperación y reset. NO están activas.
Se necesitan un proveedor de correo transaccional (Resend gratuito es
una alternativa), su remitente verificado, Cloudflare Turnstile y una
prueba integral con cuentas ficticias. Véase `EMAIL_AUTH_PLAN.md`.

Estado de seguridad: `ALLOW_NEW_ACCOUNTS=no`, `STAGING_MUTATIONS=disabled`;
las operaciones de fidelización no pueden escribirse desde el Worker.

### Pruebas del QR

Generación y decodificación sintética comprobadas con el mismo
`MBR-` de prueba. Se necesita comprobación presencial en iPhone y
Android para cámara, permisos y lectura física real.

**No se ha adaptado aún el `app.js` de la web pública**. Esta página
es una interfaz auxiliar de staging, no la sustitución de la portada
actual. `bellaquitas.fr` sigue en GitHub Pages + Supabase. Conservar
producción intacta hasta validar autenticación por correo, el QR en
dispositivo real, operaciones de roles, copias y corte reversible.

## No cambiar producción antes de

1. Guardar copia de seguridad de la BD y el almacenamiento, y comprobarla.
2. Confirmar que inicia sesión cada cuenta con Google en Cloudflare.
3. Configurar registro y restablecimiento de contraseña con email.
4. Probar sesión persistente, logout y autorizaciones socio/puerta/admin.
5. Verificar que el QR escaneado en iPhone/Android registra una sola visita,
   con dos actores de pruebas y sin tocar puntos de producción.
6. Verificar canjes y cambios de socio con auditoría.
7. Verificar todas las imágenes transferidas a R2 por bytes y hash.
8. Migrar los cambios de datos ocurridos desde el snapshot y verificar
   reconciliación contra producción.
9. Adaptar la web pública, probar despliegue completo y acceso HTTPS.
10. Planificar corte reversible de DNS y OAuth, conservar Supabase en
    modo recuperación hasta verificarlo todo.

## Pruebas

`node cloudflare/test-staging-api.mjs` (solo GET y controles negativos;
no altera puntos ni visitas), una vez que el endpoint resulte accesible
desde la máquina que ejecuta Node. Prueba HTTP de /health ya realizada
por el navegador remoto de Cloudflare; el resto de llamadas estuvieron
limitadas por HTTP 429 y no se consideran verificadas.
