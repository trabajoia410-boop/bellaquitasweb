# Bellaquitas Fest — seguimiento de migración a Cloudflare
**Actualizado:** 11 de noviembre de 2026.

## Completado y verificado
- [x] Cloudflare conectado a ChatGPT.
- [x] D1 privado `bellaquitas-staging` (jurisdicción UE).
- [x] Esquema de negocio, tabla de identidades y sesiones y migraciones SQL guardadas en GitHub.
- [x] Copia desde Supabase de 6 perfiles, 6 identidades Google, 2 movimientos, 3 cambios administrativos y 1 borrador; catálogo público copiado.
- [x] Comparación exacta de totales de perfiles, puntos (1.999.998), visitas (0), identidades y actividad.
- [x] API Worker `bellaquitas-api-staging` desplegada con bindings D1/R2.
- [x] GET /health verificado HTTP 200 con D1 y R2 conectados.
- [x] GET /v1/auth/me sin sesión verificado HTTP 200, authenticated=false.
- [x] Implementación de Google OAuth con PKCE SHA-256, nonce, estado de un solo uso, JWT RS256 verificado y cookie HttpOnly.
- [x] Rutas protegidas para socios, personal de puerta y administrador, con comprobaciones de rol exclusivamente en servidor.
- [x] Reglas D1 para una visita por socio y día, canjes atómicos y auditoría de cambios de socios.
- [x] Pruebas con cuentas ficticias de doble visita, canje y cambios de administrador; registros de pruebas borrados y totales reales sin cambios.
- [x] R2 privado `bellaquitas-media-staging`.
- [x] Los 3 logos originales copiados a R2; archivos verificados por tamaño y huella SHA-256 registrada.
- [x] Ruta R2 controlada `/v1/assets/logos/:file`, HTTP 200 image/png verificado.
- [x] URLs de logo reescritas SOLO en contenido publicado y borradores de D1 staging.
- [x] Worker de transferencia temporal eliminado, cron y subdominio desactivados.
- [x] Escrituras y registro de nuevas cuentas deshabilitados hasta pruebas de identidad.

## Bloqueos antes de cambiar la web real
- [x] Añadidos `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` como secretos de Cloudflare; callback autorizado en Google Cloud Console.
- [~] Inicio Google, perfil admin y sesión persistente comprobados por el usuario. Cierre de sesión autenticado confirmado mediante capturas del estado antes y después; quedan por probar otras cuentas y dispositivos.
- [~] Rutas y formularios email/contraseña habilitados SOLO en staging; Resend/Turnstile verificados y secretos enlazados. Falta registro real ficticio extremo a extremo, email entregado desde Worker, login/reset y QA móvil. Cuentas anteriores siguen usando Google.
- [ ] Activar y probar escrituras en staging usando perfiles de pruebas, nunca datos reales.
- [~] Añadida y desplegada la interfaz de pruebas del mismo origen en `/preview` con perfil, eventos, login y logout. Pendiente adaptar `app.js` completo y sesiones de primera parte bajo `bellaquitas.fr`.
- [ ] Preparar DNS Cloudflare y Workers Route `bellaquitas.fr/v1/*` sin afectar GitHub Pages hasta el corte.
- [~] QR personal, lector de cámara con jsQR local y consulta de puerta/admin de solo lectura desplegados en `/preview`. Pendientes pruebas reales en iPhone/Android y operaciones de escritura con perfiles ficticios, canjes y galerías.
- [ ] Preparar backup de producción y exportación diferencial final; repetir reconciliación de datos.
- [ ] Realizar cambio gradual y reversible de backend, dominio/OAuth, seguimiento y recuperación.
- [ ] Retirar Supabase solo cuando la web nueva esté 100 % verificada.

**Producción no modificada**: GitHub Pages, dominio y Supabase siguen operativos.

