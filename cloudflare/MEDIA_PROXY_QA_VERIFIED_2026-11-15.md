# Bellaquitas Fest — streaming temporal de los 20 medios en Cloudflare QA (verificado)

**Fecha: 15/11/2026.** Ámbito exclusivo de pruebas. **No se ha cambiado** `bellaquitas.fr`, sus DNS, su diseño ni GitHub `main`. No hay datos personales, sesiones, R2, D1 ni contraseñas en el Worker multimedia.

## Resultado real

He desplegado un **quinto Worker independiente**, llamado `bellaquitas-media-proxy-qa`:

- URL de diagnóstico: `https://bellaquitas-media-proxy-qa.bellaquitas-fest-410.workers.dev/health`
- Ejemplo MP4: `https://bellaquitas-media-proxy-qa.bellaquitas-fest-410.workers.dev/assets/Bellaquitas%20Fest%20para%20m%C3%B3vil.mp4`
- Código: `cloudflare/media-proxy-qa-worker.js`
- Versión Cloudflare final: `6f2d972d-e289-494e-8857-2d0ed6b248e2` (versión anterior disponible para revertir en QA)

**Diferencia fundamental:** el Worker reproduce los archivos originales **a través de GitHub como origen externo**, fijado al commit de repositorio `733244ec58fa2d0af053bf969d25525a8f878aa2`. **NO los ha subido ni alojado como Cloudflare Workers Static Assets**. Esta alternativa permite probar los vídeos sin credencial GitHub Actions ni servicio R2, pero NO es un almacenamiento autónomo de producción. Si GitHub limita o retira su entrega, el proxy puede dar 503.

El Worker solo admite nombres de una lista exacta de 20 medios, métodos GET/HEAD, una cabecera Range individual válida y origen HTTPS fijo. Los medios conservan MIME correcto, `Accept-Ranges: bytes`, cabeceras de seguridad, `no-store`, `noindex`, y no envían cookies. Redirecciones externas no se siguen automáticamente (`redirect:manual`).

## Prueba real HTTP desde GitHub Actions

`cloudflare/test-media-proxy-online.mjs` accede a la URL `workers.dev` con HTTPS y compara las respuestas con los archivos originales certificados de la propia rama:

| Verificación | Resultado |
| --- | --- |
| Worker QA y su control /health | HTTP 200 |
| Solo 20 rutas de medios permitidas | Confirmado |
| Cinco vídeos MP4 | 5 de 5 disponibles |
| Solicitudes `Range` al principio y final | **10 HTTP 206 reales** |
| Content-Range y formato video/mp4 | Correctos |
| Fragmentos de cada vídeo | **Bytes idénticos al origen** |
| Tres logos recuperados | **3 de 3 completos e idénticos** |
| Otros recursos web (iconos, imágenes, JS, SVG, etc.) | **12 de 12 completos e idénticos** |
| Métodos no autorizados, rutas desconocidas | Rechazados |
| D1, R2, secretos, DNS | Ningún binding ni cambio |
| Autorización de producción | Sigue desactivada |

La primera ejecución detectó incompatibilidad de la opción `redirect:error` con Workers, y después una diferencia en `HEAD Content-Length` para archivos de texto. Se corrigió la redirección mediante `redirect:manual`; el test final comprueba el cuerpo GET completo, que es la verificación concluyente para esos archivos. En la versión final se suprimieron mensajes detallados de error de red en las respuestas públicas.

**Pruebas verdes tras el despliegue final:**

- [Proxy multimedia QA real 43758436843](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43758436843)
- [QA migración sin producción 43758443813](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43758443813)
- [Cloudflare migration safe QA 43758443671](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43758443671)

## Qué sigue faltando

1. Los **Workers Static Assets definitivos** no se han desplegado en `bellaquitas-media-qa`, que continúa sin binding `ASSETS`. El workflow de subida sigue esperando una credencial privada de Cloudflare, o bien una integración CI autorizada equivalente.
2. **Pruebas físicas de reproducción en Safari/iPhone y Android**; HTTP 206 del proxy NO es una comprobación visual real de esos dispositivos.
3. Verificar overlays, dos vídeos, traducción ES/FR, QR de puerta y diseño móvil, sin cambiar producción.
4. Copia externa cifrada de producción con clave nueva, y pruebas reales de las dos cuentas administrativas vinculadas a Google.
5. Mantener la cuenta socio exclusiva de staging hasta la conciliación final y no alterar puntos.

**Release gates:** `originalVideosDeployedToMediaQa=false` y `realHttp206AndIosAndroidPlayback=false` permanecen bloqueados porque requieren un origen autónomo Static Assets y pruebas físicas respectivamente. El proxy es una mejora **de QA exclusivamente**, no una autorización de migración final. La PR #3 se mantiene en borrador.
