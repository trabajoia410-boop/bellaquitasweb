# Bellaquitas Fest — preparar registro con correo y contraseña (sin activar)
Actualizado: 10 de noviembre de 2026.

## Estado
El inicio Google funciona en staging con sesiones mediante cookies HttpOnly.
La interfaz de pruebas de Cloudflare está en `/preview` y usa el mismo origen
de la API para evitar el bloqueo de cookies de terceros en iPhone/Safari.

**No se permiten altas por email ni contraseñas hasta tener proveedor de
entrega de correo, verificación, recuperación y protección contra abuso.**
Las cuentas importadas de Supabase son identidades de Google: no existen
contraseñas que podamos recuperar o copiar.

## Arquitectura propuesta
- Identidad interna D1 enlazada a perfiles mediante una tabla privada de
  credenciales; NO editar la propiedad `role` desde datos de usuario.
- Contraseñas con un KDF específico para contraseñas de uso moderno, con
  salt individual y parámetros versionados. No almacenar contraseñas
  reversibles ni hashes SHA-256 simples. Auditar límites CPU de Workers.
- Alta pendiente de confirmación por correo: generar token criptográfico
  aleatorio, almacenar exclusivamente hash con expiración corta y consumir
  una sola vez. No activar sesión antes de validar email.
- Restablecimiento de contraseña con tokens de un solo uso, expiración,
  invalidación de sesiones previas y respuestas indistinguibles para cuentas
  existentes o no existentes.
- Rate limits por IP y cuenta, defensa anti-bot (por ejemplo Turnstile),
  límites de longitud, mensajes neutros y registros de auditoría sin secretos.
- Envío transaccional con proveedor verificado y dominio remitente firmado.
  Cloudflare Email Sending para destinatarios arbitrarios requiere Workers
  Paid en noviembre de 2026; **no activarlo ni contratarlo sin decidir la
  opción gratuita o el coste aceptable**.
- Registro `ALLOW_NEW_ACCOUNTS=no` y mutaciones `STAGING_MUTATIONS=disabled`
  hasta pasar pruebas. Las rutas deben fallar cerradas sin proveedor.
- Pruebas de creación, confirmación, acceso, recuperar, cierre y caducidad,
  empleando cuentas ficticias aisladas en staging. Ningún cambio de puntos
  o visitas de cuentas reales.

## Antes de la migración de producción
1. Confirmar remitente y servicio para correo transaccional.
2. Implementar /v1/auth/email/register, verify, login, forgot y reset
   con las verificaciones indicadas arriba.
3. Auditar RLS/privilegios, rate limiting, CSRF y cookies de primera parte.
4. Probar en iPhone/Safari y Android, y un usuario/rol de cada tipo.
5. Adaptar el frontend completo a las rutas Cloudflare (no solo el preview).
6. Crear copias de seguridad, reconciliar datos y preparar reversión.

Web pública: sigue en GitHub Pages + Supabase. No cambiar DNS ni borrar datos.
