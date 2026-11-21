# Cloudflare Workers Static Assets — migración Bellaquitas (15/11/2026)

**Objetivo:** mantener el mismo diseño, mismas fuentes, vídeos y logos sin recomprimir ni pasar a un servicio de pago. La web pública `bellaquitas.fr` y su DNS **no han cambiado**.

## Inventario Git original

- `cloudflare/site-media-manifest.js`: **17 archivos** (5 MP4 y 12 recursos auxiliares: logos, QR, iconos, licencia).
- Antes de copiar se comprueban bytes y hash de blob Git original.
- Ningún archivo supera 25 MiB (= 26.214.400 bytes), límite individual documentado en Workers Static Assets Free; el vídeo más grande pesa 25.437.525 bytes.
- Generar sin modificar el contenido:

```sh
node cloudflare/verify-migration.mjs
node cloudflare/audit-original-videos.mjs
node cloudflare/test-mp4-range-proxy.mjs
node cloudflare/build-static-assets.mjs
```

La carpeta de salida `cloudflare/dist-static/assets/` es una copia exacta de los recursos versionados. Está ignorada por Git y **no está desplegada** en Cloudflare. El Worker `bellaquitas-api-qa` no tiene binding `ASSETS`.

## Diagnóstico MP4 / Safari

Los cinco vídeos contienen vídeo H.264 `avc1`:

| Original | Resolución | Índice MP4 `moov` |
| --- | --- | --- |
| Bellaquitas Fest para móvil.mp4 | 1080 × 1920 | **Tras** los datos (requiere probar HTTP Range 206) |
| bellaquitas fiesta portada movil.mp4 | 464 × 832 | Antes de los datos |
| bellaquitas fiesta portada.mp4 | 3840 × 2160 | **Tras** los datos |
| bellaquitas-fiesta-fondo 1.mp4 | 832 × 464 | Antes de los datos |
| bellaquitas-fiesta-fondo.mp4 | 1920 × 1080 | **Tras** los datos |

- El MP4 original NO se ha cambiado, reordenado ni recodificado.
- CI verifica con bytes simulados que el Worker del espejo conserva `Range`, `Content-Range`, el estado `206` y el contenido exacto.
- CI verifica una corrección **solo en el espejo Cloudflare** para seleccionar directamente el MP4 vertical tras la banda amarilla en Safari iPhone, usando el archivo y diseño original.
- El índice `moov` al final no implica por sí solo que el vídeo falle; requiere probar reproducción en iPhone con el despliegue QA de medios y `Range` real.
- `ffprobe` no está instalado en el runner; la auditoría extrae la pista `avc1` y resolución de los átomos `stsd`, pero no certifica el perfil H.264 ni `pix_fmt`. Probar Safari real sigue pendiente.

## Tres logos antiguos (bloqueo)

Originales localizados por metadatos de solo lectura en Supabase Storage `bellaquitas-media/logos/`; **todavía no se han descargado ni copiado**. Ver `RECOVER_ORIGINAL_LOGOS_2026-11-15.md` y `legacy-logos-manifest.json`.

Solo después de recuperar sus bytes (con nombres originales) en `assets/migrated-logos/`:

```sh
node cloudflare/build-static-assets.mjs --require-logos
```

**Si falta uno o no coincide el ETag/tamaño, el comando falla**. No se inventa ningún logo ni se deja que una publicación pase incompleta.

## Antes del despliegue definitivo

1. Recuperar/validar los tres logos y conservar copia en Git.
2. Configurar Workers Static Assets con `ASSETS` en **Worker QA independiente**, sin R2 y sin tocar el dominio.
3. Probar `GET` y `Range` real `206` en los cinco vídeos, más Safari iPhone/Android.
4. Comparar capturas y diseño, ES/FR, QR y permisos.
5. Resolver el perfil extra detectado en la conciliación Supabase → D1; respaldar producción y rotar la clave del antiguo backup.
6. Validar dos administradores reales, restauración segura y reversibilidad antes del cambio DNS.

El flujo Free tiene 20.000 assets por Worker y 25 MiB por archivo (según Cloudflare), pero no se debe prometer una capacidad ilimitada ni modificar el plan de pago.