## Verificación adicional 10/11/2026
- Worker de pruebas desplegado con `/preview` y `/preview/app.js`, CSP y noindex.
- Navegador de Cloudflare: pantalla cargada, script ejecutado, visitante anónimo y eventos consultados correctamente.
- Los secretos OAuth y vínculos D1/R2 conservados después del despliegue.
- Consulta de solo lectura en D1: 6 perfiles, 1.999.998 puntos, 0 visitas; 0 cambios en la consulta.
- `STAGING_MUTATIONS=disabled` y `ALLOW_NEW_ACCOUNTS=no` se mantienen.
- El usuario compartió capturas de `/preview` con sesión autenticada (perfil y rol admin visibles) y, tras pulsar cerrar sesión, `Sesión cerrada correctamente` con botón `Continuar con Google`. Test manual de cierre de sesión completado para esa cuenta/navegador; no implica cobertura de otros roles o dispositivos.
- Cambios aislados en la rama `cloudflare-preview-login-20261110` y en el Worker **staging**.


## Fase adicional: QR y correo (10/11/2026)
- [x] `/preview` incluye QR de socio, pantalla ampliada, movimientos y consulta de puerta/admin.
- [x] Cámara en modo prueba con jsQR local para Safari/iPhone y lectura manual alternativa, sin llamadas al endpoint de registro de visitas.
- [x] Migración `0006-email-auth.sql` aplicada SOLO en D1 staging: credenciales 0, tokens 0; perfiles 6, puntos 1.999.998, visitas 0.
- [x] Código de rutas email creado (registro, confirmación, login, recuperación, reset), con PBKDF2/Turnstile/límites; acceso desactivado por defecto y formulario oculto.
- [x] Despliegue de nuevo Worker sin perder bindings ni secretos existentes.
- [x] Página de pruebas verificada mediante renderizado remoto: módulos QR/email presentes, eventos visibles y sesión anónima sin errores.
- [ ] Comprobar lectura QR real en iPhone/Samsung (requiere dispositivo físico).
- [~] Resend/Turnstile configurados; formularios email activados en staging con banderas independientes. Pendiente prueba de cuenta ficticia con correo real y cierre de sesión.
- [ ] Adaptar el `app.js` de producción y todas las funcionalidades al API Cloudflare.

**Importante:** estas pruebas no equivalen a una migración completa de la web real.

## Validación secretos de correo (11/11/2026)
- [x] `RESEND_API_KEY` y `EMAIL_RATE_KEY` guardados por el usuario y verificados en el Worker staging.
- [x] `TURNSTILE_SECRET` y claves Google conservadas; D1/R2 vinculados.
- [x] Estado HTTP real `/v1/auth/email/status`: `login=false`, `registration=false` (fail-closed).
- [x] Datos D1 sin cambios: 6 perfiles, 1.999.998 puntos y 0 visitas. Sin altas email.
- [ ] Envío y recepción de correo y alta ficticia de prueba, con protección anti-bot y monitorización; no activar altas públicas antes.

## Activación restringida de email, 11/11/2026
- [x] Resend tiene dominio verificado; Widget Turnstile autorizado para hostname staging.
- [x] Resend, Turnstile y clave de limitación de intentos permanecen en secretos Cloudflare.
- [x] `EMAIL_AUTH_ENABLED=yes`, `EMAIL_REGISTRATION_ENABLED=yes` habilitados únicamente en Worker staging.
- [x] `ALLOW_NEW_ACCOUNTS=no` mantiene cerradas nuevas identidades Google.
- [x] `STAGING_MUTATIONS=disabled`: visitas y puntos continúan bloqueados.
- [x] En navegador remoto: formularios de correo visibles, advertencia «solo pruebas» visible.
- [x] D1 comparada: 6 perfiles, 1.999.998 puntos, 0 visitas, cero credenciales email, cero tokens pendientes.
- [ ] Confirmar envío de email **desde el Worker** con buzón de prueba autorizado y verificar el resto del flujo de alta y recuperación.

