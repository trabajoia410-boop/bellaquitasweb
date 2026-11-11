# Bellaquitas Fest — fase 5: migración sin alterar la apariencia
Actualizado: 11 de noviembre de 2026.

## Condición imprescindible

**El usuario exige conservar el diseño actual al migrar de Supabase a Cloudflare.**
No se permite rediseñar portada, menús, logo, tipografía, colores, vídeos,
animaciones, CSS, disposición móvil, traducciones ni navegación durante el cambio
de backend. La comparación visual se hace sobre la web pública actual.

## Primer resultado desplegado (solo staging)

- URL del espejo: `https://bellaquitas-api-staging.bellaquitas-fest-410.workers.dev/espejo/`
- `cloudflare/web-mirror.js` sirve el HTML, CSS, traducciones y `app.js`
  actuales desde `https://bellaquitas.fr`. El renderer principal, los
  elementos de navegación, los nombres de vídeos y las animaciones se mantienen.
- Se cambian **solo** el arranque de Supabase y la carga del adaptador a
  `/espejo/bridge.js`. Las imágenes y los MP4 se siguen sirviendo desde
  los archivos originales, sin recomprimir; la generación QR y jsQR se
  sirven desde el mismo origen del espejo para satisfacer CSP.
- `cloudflare/web-mirror-bridge.js` traduce lecturas hacia Cloudflare D1
  (`/v1/events`, `/v1/rewards`, `/v1/promos`, `/v1/site`, etc.) y
  recupera la identidad desde `/v1/auth/me`.
- No se envía una clave anónima ni configuración del cliente Supabase.
  El CSP también impide conectar con `*.supabase.co`.
- **MODO SOLO LECTURA:** cambios de editor, socios, puntos, visitas, canjes,
  fotografías y sugerencias están bloqueados en el espejo.
  Google login puede regresar al panel de pruebas `/preview`.
  Las páginas completas de cuenta/editor todavía NO están migradas.
- `/espejo/sw.js` está bloqueado para no instalar cachés de pruebas en
  el dispositivo. Se añade una pequeña marca fija «PRUEBAS · SOLO LECTURA»
  para evitar confundir esta copia con el sitio público.
- Header de robots `noindex,nofollow` y configuración de seguridad original
  adaptada al origen de pruebas. El dominio público no se modifica.

## Comprobaciones técnicas realizadas

- Simulación de `mirrorRoute`: mismo CSS y mismo fichero de traducción;
  `app.js` conserva el renderer original y elimina su import de Supabase,
  sustituyéndolo por el adaptador de pruebas.
- Prueba aislada del adaptador: los eventos y premios de Cloudflare se
  marcan como activos y se muestran en el renderer; site_content
  procede de D1; peticiones de escritura devuelven error de modo prueba.
- Browser Rendering remoto de `/espejo/`: documento completo, título
  Bellaquitas Fest, clase `bf-neon`, navbar, vídeo de portada, enlaces de
  Eventos, y sin error de inicio de sesión.
- CSP: QR y jsQR servidos como JavaScript de primera parte; MP4 originales
  redirigidos al dominio público sin transcodificar.
- Se conservan `ALLOW_NEW_ACCOUNTS=no` y
  `STAGING_MUTATIONS=disabled`, sin escrituras en los datos de fidelidad.
- Base D1 staging: 7 perfiles, 1.999.998 puntos, 0 visitas.
  Al finalizar los tests solo permanece `bellaquitas-staging` (base QA
  temporal eliminada).

## Todavía no se debe publicar

1. Comparación visual a 390 px, 768 px y 1440 px, con navegación completa
   y contenido ES/FR, incluyendo vídeos, iPhone cuando el usuario lo decida
   y Android. Corregir **solo** diferencias de migración.
2. Implementar y probar las rutas de lectura faltantes (album y fotos,
   historial administración, sugerencias, redenciones, borradores).
3. Migrar flujos de escritura del editor (subir medios R2, actualizar textos,
   publicar eventos y álbumes), con permisos en servidor y tests ficticios.
4. Auditar contraseñas/recuperación, sesiones de primera parte en dominio
   definitivo y callback de Google dirigido a la interfaz real.
5. Verificar QR físico en iPhone más adelante, como acordado, y pruebas de
   puerta/canjes reales solamente con perfiles ficticios aislados.
6. Preparar backups y reconciliación final D1/R2, rollback y un cambio de
   backend reversible, **sin rediseñar ninguna página**.

**Producción:** `bellaquitas.fr` continúa en GitHub Pages + Supabase hasta
completar las verificaciones. La rama Cloudflare sigue sin fusionarse.
