# Bellaquitas Fest — fase 5: migración sin alterar la apariencia
Actualizado: 11 de noviembre de 2026.

## Condición imprescindible

**El usuario exige conservar el diseño actual al migrar de Supabase a Cloudflare.**
No se permite rediseñar portada, menús, logo, tipografía, colores, vídeos,
animaciones, CSS, disposición móvil, traducciones ni navegación durante el cambio
de backend. La comparación visual se hace sobre la web pública actual.

## Primer resultado desplegado (solo staging)

- URL del espejo: `https://bellaquitas-api-staging.bellaquitas-fest-410.workers.dev/espejo/`
- `cloudflare/web-mirror.js` sirve el HTML, CSS, traducciones, `app.js` y librerías QR
  **congelados** en `cloudflare/mirror-snapshot.js` desde los archivos visuales originales. No depende del dominio público para consultar estos archivos. El renderer principal, los
  elementos de navegación, los nombres de vídeos y las animaciones se mantienen.
- Se cambian **solo** el arranque de Supabase y la carga del adaptador a
  `/espejo/bridge.js`. Las imágenes y los MP4 aún se obtienen desde el dominio público original, **sin recomprimir**, hasta completar la copia R2. El generador QR y jsQR ya se sirven desde el mismo origen del espejo utilizando la copia fija.
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

## Avance del 11/11/2026 — lectura y edición preparadas

- Añadida `cloudflare/mirror-data-routes.js`, con GET de álbumes, fotos públicas y
  privadas, sugerencias, borradores, catálogo completo (incluidos borradores),
  movimientos, auditoría y canjes según permisos de socio/puerta/admin.
- Control de acceso probado con actores simulados: anónimo 401, socio no autorizado
  403 y administrador 200; fotografías privadas sin filtrar rutas internas de R2.
- Añadida `cloudflare/mirror-write-routes.js` con rutas tipadas para editor,
  eventos, premios, promociones, estados de sugerencias, borrado de álbumes,
  subida de imágenes y borrado seguro de medios. Son **rutas preparadas, no
  habilitadas**: todas devuelven HTTP 423 en staging por `STAGING_MUTATIONS=disabled`.
- El adaptador del renderer original `web-mirror-bridge.js` ya dirige los
  formularios y RPC originales a estas rutas, conservando la interfaz. Pruebas
  simuladas comprobaron que los intentos de escritura no aparentan éxito.
- Prueba D1 separada: crear/editar un evento y su traducción francesa,
  crear un premio y una promoción, guardar/publicar ajustes del editor, actualizar
  sugerencias y borrar una galería ficticia en cascada. **La base D1 temporal
  fue eliminada** después. No se tocaron las siete cuentas de pruebas.
- Estado de D1 staging verificado: 7 perfiles, 1.999.998 puntos, 0 visitas,
  una cuenta por correo verificada; únicamente existe la base
  `bellaquitas-staging`.

## Copia fija de diseño original

`cloudflare/mirror-snapshot.js` contiene exactamente estos ficheros
del repositorio de diseño, en esta versión de la migración:

| Archivo | Bytes/Caracteres de origen |
|---|---:|
| `index.html` | 16.750 |
| `app.js` | 177.758 |
| `styles.css` | 138.290 |
| `locale-fr.js` | 48.909 |
| `assets/qr-local.js` | 30.260 |
| `assets/jsqr-local.js` | 256.723 |

Los archivos quedan congelados en el módulo del Worker de pruebas y no
dependen de llamadas al dominio público. Los MP4 e imágenes binarias
siguen pendientes de copia exacta a R2, sin reducción ni transformación.
**No se debe cambiar DNS ni dominio antes de cerrar esta dependencia.**

## Diferencias pendientes frente a la web definitiva

- La pantalla de registro, recuperación por email, Google OAuth y retorno a la
  ruta original del espejo necesitan unificar sus enlaces con la aplicación
  final; la pantalla `/preview` ya sirve de referencia funcional para ellos.
- El editor, los uploads y el control de puerta están **preparados**, pero
  permanecen deshabilitados por seguridad. Falta un entorno separado donde
  habilitarlos y ejecutar pruebas reales antes de pasar a producción.
- La sección Sugerencias está en modo de solo lectura para el envío: necesita
  protección anti-spam/Turnstile y límites antes de habilitarlo públicamente.
- Falta copiar y verificar imágenes/vídeos en R2, probar imágenes externas ya
  referenciadas en D1, ensayar recuperación y rollback, confirmar permisos
  de producción y auditar el KDF del login.
- La comparación de DOM del espejo y la web original en ancho móvil confirmó
  portada, menú hamburguesa, barra animada y ES/FR. Eso **no demuestra todavía
  paridad visual de todos los píxeles ni todos los dispositivos**.
  El iPhone se probará más adelante a petición del usuario.
