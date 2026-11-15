# Bellaquitas Fest — comprobación visual ES/FR con WebKit iPhone y Chromium Android

**Fecha:** 15/11/2026. **Entorno:** `https://bellaquitas-api-staging.bellaquitas-fest-410.workers.dev/espejo/`. **Cuenta anónima, sin login y sin escrituras.** La web pública `bellaquitas.fr` continúa intacta.

## Pruebas de navegador realmente ejecutadas

Se añadió `cloudflare/test-mobile-mirror-browser.mjs` y el workflow aislado `.github/workflows/qa-mobile-mirror-browser.yml`, con Playwright WebKit y Chromium, que visitan **el espejo público de staging** y guardan capturas de pantalla sin datos personales. No se accede a cuentas, puntos ni visitas reales.

| Verificación | WebKit simulando iPhone 13 | Chromium simulando Pixel 7 | Chromium escritorio |
| --- | --- | --- | --- |
| Anchura del viewport | 390 px | 412 px | 1440 px |
| Anchura del documento | 390 px | 412 px | 1440 px |
| Desbordamiento horizontal | **0 px** | **0 px** | **0 px** |
| Menú de tres barras visible | Sí | Sí | Sí |
| Menú cerrado al entrar | Sí | Sí | Sí |
| Alternar ES → FR | **Funciona** | **Funciona** | **Funciona** |
| Portada móvil/escritorio | Móvil | Móvil | Escritorio |
| Vídeo de portada `autoplay/muted/loop/playsinline` | Sí | Sí | Sí |
| Segundo vídeo bajo la franja amarilla | **MP4 móvil correcto** | **MP4 móvil correcto** | **MP4 escritorio correcto** |
| Estado de segundo vídeo tras scroll | `readyState = 4` | `readyState = 4` | `readyState = 4` |
| Solicitudes POST inesperadas | 0 | 0 | 0 |
| Capturas anónimas ES/FR | 2 | 2 | 2 |

La zona bajo la banda amarilla **se comprueba después de desplazarse a ella**, no solo mediante análisis estático del HTML. El navegador confirmó que el MP4 seleccionado es el correcto según dispositivo y que los datos necesarios para reproducirlo ya estaban cargados (`readyState=4`).

### Evidencias de GitHub Actions

- **[Prueba visual completa 43762575915 — éxito](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43762575915)**.
- **[Seis capturas ES y FR (artefacto)](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43762575915/artifacts/14181077429)** (conservadas durante siete días por GitHub).
- La prueba de red **[43761438589 — éxito](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43761438589)** verifica HTML/CSS/JS, traducción FR, **10 peticiones HTTP 206** para cinco MP4 y tres imágenes de marca idénticas en bytes a Git.

El primer intento extendido del navegador encontró un error **en el propio script de auditoría** (una constante llamada `URL` ocultaba el constructor global `URL`), no en el sitio; se corrigió y se obtuvo una ejecución completamente verde.

## Límites y siguiente fase

Este ensayo **no reproduce un iPhone ni Android físicos**. Playwright WebKit se aproxima al motor de Safari y la emulación de Pixel reproduce Chromium móvil, pero no confirma la cámara, el hardware de vídeo, la red móvil ni todos los comportamientos de Safari iOS real.

El test de idioma verifica que el selector ES→FR cambia el idioma del documento; **no garantiza por sí solo la traducción de todos los formularios, páginas, textos administrables y mensajes**.

El streaming procede todavía del proxy temporal de GitHub a través del Service Binding de Cloudflare. Los 20 originales siguen sin migrar a Workers Static Assets de forma autónoma.

Por tanto, permanecen **bloqueados** los controles `finalEsFrMobileVisualParity` y `realHttp206AndIosAndroidPlayback` hasta revisión completa y pruebas físicas. También siguen pendientes backup cifrado externo real de producción, dos administradores reales, QR de puerta y reconciliación final. **No se autoriza el cambio de dominio.**

**Estado de lanzamiento:** 16 controles; 8 aprobados y 8 pendientes. `main`, DNS, `bellaquitas.fr`, usuarios, puntos y visitas sin modificar.