## Corrección registro con correo, 11/11/2026
- [x] Diagnóstico de ausencia de correos: antes de llegar a Resend se bloquearon 10 intentos por cuotas consumidas antes de Turnstile.
- [x] Arreglados el orden de verificación CAPTCHA/cuotas y el mensaje de error situado debajo del botón correspondiente.
- [x] Reaplicados los cambios solo a Worker `bellaquitas-api-staging`.
- [x] Reiniciados exclusivamente contadores antispam de staging para permitir una nueva prueba.
- [x] D1 conservó 6 perfiles, 1.999.998 puntos, 0 visitas, 0 registros email tras el arreglo.
- [ ] Confirmar la entrega real del correo desde la página de pruebas, completar confirmación del enlace, login y recuperación.

## Depuración KDF y correo, 11/11/2026
- [x] Identificada la causa del error genérico del registro: Cloudflare limita PBKDF2 a 100.000 iteraciones por llamada; 600.000 devolvía NotSupportedError.
- [x] Implementado hash versionado por seis fases secuenciales de 100.000, validado con diagnóstico real en Worker; no confundir con PBKDF2 estándar de 600.000.
- [x] Confirmado almacenamiento de solicitud ficticia en D1 y limpieza posterior.
- [x] Diagnóstico temporal retirado del Worker y despliegue corregido solo en staging; totales reales intactos.
- [ ] Confirmar entrega de email real desde registro corregido y el ciclo completo; hacer auditoría independiente del KDF antes de producción.

## Email de confirmación entregado y cuenta verificada (11/11/2026)
- [x] Resend confirma entrega real del primer correo de registro enviado desde Worker staging.
- [x] D1 muestra 1 identidad por email con `verified_at>0`, perfil de rol `socio` y 0 puntos/visitas.
- [x] Se conservan las 6 cuentas migradas; nuevo total staging 7 perfiles, 1.999.998 puntos, 0 visitas.
- [ ] Probar contraseña, persistencia, logout y recuperación de la nueva cuenta.
- [ ] Revisar hashing versionado e integración completa antes de producción.

## Confirmación de acceso y recuperación, 11/11/2026
- [x] El usuario confirma haber probado el restablecimiento de contraseña; captura muestra el correo recibido.
- [x] Resend confirma entrega del mensaje «Recuperar acceso Bellaquitas Fest» desde la infraestructura de correo.
- [x] Captura de la pantalla de staging muestra la tarjeta QR del socio tras su inicio de sesión con correo.
- [x] D1 confirma 7 perfiles, 1 cuenta de correo verificada, 1.999.998 puntos y cero visitas; no hay enlaces de registro ni reset pendientes.
- [x] Corregida duplicación de «Todavía no hay movimientos» provocada por dos actualizaciones concurrentes de la interfaz; cambio desplegado solo en Worker staging.
- [ ] Validar lectura real de QR con cámara iPhone y Android y roles de puerta sin alterar visitas de socios reales.
- [ ] Auditoría de seguridad del KDF versionado y flujo completo, previa al corte de producción.

## Reparación lector QR móvil, 11/11/2026
- [x] Lector en staging mejorado con decodificación nativa y `jsQR`, mensajes de estado claros y consulta automática sin escrituras.
- [x] Lectura alternativa desde foto/captura local para QR mostrado en el mismo móvil.
- [x] Prueba sintética QR generado/decodificado correcta y controles de acceso conservados.
- [x] Despliegue controlado sin modificar totales: 7 perfiles, 1.999.998 puntos y 0 visitas.
- [ ] Verificación cámara real iPhone/Android, escaneando código `MBR-` desde otro dispositivo y confirmando coincidencia de socio.

## Confirmación del lector en móvil Android — 11/11/2026
- [x] Captura facilitada por usuario del móvil Android muestra «Código reconocido» y nombre/código del socio identificados correctamente mediante interfaz `/preview`.
- [x] Se mantiene aviso «Modo pruebas: registrar visitas está desactivado»; reconocimiento y consulta no equivalen a marcar asistencia.
- [x] Usuario confirmó expresamente que el QR fue reconocido **directamente con la cámara** en Android, no mediante foto/captura. El reconocimiento y la consulta del socio funcionaron sin registrar visita.
- [ ] Validar también Safari/iPhone y perfiles de puerta distintos de administrador, sin registrar visitas ni puntos reales.

