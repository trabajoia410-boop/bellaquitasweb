# Bellaquitas Fest — recuperación exacta de los tres logos originales

**Fecha:** 15 de noviembre de 2026. **Objetivo cumplido:** recuperar los 3 objetos binarios auténticos que faltaban en la migración, con sus nombres, tamaños y huellas de integridad, **sin modificar `main`, DNS ni `bellaquitas.fr`**.

## Doble recuperación independiente

Los originales estaban disponibles en los archivos de Bellaquitas Fest previamente compartidos en el proyecto, con estos nombres legibles:

- `Corona, labios y letras doradas(1).png`
- `WhatsApp Image 2026-11-04 at 01.50.25.jpeg`
- `Corona, labios y letras doradas.png`

Se copiaron sus bytes originales a un contenedor aislado y se verificaron localmente los MD5 contra los metadatos del almacenamiento anterior. **Todas las comparaciones de tamaño y MD5 coincidieron**.

Adicionalmente, el flujo manual/automático `.github/workflows/recover-original-logos.yml` descargó **solo los tres objetos conocidos por su URL pública histórica** y comprobó **tamaño + SHA-256 completo**, antes de incorporarlos a la **rama de migración**. No usó credenciales de Supabase ni R2, y no cambió el backend de la web.

## Pruebas de autenticidad

| Nombre exacto en repositorio | Bytes | MD5 histórico | SHA-256 verificado |
| --- | ---: | --- | --- |
| `705cc152-5de2-407a-a880-1e78ca4b30ea.png` | 904603 | `f82bce49eb067393ec892975fc42ca98` | `697d666d3bf2e748a7d91fcb32e2dccec5e9d80c34c79027cc2e94bff80f09c5` |
| `af5b256c-877b-4c9c-8d36-d00854885c4b.jpg` | 130096 | `e20bd134732bae16a651831d901f1f5e` | `d1d30804198332297be440df0f02db37d5487b10c58ab6dd5937dd95acd18ff0` |
| `f4978ae8-1058-43a7-b5cd-ef9b17c11843.png` | 904603 | `f82bce49eb067393ec892975fc42ca98` | `697d666d3bf2e748a7d91fcb32e2dccec5e9d80c34c79027cc2e94bff80f09c5` |

Los dos PNG efectivamente son **idénticos byte por byte**, no únicamente por un ETag MD5. Sin embargo, **se conservan ambos nombres y rutas**, para no romper las referencias del sitio antiguo.

Los tres archivos están ahora en:

`assets/migrated-logos/`

en la rama `migracion/fase5-segura-20261114`. GitHub muestra los tamaños exactos (904603, 130096, 904603 bytes) y el flujo de recuperación ejecutó `node cloudflare/build-static-assets.mjs --require-logos` con éxito antes de guardar los binarios.

## Cambios técnicos

- `cloudflare/legacy-logos-manifest.json` sigue siendo la referencia histórica exacta: sin nombres inventados ni conversión de imagen.
- `cloudflare/build-static-assets.mjs --require-logos` verifica los 3 originales y construye ahora **20 recursos**: los 17 de la web (incluidos 5 MP4), más estos 3 logos.
- `cloudflare/test-original-logos-guard.mjs` detecta si cualquiera de los 3 desaparece o cambia.
- `cloudflare/test-media-qa-deploy.mjs` ahora exige 20 archivos y `missingLogos=0`.
- El control de lanzamiento `originalThreeLogosRecovered` pasa a **TRUE**, respaldado por bytes reales y huellas.
- Un ZIP local con los tres originales y sumas SHA-256 también está disponible como respaldo de descarga al usuario. No contiene claves ni datos personales.

## Importante: lo que NO significa

Esta recuperación **no implica** que los 20 medios se hayan publicado ya en Cloudflare QA o producción. El Worker `bellaquitas-media-qa` necesita recibir Workers Static Assets, tras lo cual habrá que verificar HTTP 206 real para los 5 MP4, carga en Safari/iPhone y Android, y traducciones ES/FR.

**No se han cambiado** el diseño, los vídeos, las imágenes de `bellaquitas.fr`, las sesiones, cuentas, puntos ni visitas. La PR #3 se mantiene en borrador y la migración final continúa bloqueada.
