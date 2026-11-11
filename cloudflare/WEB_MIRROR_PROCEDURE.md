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
  `/espejo/bridge.js`. Las 17 imágenes y vídeos originales ya se sirven desde **R2 staging**, con tamaños y SHA1 Git verificados, sin recomprimir. El generador QR y jsQR ya se sirven desde el mismo origen del espejo utilizando la copia fija.
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
  leídos desde R2 con soporte de `Range` para Safari, sin transcodificar.
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
dependen de llamadas al dominio público. Los 17 ficheros de vídeo e imagen binaria ya están copiados a R2 staging
sin reducción ni transformación, con hashes de objeto versionados.
**No cambiar DNS ni dominio antes de completar la validación funcional y de seguridad.**

## Diferencias pendientes frente a la web definitiva

- La pantalla de registro, recuperación por email, Google OAuth y retorno a la
  ruta original del espejo necesitan unificar sus enlaces con la aplicación
  final; la pantalla `/preview` ya sirve de referencia funcional para ellos.
- El editor, los uploads y el control de puerta están **preparados**, pero
  permanecen deshabilitados por seguridad. Falta un entorno separado donde
  habilitarlos y ejecutar pruebas reales antes de pasar a producción.
- La sección Sugerencias ya está habilitada **solo en el espejo de staging** mediante
  `SUGGESTIONS_ENABLED=yes`, Turnstile, origen estricto y 5 mensajes por IP y hora.
  Pendiente prueba real de envío con desafío válido y revisión antispam antes de producción.
- Los 17 recursos originales ya se sirven desde R2 staging. Falta revisar las imágenes
  externas referenciadas en D1, ensayar recuperación y rollback, confirmar permisos
  de producción y auditar el KDF del login.
- La comparación de DOM del espejo y la web original en ancho móvil confirmó
  portada, menú hamburguesa, barra animada y ES/FR. Eso **no demuestra todavía
  paridad visual de todos los píxeles ni todos los dispositivos**.
  El iPhone se probará más adelante a petición del usuario.

## Nueva integración de Sugerencias — 11/11/2026

- Formulario original `#/sugerencias`, sin rediseño; añadido exclusivamente un widget Turnstile
  necesario para el envío. Funciona en ES/FR con mensaje de resultado.
- Backend público `/v1/mirror/public/suggestions` y estado separado
  `/v1/mirror/public/suggestions/status`.
- Protección en servidor: `Origin` exacto, token Turnstile validado con hostname,
  control de tamaño, mensaje entre 5 y 2.000 caracteres, nombre opcional de hasta
  80 caracteres, honeypot y HMAC-IP con máximo de 5 sugerencias/hora.
- Pruebas simuladas: sin flag HTTP 423, origen externo 403, CAPTCHA inválido 403,
  primera inserción ficticia 201, sexta solicitud 429. Los inserts fueron con DB
  simulada, **no se crearon sugerencias ficticias en D1 staging**.
- D1 real validó por `EXPLAIN` las consultas SQL, sin modificar datos.
- Worker staging actualizado con `SUGGESTIONS_ENABLED=yes`; `STAGING_MUTATIONS=disabled`
  mantiene bloqueados puntos, visitas, editor, permisos y canjes.
- Browser Rendering confirma formulario y contenedor de Turnstile en el espejo móvil;
  el endpoint de estado responde `enabled=true` con clave pública del widget.
- **Pendiente**: una prueba end-to-end con Turnstile resuelto por una persona, para confirmar
  que la sugerencia llega al panel de administración. No afirmar todavía éxito real.

## Pruebas reales de API en entorno efímero (11/11/2026)

- Se crearon exclusivamente para esta prueba:
  - Worker efímero `bellaquitas-qa-phase5-20261111-b1d4` con
    `STAGING_MUTATIONS=enabled` **solo en este Worker de QA**.
  - Base de datos D1 `bellaquitas-qa-phase5-20261111-b1d4` con
    migraciones 0001–0003 y cuatro perfiles ficticios, sesiones inventadas
    sin usuarios reales, una recompensa y portada ficticia.
  - Bucket R2 efímero `bellaquitas-qa-phase5-20261111-b1d4`.
- El Worker principal `bellaquitas-api-staging` siguió en
  `STAGING_MUTATIONS=disabled` durante toda la prueba.
- Prueba real de HTTP/rutas del backend sobre D1/R2 independientes:
  **25/25 comprobaciones superadas**:
  1. Admin autenticado con cookie falsa válida en D1 QA (200).
  2. Datos de catálogo privado bloqueados a anónimos (401).
  3. Catálogo privado bloqueado a socio (403).
  4. Visita rechazada para socio sin rol de puerta (403).
  5. Primer registro de visita por puerta (200, +10 puntos).
  6. Visita repetida el mismo día rechazada (409).
  7. Balance correcto: 110 puntos, 1 visita.
  8. Canje sin fondos rechazado (409).
  9. Canje con saldo admitido (200).
  10. Validación de canje rechazada a usuario no autorizado (403).
  11. Validación por puerta admitida (200).
  12. Validación duplicada de canje rechazada (404).
  13. Balance tras canje: 80 puntos, 1 visita.
  14. Cambio de puntos por personal sin rol admin rechazado (403).
  15. Cambio de puntos por admin auditado (200).
  16. Registro de auditoría creado correctamente (1 entrada).
  17. Alta de evento ficticio desde el backend del editor (200).
  18. Lectura del catálogo completo para admin (200).
  19. Traducción francesa del evento preservada.
  20. Guardado de borrador de editor (200).
  21. Publicación del editor (200).
  22. Textos publicados reflejados en D1 QA.
  23. Subida PNG ficticia a R2 QA (200).
  24. Lectura de PNG desde R2 QA (67 bytes, 200).
  25. Eliminación de la imagen desde R2 QA (200).
- Al terminar se eliminaron **con éxito** el Worker QA, el bucket R2 QA y
  la base D1 QA. No quedaron recursos temporales.
- Comprobación post-limpieza de la base staging: **7 perfiles,
  1.999.998 puntos, 0 visitas y 0 sugerencias**. Únicamente permanece
  `bellaquitas-staging` en D1 y `bellaquitas-media-staging` en R2.
- Banderas verificadas en el Worker staging:
  `STAGING_MUTATIONS=disabled`, `ALLOW_NEW_ACCOUNTS=no`,
  `SUGGESTIONS_ENABLED=yes` (esta última afecta solo a las sugerencias
  en el espejo de pruebas).
- Estas comprobaciones verifican los endpoints del backend, **no**
  completan la revisión del KDF, UX en iPhone, circuito de edición visual
  end-to-end desde navegador ni el plan de rollback al dominio público.