## Fase 4 — pruebas con socios ficticios en D1 independiente, 11/11/2026
- [x] Se creó una base de datos D1 **temporal aislada** (sin importar cuentas ni puntos reales), se instalaron 16 tablas, índices y 5 triggers, y se borró tras probar.
- [x] Visita ficticia suma +10 puntos y +1 visita; segunda visita del mismo día bloqueada por índice único.
- [x] Canje descontó 30 puntos; sin saldo rechazado por trigger `Puntos insuficientes`.
- [x] Personal sin permisos no puede validar canjes; no se puede reabrir canje validado.
- [x] Usuario sin rol admin no puede modificar puntos; ajuste del admin pasó por tabla de auditoría.
- [x] Confirmado tras pruebas: solo queda la base D1 original `bellaquitas-staging`, con 7 perfiles, 1.999.998 puntos y 0 visitas.
- [ ] Prueba física de puerta que REGISTRE una visita en un entorno independiente, después de revisar seguridad; nunca con cuentas reales.

## Fase 5 — espejo visual original conectado a Cloudflare, 11/11/2026
- [x] Desplegado `/espejo/` en Worker staging, sirviendo el HTML/CSS/renderer originales de `bellaquitas.fr` y la misma ruta de vídeos y logos, sin recompresión.
- [x] Adaptador de **solo lectura** para eventos, premios, promociones, site_content, perfiles y sesión de Cloudflare; se han bloqueado las mutaciones.
- [x] Aislamiento: no se descargan credenciales de Supabase; CSP bloquea sus conexiones, noindex, sin service worker de staging.
- [x] Browser Rendering: título Bellaquitas Fest, navbar, portada, vídeo y enlaces, sin error de arranque.
- [x] Generador y lector QR entregados con mismo origen para CSP.
- [ ] Migración completa de las funcionalidades restantes (panel, edición visual, sugerencias, fotografías, subidas R2) y comparación visual exhaustiva móvil/escritorio.
- [ ] No migrar dominio ni retirar Supabase antes de completar toda la fase 5 y QA de fase 6.

## Fase 5 — Conexión del editor original y copia visual independiente (11/11/2026)
- [x] El espejo ya sirve una copia **fija de HTML, CSS, renderer, FR, QR/jsQR** desde el módulo `mirror-snapshot.js`; no consulta la web pública para esos archivos.
- [x] Misma estructura de diseño, dos vídeos, marquesina animada, menú, ES/FR y enlaces; validado render móvil de 390 px sin errores.
- [x] Catálogo completo de eventos/premios/promos, álbumes, fotos, sugerencias y borradores disponible mediante GET con roles en servidor.
- [x] Fotos públicas accesibles solo si su álbum está publicado; álbumes ocultos únicamente en admin; no se devuelve la ruta privada R2 al cliente.
- [x] Formulario original conectado por adaptador a rutas futuras para guardar eventos, premios, promociones, textos, borradores, imágenes y galerías.
- [x] Rutas de escritura protegidas por sesión de administrador, comprobación Origin y `STAGING_MUTATIONS=disabled` -> 423. Se probó rechazo por rol y por origen.
- [x] SQL ensayado en D1 **temporal aislada** para eventos con traducción FR, premios, promociones, editor, sugerencias y galería; prueba exitosa, DB eliminada.
- [x] Worker staging desplegado con 14 módulos; 7 perfiles, 1.999.998 puntos, 0 visitas intactos.
- [ ] Migrar MP4 e imágenes **binarios** a R2 verificando tamaños y hash, para eliminar la dependencia de `bellaquitas.fr` al cambiar dominio.
- [ ] Activar y probar CRUD real con **base de datos totalmente aislada**, incluyendo medios R2; staging actual sigue en solo lectura por seguridad.
- [ ] Integrar Turnstile para sugerencias públicas; unificar registro/reset Google/email con la interfaz definitiva.
- [ ] Auditoría independiente del esquema KDF, permisos y datos de migración antes de publicar.
- [ ] Comparación visual extensa de todas las páginas/idiomas y pruebas iPhone **más adelante**, como acordado.
- [ ] Corte de DNS y hosting con backup + rollback; **no ejecutar** sin completar los puntos anteriores.

