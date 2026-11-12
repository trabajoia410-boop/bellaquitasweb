# Bellaquitas Fest — conservar GitHub Pages y MP4; migrar solo funciones al backend

**Fecha:** 12/11/2026 · **Estado:** alternativa técnica evaluada, NO desplegada, DNS intactos.

## Descubrimiento: entrega original ya compatible con Safari

Se ejecutó una prueba **GET pública de solo lectura** con `Range: bytes=0-1023` a los cinco vídeos originales bajo `https://bellaquitas.fr/assets/`. Se compararon los primeros 1024 bytes de cada respuesta con los archivos exactos del repositorio GitHub.

**Resultado: 5/5 APROBADO.** Todos devolvieron `206 Partial Content`, `Content-Range` correcto, MIME `video/mp4`, `Content-Length: 1024` y bytes idénticos a los originales. Ninguna prueba alteró vídeos, HTML, usuarios o DNS.

Evidencia: https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43257146762

## Por qué NO conviene mover los vídeos originales a Workers Static Assets sin más

Cloudflare Workers Static Assets permite archivos estáticos de forma gratuita e ilimitada, y los 17 originales de Bellaquitas caben en su límite de 25 MiB por archivo. Sin embargo, la entrega estática directa devuelve **200 completo en lugar de 206 para un encabezado Range**, lo cual puede impedir el vídeo en Safari.

Se implementó el **candidato sin desplegar** `cloudflare/qa-candidates/static-mp4-range.js`, que consume `env.ASSETS.fetch()` y construye respuesta HTTP `206` mediante streaming; no recompone, recorta ni altera los vídeos. Sus 12 pruebas pasaron con datos binarios de los cinco MP4 originales, incluidos rangos iniciales, intermedios, finales, 416 y HEAD.

Evidencia: https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43256800513

**Pero el ensayo Node/Linux mostró CPU que supera 10 ms en varias lecturas:**

- Archivo portada de 24,26 MiB, petición de los últimos 512 bytes: unos **45 ms CPU**.
- El mismo archivo en rango abierto desde cero (25.437.525 bytes): unos **97 ms CPU**.
- Las cifras no representan el runtime real de Cloudflare, pero **no respaldan el cumplimiento del límite Workers Free de 10 ms CPU/petición**.

No activar `STATIC_MP4_RANGE_ENABLED=yes`, no agregar `run_worker_first` al dominio y no dar el candidato por compatible con Free. Es un experimento reproducible, no solución aprobada.

## Opción híbrida que conserva el diseño y los vídeos actuales

**Objetivo de arquitectura:** mantener el sitio público de **GitHub Pages** y sus cinco MP4 exactos, y pasar las APIs privadas a **Cloudflare Workers + D1** mediante rutas del mismo dominio.

### Arquitectura propuesta

| Tráfico | Alojamiento propuesto | Impacto visual |
|---|---|---|
| `/`, HTML, CSS, JavaScript, idiomas, logotipos, favicon | GitHub Pages original | Ninguno |
| `/assets/*.mp4` y demás recursos originales | GitHub Pages original | Ninguno; conservar HTTP 206 |
| `/v1/*`: auth, eventos, fidelidad, QR y puerta | Cloudflare Worker Free con D1 | Sin cambios de diseño |
| `/administracion/*`: panel privado nuevo en pestaña independiente | Cloudflare Worker, cookie propia y login email/contraseña tras revisión | Solo pestaña admin nueva |
| Momentos: subir imágenes dinámicas | **Pendiente alternativa de almacenamiento con bloqueo real de facturación** | Sin publicar hasta resolver |

El código del navegador que llama a Supabase deberá cambiar sus conexiones por la **API Cloudflare bajo el mismo origen**, manteniendo intactos HTML, CSS, comportamiento ES/FR, vídeos, logotipo y diseño. El espejo de pruebas ya ha validado esa sustitución a nivel funcional; debe volverse a probar en el esquema final.

