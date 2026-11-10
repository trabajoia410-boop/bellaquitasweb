# Bellaquitas Fest — Cloudflare (entorno de pruebas)

Este directorio contiene el código de la API **solo de lectura** desplegada como
`bellaquitas-api-staging`. La web oficial en `https://bellaquitas.fr/` sigue
utilizando Supabase y GitHub Pages hasta completar una migración segura.

## Recursos separados de producción

- D1: `bellaquitas-staging` (jurisdicción UE).
- R2: `bellaquitas-media-staging` (bucket **privado**).
- Worker: `bellaquitas-api-staging` (solo endpoints públicos GET).

Los endpoints son `/health`, `/v1/site`, `/v1/events`,
`/v1/rewards`, `/v1/promos`, `/v1/moments` y
`/v1/moments/photos/:id`. Las fotografías se sirven únicamente si
la galería está publicada, su registro existe y el objeto R2 es una imagen válida.

**No existen endpoints para cuentas, QR, puntos, visitas, administradores,
registro, login, Google o escrituras.** No habilitarlos sin revisión de
autenticación, autorización, protección de sesiones, CSRF, validación, límites
de frecuencia y transacciones atómicas.

## Migración controlada

1. Copiar contenido público de Supabase a D1 y verificar su consistencia.
2. Diseñar un servicio de identidad para email y Google sin exponer contraseñas.
3. Implementar lógica transaccional para puntos, visitas, canjes y puerta con
   auditoría y autorización de servidor (nunca confiar en roles del navegador).
4. Migrar las cuentas de forma segura y preparar una política de reautenticación
   o restablecimiento de contraseña cuando sea necesario.
5. Transferir ficheros a R2 y verificar permisos y URLs.
6. Probar con cuentas de ensayo y datos ficticios; no realizar check-ins ni
   alterar puntos o visitas reales durante pruebas.
7. Solo entonces cambiar la web y el dominio en un despliegue reversible.
8. Mantener una copia de seguridad comprobada antes de retirar Supabase.

El origen `app.js` de la web oficial no depende de este Worker hasta el
cambio de backend. No agregar credenciales o secretos al repositorio.

## Despliegue verificado por API de Cloudflare (10-11-2026)

- Worker: `bellaquitas-api-staging`
- Dirección: `https://bellaquitas-api-staging.bellaquitas-fest-410.workers.dev`
- Binding D1: `DB` -> `bellaquitas-staging`.
- Binding R2: `MEDIA` -> `bellaquitas-media-staging`.
- `workers.dev` habilitado, previews desactivadas.
- Versión desplegada al 100 %, según consulta de despliegues de Cloudflare.
- El dominio público de R2 (`r2.dev`) está **deshabilitado**, sin dominios personalizados.
- Esquema exacto versionado en `migrations/0001-schema.sql`.
- Copia de catálogo público realizada: 1 evento, 1 configuración de sitio.
  Sin miembros, puntos ni visitas en la base de pruebas.
- La base original contiene 3 imágenes de logos en Storage que aún deben
  copiarse a R2 antes de cambiar referencias de archivo.
- Pruebas HTTP no destructivas disponibles con `node cloudflare/test-staging-api.mjs`.
  El acceso directo desde el entorno de conexión no ha podido verificarse;
  la API de Cloudflare sí confirma el despliegue y los bindings.

**Pendiente crítico**: elegir e implementar autenticación de usuarios
(correo/contraseña y Google), sesiones y permisos en Workers/D1; verificar
la migración de cuentas y sus datos antes de cualquier cambio de producción.