## Fase 5 — Sugerencias del diseño original conectadas a Cloudflare (11/11/2026)
- [x] Nuevo endpoint `POST /v1/mirror/public/suggestions`, habilitado **solo en Worker staging** mediante `SUGGESTIONS_ENABLED=yes`.
- [x] `GET .../suggestions/status` responde `enabled=true` y la clave pública de Turnstile; no se publican secretos.
- [x] Interfaz `#/sugerencias` del HTML/renderer original conserva el formulario y muestra Turnstile; mensajes ES/FR.
- [x] Servidor valida `Origin`, longitud y tipo de datos, honeypot, Turnstile con hostname, HMAC-IP y cuota de 5 envíos/hora.
- [x] Prueba simulada: flag deshabilitado 423, Origin externo 403, CAPTCHA inválido 403, primeras 5 inserciones 201 y sexto envío 429.
- [x] D1 real pasó EXPLAIN de INSERT/SELECT, sin datos ficticios insertados; contador de sugerencias en staging sigue 0.
- [x] Se conservan `STAGING_MUTATIONS=disabled`, `ALLOW_NEW_ACCOUNTS=no`, seis identidades originales y una cuenta nueva de pruebas.
- [x] Comparados SHA Git de index.html, app.js, styles.css, locale-fr.js, logos y vídeos: rama y main idénticos; diseño no modificado.
- [x] Navegador de pruebas móvil 390px: navbar, botón hamburguesa, portada de vídeo y selector FR presentes, sin error de arranque.
- [ ] Probar un envío auténtico a Sugerencias con Turnstile y comprobar acceso desde admin.
- [ ] Auditoría integral, editor completo con cambios ficticios aislados, comparativas visuales desktop/Android; iPhone diferido.

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

## Fase 5 — verificación de integridad visual y permisos (11/11/2026)
- [x] Comparación Git exacta de las 6 fuentes del diseño entre `main` y la rama Cloudflare: `index.html`, `app.js`, `styles.css`, `locale-fr.js`, `assets/qr-local.js` y `assets/jsqr-local.js`; las 6 siguen idénticas.
- [x] Comparada además la copia fija `mirror-snapshot.js` con esos 6 archivos: coincidencia exacta, incluidos los 256.723 caracteres de la biblioteca jsQR y el CSS íntegro.
- [x] Fuentes de vídeo/logo clave permanecen byte a byte iguales en Git respecto a `main`.
- [x] Comprobación simulada de permisos sobre las rutas reales de administración: 11 casos; rechazados anónimo, socio, puerta, origen externo y estado sin escrituras. Lectura administrativa solo para admin; fotos públicas accesibles como lectura.
- [x] Añadido `cloudflare/test-mirror-regression.mjs` para ejecutar localmente estas garantías con Node.js, sin red ni datos reales.
- [x] Añadido `.github/workflows/cloudflare-migration-qa.yml` para ejecutar la prueba sin despliegue ni secretos al comprobar cambios de la rama; la ejecución automática debe confirmarse en GitHub.
- [ ] Ejecutar la suite CI y verificar resultado verde; por ahora la API de GitHub no devuelve ninguna ejecución.
- [ ] Auditoría del backend para producción, ensayos completos de CRUD real en D1/R2 aislados, comprobación visual en ordenadores/Android y prueba en iPhone pospuesta por el usuario.
- [ ] Mantener `bellaquitas.fr` en GitHub Pages + Supabase hasta completar estas verificaciones, plan de copias/rollback y aprobación final del cambio público.