### Requisito DNS inevitable de la opción híbrida

La documentación de Cloudflare exige para **Workers Routes** una **zona activa** en Cloudflare y un registro DNS **proxied** para el dominio correspondiente. Las rutas del Worker pueden cubrir solamente `bellaquitas.fr/v1/*` y `bellaquitas.fr/administracion/*`, dejando los demás caminos hacia el servidor GitHub Pages.

**Comprobación de solo lectura de la cuenta Cloudflare conectada, 12/11/2026:** no aparece ninguna zona llamada `bellaquitas.fr` (lista de zonas por nombre: 0). Por tanto, el requisito de ruta de mismo origen **aún NO está resuelto**.

El dominio sigue comprado en **Hostinger**. Una futura migración de DNS hacia Cloudflare Free requeriría inventariar y preservar todos los registros actuales (A/AAAA/CNAME, TXT Search Console, MX/SPF/DKIM si los hay), certificados y redirecciones. **NO se han cambiado servidores DNS ni registros, ni se ha añadido una zona de Cloudflare.** El cambio tendría que estar contemplado en el ensayo de reversión y ser expresamente autorizado.

Riesgo adicional: incluso manteniendo la ruta estática en GitHub Pages, pasar por proxy Cloudflare puede cambiar cabeceras, certificados y tratamiento de bytes. Se deberá volver a comprobar **206 y hashes de todos los MP4** desde el dominio oficial antes de confirmar el corte. Si falla la prueba, no continuar.

### Por qué esta opción es preferible para estudiar el presupuesto cero

- Los medios estáticos no requerirían operaciones ni almacenamiento **R2**, ni CPU de Worker para rangos MP4.
- Los API sí consumirían cuota Free de Workers; si se excede el plan gratuito se pueden recibir 429, no se garantiza disponibilidad ilimitada.
- **La galería dinámica Moments sigue siendo un bloqueo**: no basta con mover vídeos estáticos para eliminar el riesgo de excedentes de R2.
- La autenticación con correo y contraseña sigue bloqueada por coste de hash; hay que resolverla de manera segura y sin cuotas antes del corte.
- Mantener el GitHub Pages original reduce diferencias visuales, pero **no elimina** pruebas de autenticación, backups, sesiones ni restauración.

## Qué se ha hecho realmente y qué no

- **HECHO:** auditoría de 17 archivos originales (5 vídeos), prueba 206 del dominio público (5/5), streaming Range experimental (12/12), documentación de ruta híbrida.
- **NO HECHO:** cambio de DNS, activación de zona Cloudflare, publicación de rutas en bellaquitas.fr, migración real de socios, contratación de servicios, sustitución del origen de vídeos, comprobación física iPhone/Samsung ni autorización de fase 6.

## Requisitos para autorizar fase 6

1. Copia **real y privada** de Supabase Postgres/Auth/Storage, D1/R2 y restauración aislada completa, no solo ensayos ficticios.
2. Login email+password y Google seguro que cumpla las condiciones del plan gratuito sin pagos automáticos.
3. Resolver almacenamiento de fotos Moments sin cargos involuntarios.
4. Inventario DNS, plan de rutas Cloudflare, prueba de mismo origen y reversión sin pérdida de puntos o visitas.
5. Última conciliación de socios, saldos, QR, eventos e idiomas; autorización específica para el corte.
6. Pruebas físicas en iPhone y Samsung **después de publicar**, como solicitó el propietario.

## Documentación oficial

- [Cloudflare Workers — Static Assets, Range y facturación](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)
- [Cloudflare Workers — Routes, requisitos DNS y zona](https://developers.cloudflare.com/workers/configuration/routing/routes/)
- [GitHub Pages — dominio personalizado](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)
- [Cloudflare Workers — límites del plan Free](https://developers.cloudflare.com/workers/platform/limits/)

**Se mantiene la web pública EXACTAMENTE como está. Este documento no es una instrucción de desplegar.**
