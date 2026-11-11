# Bellaquitas Fest — fase 5: auditoría sin cambios en producción

**Fecha:** 11 de noviembre de 2026  
**Estado:** reconciliación de datos aprobada; pruebas funcionales completas aún pendientes.  
**Entornos:** Supabase `Bellaquitas Fest` (origen, consultas SELECT) y Cloudflare D1 `bellaquitas-staging` (destino, solo lectura).  

## 1. Reconciliación de datos

| Métrica | Supabase | D1 staging | Resultado |
|---|---:|---:|---|
| Perfiles | 6 | 7 | 6 perfiles originales coinciden; 1 cuenta de correo nueva solo en staging |
| Identidades Google | 6 | 6 | Coinciden en cantidad |
| Identidades de correo | No aplicable | 1 | Cuenta nueva de pruebas |
| Movimientos de actividad | 2 | 2 | Coinciden en cantidad |
| Historial administrativo | 3 | 3 | Coinciden en cantidad |
| Eventos | 1 | 1 | Coincide el contenido y la traducción |
| Premios | 0 | 0 | Coinciden |
| Contenido publicado | 1 | 1 | Igual salvo URL del logo |
| Borrador web | 1 | 1 | Igual salvo URL del logo |
| Puntos actuales totales | 1.999.998 | 1.999.998 | Coinciden |
| Visitas totales | 0 | 0 | Coinciden |

Se compararon directamente los **IDs de los seis perfiles originales** y los campos: `name`, `role`, `member_code`, `points`, `lifetime_points` y `visits`. **Cero diferencias**. D1 contiene un séptimo perfil con identidad de correo, rol socio, cero puntos y cero visitas, que **no se ha borrado**. Ningún perfil carece de identidad asociada.

En `site_content` y `site_drafts` se verificó la igualdad del JSON normalizado sustituyendo **exclusivamente** la URL de `logo_url`: origen Supabase Storage → `/v1/assets/logos/...` en R2. No hay diferencias adicionales en esa configuración.

## 2. Integridad visual del espejo

Se compararon tamaños y huellas de comprobación (FNV-1a, no criptográficas) del snapshot desplegado en el Worker con la rama `main` de GitHub. Coinciden los seis archivos:

- `index.html`
- `app.js`
- `styles.css`
- `locale-fr.js`
- `assets/qr-local.js`
- `assets/jsqr-local.js`

Esto respalda que el espejo conserva los archivos del diseño original; **no equivale a una prueba visual en iPhone/Android/desktop**.

**Importante:** El Worker de staging desplegado incluye módulos de registro por correo, sugerencias, espejo y edición que aún no figuran como fuentes individuales en `cloudflare/` de `main`. No redesplegar desde ese árbol incompleto sin guardar previamente las fuentes vigentes del Worker.

## 3. Permisos y seguridad

- Supabase: las 12 tablas de `public` listadas por el conector tienen RLS habilitado.
- Funciones SQL `SECURITY DEFINER` examinadas: `is_admin`, `is_staff`, `admin_update_member`, `register_visit`, `request_redemption`, `validate_redemption` y `update_display_name`. Incluyen comprobaciones de `auth.uid()` y permisos o propiedad según la operación. El asesor de Supabase advierte igualmente que 7 funciones privilegiadas son ejecutables por usuarios autenticados; requiere revisión antes de la retirada definitiva de Supabase.
- Aviso adicional de Supabase: protección de contraseñas filtradas deshabilitada. Referencia: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- D1: índice único `idx_activity_one_visit_per_day` evita duplicar visitas diarias; triggers de canjes y ajustes administrativos presentes y revisados en solo lectura.
- En Worker: la ruta de edición del espejo exige sesión, rol `admin`, origen autorizado y `STAGING_MUTATIONS=enabled`. La configuración actual tiene `STAGING_MUTATIONS=disabled`.
- **Matiz de registro:** `ALLOW_NEW_ACCOUNTS=no` bloquea la creación de nuevas identidades **Google**, pero **no** todas las altas: el módulo de correo se rige por `EMAIL_REGISTRATION_ENABLED=yes` y actualmente existe una cuenta de correo de staging.
- Hay sesiones D1 activas, pero **no** se han inspeccionado tokens, contraseñas ni datos secretos, ni se ha validado una sesión real con navegador en esta auditoría.

## 4. Pruebas de API y limitaciones

- `GET /health`: respuesta `status=ok`, `database=connected`, `storage=configured`, comprobada por Browser Rendering.
- `GET /v1/events`: devuelve un evento en staging.
- Peticiones posteriores de Browser Rendering: **HTTP 429 por límite de la herramienta**, de modo que `/v1/site`, `/v1/auth/me` y el acceso a `/v1/admin/members` no se validaron en HTTP durante esta ejecución.
- La lectura de código y esquemas **no equivale** a probar Google OAuth, sesión persistente en Safari, recuperación y registro de correo de extremo a extremo, cámara QR ni permisos con usuarios de distintos roles.
- Sin pruebas destructivas: no se hicieron INSERT/UPDATE/DELETE de datos de negocio. No se cambiaron DNS, despliegue público, puntos, visitas ni cuentas existentes.

## 5. Para completar la fase 5 antes del corte

1. Guardar y versionar la fuente **actualmente desplegada** del Worker de staging, especialmente módulos de correo y espejo.
2. Ejecutar pruebas HTTP de todas las rutas públicas y negativas de acceso sin sesión cuando se libere el límite 429.
3. Probar las tres clases de roles en staging con cuentas de pruebas, incluidos formularios administrativos, sin alterar datos reales.
4. Probar email (registro, confirmación, login, recuperación) y Google con sesiones persistentes y cierre de sesión en navegador de prueba.
5. Probar QR en iPhone y Android con perfiles ficticios y restaurar/limpiar sus registros.
6. Comparar visualmente la página desplegada con la versión pública en móvil y ordenador, incluidas las secciones de vídeo.
7. Preparar un backup verificable y una última sincronización diferencial desde Supabase; verificar también los objetos R2.
8. Solo después, planificar el cambio reversible de backend y dominio, conservando Supabase como respaldo.

**Decisión de seguridad:** no cambiar el dominio, la web pública ni los datos de producción mientras estas comprobaciones sigan pendientes.


## 6. Verificación automatizada posterior (11 de noviembre)

### 28 comprobaciones de API — APROBADAS

GitHub Actions ejecutó **28 de 28 comprobaciones** sin usar cookies, contraseñas ni datos reales:
- Salud de D1/R2 y lectura de eventos, premios, promociones, galería, fotos y contenido.
- Estado público de correo y `/v1/auth/me` sin sesión.
- Denegación HTTP 401 para rutas privadas de socio, puerta, administrador, borradores y cambios editoriales.
- Denegación HTTP 401 para solicitudes POST sin sesión a puerta, cambios de socios, canjes y editor.
- Ruta de perfil no publicada, CORS permitido solo para origen autorizado.
- Espejo visual `/espejo/` accesible con CSS, traducción francesa y logo de R2.

Evidencia: https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/42945687797

### Cinco vídeos originales + streaming Safari — APROBADOS a nivel HTTP

Se verificaron mediante HEAD los tamaños originales de los cinco vídeos MP4 en R2 (manifest `SITE_MEDIA`), su MIME y `Accept-Ranges: bytes`. Un GET limitado a **64 bytes** devolvió correctamente `HTTP 206 Partial Content`, `Content-Range` y `Content-Length: 64`.

Evidencia: https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/42946915076

Esto **no prueba reproducción real en Safari/iPhone**, pero valida el requisito de streaming parcial.

### Capturas escritorio y móvil — TOMADAS, pero revisión iPhone pendiente

Se guardaron cuatro capturas desde Google Chrome headless (web real y espejo, escritorio y ancho móvil): https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/42946391704

- En escritorio, cabecera (1440×82) y zona central seleccionada coinciden visualmente sin diferencias de píxeles; el espejo añade exclusivamente una insignia «PRUEBAS · SOLO LECTURA» en la esquina inferior derecha dentro de la captura.
- En móvil, la cabecera y la distribución se mantienen, pero las capturas muestran **distintos estados temporales de carga del vídeo** (página real oscura, espejo con imagen borrosa/cargador). No se interpreta como una prueba de igualdad completa ni como fallo definitivo del vídeo.
- No se ha probado Safari real ni Samsung físico en esta auditoría. Las capturas del navegador Chrome no sustituyen esa prueba.

### Backup técnico del Worker desplegado — REALIZADO

Se han preservado **17 módulos** de código del Worker desplegado en:
`cloudflare/staging-source-2026-11-11/`.
Los 15 módulos de lógica se guardaron en `modules.json`, y los dos voluminosos `mirror-snapshot.js` y `preview-jsqr-lib.js` como archivos separados. `extract-modules.mjs` permite reconstruir los 17 archivos sin desplegar ni modificar datos.

**Este backup es exclusivamente de código; NO es copia de D1/Supabase/R2 ni contiene los secretos del Worker.**

## 7. Bloqueos actuales antes de cerrar fase 5

1. Autenticación Google/correo, verificación, recuperación, logout y sesión persistente en navegadores reales (se dispone de pruebas positivas históricas del usuario, falta auditoría conjunta).
2. Ejecución con roles socio, puerta y administrador en un entorno aislado: editar/publicar, cambios de rol, QR, visitas y canjes sin usar perfiles originales.
3. Prueba visual móvil real, especialmente iPhone Safari y vídeos de la portada. No alterar los vídeos originales para forzar una coincidencia en capturas.
4. Copia privada y verificable de **datos de producción** e inventario de objetos R2, seguida de sincronización diferencial al momento del corte.
5. Plan de reversión y aprobación de la sustitución de backend: conservar DNS y Supabase originales hasta completar las pruebas.

**Confirmación:** las pruebas nuevas no modificaron usuarios reales, puntos, visitas, DNS, dominio, Worker ni sitio en producción.


## 8. Continuación: reglas y permisos aislados (11 de noviembre, 10:00 h París)

### 10 pruebas de puntos, QR, canjes y cambios administrativos — APROBADAS

Se ejecutaron las migraciones originales `0001-schema.sql` y `0002-auth-and-invariants.sql` **en SQLite en memoria**, con perfiles ficticios. Se verificaron:
- Una visita concede exactamente 10 puntos; la segunda visita en el mismo día queda rechazada sin duplicar saldo.
- Un canje no permite saldo insuficiente, descuenta el coste una sola vez y no puede reabrirse tras validación.
- Un socio no autorizado no puede validar el canje.
- Los cambios del administrador son atómicos y auditados; personal de puerta no puede modificar puntos.
- No puede degradarse el último administrador; los cambios basados en datos antiguos se rechazan.

Evidencia: https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/42992642358
Prueba reproducible: `cloudflare/test_sqlite_rules.py`.

### 10 pruebas de permisos usando los módulos de Worker recuperados — APROBADAS

Se recuperaron los 17 módulos respaldados y se ejecutaron `protectedRoute`, `mirrorDataRoute`, `mirrorWriteRoute` y `authRoute` con un entorno D1 y sesiones **simulados en memoria**. Rechazos y permisos comprobados:
- Sin sesión: HTTP 401.
- Socio: HTTP 403 en rutas de puerta/administración y publicación del editor.
- Puerta: acceso a sus consultas; no a las de administrador.
- Admin: lectura permitida de catálogo, socios y borradores.
- Cambios con `STAGING_MUTATIONS=disabled`: HTTP 423; origen externo: HTTP 403.
- QR no permitido para socio; la actividad se filtra por el ID autenticado; logout desde origen externo rechazado.

Evidencia: https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/42993023814
Prueba reproducible: `cloudflare/test_staging_roles.mjs`.

**Limitación:** son pruebas de código del Worker con identidades simuladas, no pruebas reales de la cámara, de Google, ni de editar/publicar con una sesión real.

### Inventario R2 detallado — CONFORME

Se listó el bucket `bellaquitas-media-staging` en modo lectura: 20 objetos, repartidos entre 3 logos (1.939.302 bytes) y 17 recursos originales del sitio (54.846.317 bytes).

Se compararon los 17 recursos `site-original/` uno por uno con `SITE_MEDIA` del Worker. El número de archivos, cada tamaño y cada SHA-1 de blob Git almacenado en metadatos de R2 coinciden. Los 17 tienen, además, metadatos SHA-256 presentes. Esto **no supone** haber recalculado el hash SHA-256 de todos los contenidos descargados.

### Comprobación de datos después de las pruebas — SIN CAMBIOS

Supabase conserva 6 perfiles. Cloudflare D1 conserva esos mismos 6 IDs y una cuenta adicional de correo de staging (7 perfiles totales). Los 6 originales coinciden en nombre, rol, código, puntos, puntos históricos y visitas. Total de puntos: 1.999.998 en ambos sistemas; visitas: 0. El Worker mantiene `STAGING_MUTATIONS=disabled`.

**No se ha cambiado ningún usuario real ni el DNS.**

## 9. Siguiente cierre de fase, aún pendiente

1. Una prueba con navegador **real** de login Google y correo, verificación, persistencia y logout en iPhone y Android, sin revelar contraseñas.
2. Pruebas de la cámara QR y de la experiencia completa del editor con usuarios **ficticios aislados**, con escrituras habilitadas exclusivamente en esa prueba controlada (no en la D1 actual con perfiles reales).
3. Revisión de reproducción y composición del vídeo en Safari iPhone y Android real. Las capturas automáticas son indicios, no sustituyen la validación visual.
4. Copia privada **verificable y restaurable de datos** de Supabase y D1, más un inventario/copia de los objetos R2, antes de cualquier migración definitiva. El código respaldado y D1 Time Travel no sustituyen estas copias.
5. Comparación diferencial final y plan de conmutación/reversión del backend manteniendo Supabase hasta que todo funcione.

**Estado operativo:** la migración NO se ha cortado a Cloudflare; el PR de auditoría permanece en borrador y la web pública no ha sufrido modificaciones.


## 10. Autenticación y protección de acceso — ampliación (11 noviembre 2026)

### 10 pruebas de correo, sesión y recuperación — APROBADAS

Se ejecutó el código **actual** del Worker con D1, Resend y Turnstile completamente simulados, sin peticiones externas reales:
- El sistema desactivado no permite iniciar sesión.
- Solo acepta métodos y orígenes autorizados; rechaza correos inválidos y contraseñas débiles.
- Inicio Google construye PKCE S256; callbacks mal formados se rechazan.
- Registro de correo → enlace de confirmación ficticio → validación de cuenta → login → cookie Secure/HttpOnly/SameSite → sesión persistente entre peticiones → logout → sesión revocada.
- Recuperación de contraseña invalida sesiones existentes y el token de restablecimiento no se puede reutilizar.
- Recuperación de correo desconocido conserva respuesta genérica.
- Turnstile de hostname incorrecto es rechazado.
- La respuesta pública de configuración no revela secretos de Resend ni de límites de intentos.

Evidencia: https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/42994647166

### 10 pruebas Google OAuth con claves criptográficas de ensayo — APROBADAS

Se crearon dos claves RSA ficticias efímeras; JWKS, el servidor de tokens Google y D1 son mocks **sin internet ni cuentas reales**:
- PKCE S256, estado y nonce coherentes.
- JWT RSA firmado válido inicia sesión de identidad ya importada.
- Estado de OAuth consumible una sola vez.
- Audiencia, nonce, firma, expiración y email no verificado son rechazados cuando no corresponden.
- Con `ALLOW_NEW_ACCOUNTS=no`, una identidad nueva no crea un perfil.
- Un error del proveedor de tokens no crea sesiones.

Evidencia: https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/42995088768

### Batería única de regresión — APROBADA

Todos los controles anteriores se ejecutaron de nuevo **juntos** en GitHub Actions, sin modificar producción:
- 10 reglas SQL de visitas/puntos/canjes en SQLite efímera.
- 30 comprobaciones Node de correo, Google y permisos con Worker exacto recuperado.
- 28 comprobaciones HTTP públicas y negativas frente a staging.
- 6 verificaciones del streaming original (5 vídeos + soporte HTTP 206).

**Resultado: 68/68 pruebas de lógica/API y 6/6 pruebas de streaming.**
https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/42995645683

### Reconciliación posterior — SIN DIFERENCIAS

Supabase: 6 perfiles; D1 staging: los mismos 6 + 1 cuenta de correo adicional. Cero diferencias entre los 6 perfiles originales en ID/rol/nombre/código/puntos/puntos históricos/visitas. Suma de puntos **1.999.998** y visitas **0** en ambos. En Cloudflare se verificó la disponibilidad de Time Travel (no representa un backup externo). `STAGING_MUTATIONS=disabled` continúa intacto.

### Respaldo y reversión

Se ha redactado `cloudflare/PLAN_RESPALDO_Y_CORTE_SEGURO.md` con condiciones de copia **privada**, restauración de Supabase/D1/R2, ensayos de solo datos ficticios, prueba de móviles y recuperación tras un cambio reversible.

**Importante:** el plan está preparado, pero no se ha exportado ni restaurado ninguna base de producción. La función de hash de contraseñas personalizada actualmente desplegada requiere revisión criptográfica independiente antes del corte definitivo.

**La fase 5 todavía no se cierra:** faltan pruebas en navegador/iPhone/Android reales y copias privadas restaurables. El Worker, DNS y GitHub Pages de producción no se han alterado.


## 11. Editor integrado con SQL real aislado — APROBADO

Se añadió `cloudflare/test_staging_editor.mjs`, que ejecuta los **módulos de edición realmente desplegados** contra una base SQLite `:memory:` creada con las migraciones 0001/0002/0003 y un simulador local de objetos R2. El test **NO se conecta a la D1 de Cloudflare ni a cuentas reales**. `STAGING_MUTATIONS=enabled` solo existe en la variable del entorno simulado de este test; el Worker desplegado mantiene `STAGING_MUTATIONS=disabled`.

**12/12 verificaciones aprobadas:**
1. Administrador crea un evento y lo ve en el catálogo, mientras el socio no puede leer el catálogo privado.
2. Administrador edita, desactiva y borra un evento ficticio.
3. Inserta premio y promoción ficticios sin modificar puntos.
4. Guarda borrador, publica configuración y mantiene traducciones ES/FR.
5. Edita textos sin eliminar los ajustes visuales.
6. Socio y personal de puerta no pueden guardar ni publicar.
7. Origen ajeno y bloqueo de staging impiden modificaciones.
8. Tablas, fechas, precios y URL de imágenes inválidos son rechazados.
9. No es posible eliminar los archivos de vídeo originales desde el editor.
10. Subida y descarga de PNG ficticio en almacenamiento de ensayo, con borrado posterior.
11. Rechazo de subida de PNG de firma falsa.
12. Puntos, visitas e identidades ficticias permanecen iguales durante las ediciones.

Evidencia: https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/42996569703

### Regresión conjunta de fase 5 — 80/80 y vídeo 6/6

Se incorporaron las 12 pruebas del editor al flujo conjunto `qa-phase5-full.yml`. Nueva ejecución aprobada:
- 10 SQL QR/fidelidad
- 30 acceso/correo/Google/permisos
- 12 editor/catálogos/medios con SQLite aislada
- 28 API HTTP de staging
- 6 verificaciones de vídeo (cinco MP4 y HTTP Range 206)

**Resultado: 80/80 casos lógicos/API superados, más 6/6 pruebas de streaming.**

Evidencia: https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/42996698265

### Control posterior de datos productivos

Una comparación de solo lectura confirmó:
- Supabase: 6 perfiles, 1.999.998 puntos, 0 visitas, 1 evento y 2 movimientos históricos.
- D1 staging: 7 perfiles (6 originales + 1 email de staging), 1.999.998 puntos, 0 visitas, 1 evento y 2 movimientos.
- Worker de staging: `ALLOW_NEW_ACCOUNTS=no`, `STAGING_MUTATIONS=disabled` sin cambios.

### Qué NO prueba aún

- El clic real y la visualización del editor en Safari iPhone o Chrome Samsung.
- La cámara QR y registro de puerta en un móvil físico contra una base de ensayo independiente.
- Login en navegador real con Google/Resend (las pruebas automáticas usan proveedores simulados).
- Respaldos privados de Supabase/D1/R2 verificados mediante restauración.
- Revisión independiente del esquema de contraseñas personalizado.

La fase 5 sigue abierta hasta completar esos puntos; no se cambió producción, DNS ni el diseño público.


## 12. Auditoría adicional: exposición de cuentas por tiempos en email login

Se encontró en el Worker respaldado un posible **vector de enumeración de correos**: si el correo no existe, el login responde antes de calcular PBKDF2; si existe pero la contraseña es incorrecta, calcula seis derivaciones. OWASP advierte que los tiempos pueden revelar existencia de cuentas incluso con respuestas genéricas.

Se ha creado **solo un candidato de corrección** `cloudflare/qa-candidates/email-auth-routes.js` que realiza el mismo cálculo para una cuenta desconocida utilizando una sal ficticia y mantiene el código y formato de contraseñas existentes para cuentas registradas.

- Prueba instrumentada: 6 derivaciones PBKDF2 para correo existente y 6 para inexistente; mensajes y status 401 iguales.
- Regresión original de correo: 10/10.
- Regresión completa con candidato inyectado **solo en el runner de GitHub**: 10 SQL + 10 correo + 10 roles + 10 Google + 12 editor + 28 HTTP, todas aprobadas, más streaming 6/6.
- Evidencia: https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/42997836661
- Hallazgos y condiciones de despliegue: `cloudflare/SEGURIDAD_LOGIN_CORREO.md`.

**No se ha desplegado la corrección.** Sigue pendiente resolver la diferencia de tiempos del registro de correo, evaluar límites de CPU bajo ataque y obtener una revisión criptográfica independiente del esquema personalizado `pbkdf2-chain6-sha256-v1`. No sustituir la implementación existente por un hash incompatible sin plan de actualización de credenciales y pruebas reales.

**Estado fase 5:** auditoría ampliada y corrección candidata probada; pruebas físicas, backups privados y revisión de seguridad completa siguen pendientes.


## 13. Pruebas E2E de navegador y comparación original vs staging

### 21/21 comprobaciones de navegador (Chrome) — APROBADAS

Se verificó el espejo REAL `/espejo/` sin usar credenciales, sin enviar formularios ni mutar datos:
- Escritorio: 5 enlaces de cabecera, selector ES/FR, traducción, persistencia tras recargar y retorno a español.
- Móvil 390 px: una hamburguesa, 5 secciones principales, 3 opciones de comunidad, navegación a Eventos y Sugerencias, pestaña activa, cierre por enlace y tecla Escape.
- Francés móvil: navegación, etiquetas/placeholder del formulario de Sugerencias, Bellaquitas Moments y Club; preferencia persistente.
- Vídeos: portada desktop y móvil correctos, clase de encuadre iOS y segundo vídeo móvil referenciado.
- Sin sesión, panel admin no expone formularios de socios.
- `diagnostics.json` del artefacto: `errors: []`, `pass: 21`.

Evidencia: https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43014682930  
Script reproducible: `cloudflare/test-browser-staging.mjs`. El test utiliza `playwright-core` gratuito con el Chrome ya instalado en GitHub Actions; no requiere plan de pago.

### 13/13 comprobaciones de paridad entre original y Cloudflare — APROBADAS

Se abrió `https://bellaquitas.fr/` y el espejo Cloudflare en Chrome real en dos tamaños (1440×900 y 390×844). Coincidieron:
- Número y jerarquía de controles, textos de menú ES/FR y formulario de Sugerencias en francés.
- Tamaño natural de logo, rutas de los vídeos original escritorio/móvil.
- Estilos computados de cabecera/vídeo y su geometría principal (tolerancia de 2px).
- Menú hamburguesa móvil: mismos enlaces y apertura.

Evidencia: https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43015001677  
Script reproducible: `cloudflare/test-browser-parity.mjs`.

### Límites de lo comprobado

**No se valida aún Safari WebKit sobre iPhone físico**, ni la reproducción real de los dos vídeos, la cámara QR, la sesión real Google/correo o el editor publicando sobre datos ficticios. La equivalencia CSS/DOM y rutas de vídeo no garantiza identidad de cada fotograma de vídeos en reproducción.

### Cierre y lista de aceptación

Se ha creado `cloudflare/FASE5_VALIDACION_FINAL.md` con un checklist para pruebas reales iPhone/Android y las salvaguardas de base de datos, seguridad y presupuesto cero.

**Estado:** fase 5 aún abierta; rama de auditoría y PR en borrador; sitio público no cambiado.


## 14. Paridad WebKit estilo Safari — 19/19 APROBADO

Se instalaron el navegador **WebKit de código abierto** de Playwright y sus dependencias en un runner GitHub Actions Ubuntu 24.04, sin contratar ningún servicio ni adquirir suscripción. Se abrió la web original y el espejo Cloudflare con viewport 390 × 844 y User-Agent de iPhone.

**19/19 comprobaciones aprobadas:**
- Los dos sitios aplican la clase de ajuste de vídeo iOS.
- Ambos seleccionan el MP4 de portada original para móviles y conservan `autoplay`, `muted`, `loop` y `playsInline`.
- **WebKit decodificó realmente el MP4** de portada en los dos sitios: `readyState=4`, `videoWidth=464`, `videoHeight=832`. Esto supera una simple comprobación de rutas o atributos.
- Los dos incluyen la fuente móvil del segundo vídeo, la cabecera y el logo; solo hay una hamburguesa.
- Sin desbordamiento horizontal (viewport 390, scrollWidth 390).
- Los estilos y geometría del encabezado, contenedor de vídeo y elemento MP4 coinciden con tolerancia `<=3px`.
- Los tamaños de logo, enlaces de menú y rutas de vídeos coinciden.
- Capturas del original y del espejo y reporte JSON guardados como artefacto temporal de GitHub Actions.

Evidencia: https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43015971325

**Limitación:** WebKit en Linux se aproxima a Safari en su motor, pero **no es Safari instalado en un iPhone físico**, ni demuestra compatibilidad perfecta con todos los modelos/versiones iOS. La prueba del segundo vídeo verifica su fuente original, no la decodificación ni reproducción completa de ese segundo MP4.

La fase 5 sigue abierta hasta completar las pruebas finales físicas de móvil/QR, las verificaciones de autenticación con cuentas ficticias, las copias privadas restaurables y la revisión de seguridad de contraseñas.

**Estado acumulado de esta auditoría:** 80 verificaciones lógicas/API, 6 verificaciones HTTP de medios, 21 controles de interfaz Chrome, 13 comparaciones Chrome con sitio original y 19 pruebas WebKit, todos aprobados en sus últimas ejecuciones. Estas cifras son de suites diferentes y pueden solaparse; no representan 139 funcionalidades independientes.


## 15. Segundo vídeo Safari y editor extremo a extremo aislado

### Segundo vídeo iPhone WebKit — MP4 móvil decodificado y reproducido

Se comprobó con motor WebKit de Playwright, dimensiones emuladas de iPhone y **sin credenciales**:
- En `https://bellaquitas.fr/` y en `/espejo/`, el elemento `video.bf-after-marquee-video` seleccionó el archivo `Bellaquitas Fest para móvil.mp4` (ruta web con codificación de caracteres).
- **Ambos** decodificaron el mismo MP4 a `1080 × 1920`, `readyState=4`, sin error HTMLMediaElement.
- La promesa `video.play()` se resolvió en los dos casos. Las dimensiones y el archivo seleccionado coinciden.
- No se editó ni descargó una nueva versión de los vídeos; fue lectura/reproducción pública del sitio y del espejo.

Evidencia: https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43019648645

### Worker completo, datos 100 % ficticios — 15/15 APROBADO

Se ejecutó **el entrypoint real** `bellaquitas-api-staging.js` con las 17 fuentes del Worker recuperadas, D1 SQLite `:memory:` y R2 falso. Incluye:
- `/health`, archivos del espejo, traducción FR, `noindex`, evento y sesión anónima.
- Tres perfiles ficticios (admin/socio/puerta): roles y permisos comprobados de extremo a extremo.
- Publicación de un evento ficticio mediante `POST /v1/mirror/admin/write` y lectura desde `GET /v1/events`.
- Rechazos de escrituras de socio/puerta, origen externo, y bloqueo de ediciones con `STAGING_MUTATIONS=disabled`.
- Ausencia de filtración de datos y saldos ficticios sin cambios.

Evidencia: https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43020117830

### Interfaz del panel/editor en navegador Chrome, usando Worker local — 11/11 APROBADO

Se arrancó un servidor **localhost efímero** que enruta todas las solicitudes al Worker original, alimentado por SQLite `:memory:` y los 17 recursos estáticos verificados **desde los archivos del repositorio** (emulación R2 con manifest Git). La sesión `admin` es una identidad simulada inyectada únicamente por el servidor de pruebas, **NO es login real, NO usa cookies de socios y NO hace peticiones a Cloudflare/Supabase/Resend**.

Comprobado en el navegador:
1. Salud del Worker local.
2. Vista principal del panel de administración.
3. Herramientas del editor visual visibles.
4. Guardar un borrador no altera el contenido publicado.
5. Publicación del texto español modifica solo la base ficticia.
6. Lectura del contenido publicado a través de la API local del Worker.
7. Guardar el texto francés no modifica el español.
8. Publicar ES/FR conserva las dos versiones de idioma.
9. Botón de vista previa móvil funciona.
10. Ningún punto/visita cambia en los perfiles de ensayo.
11. Sin errores JavaScript ni solicitudes HTTP 5xx al backend local.

Evidencia: https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43021180171

### Precauciones y próximos bloqueos

- Los tres sistemas de prueba son **ensayos automatizados aislados**; todavía no se han hecho pruebas físicas en iPhone ni Samsung, ni verificación completa del lector cámara QR con cuentas ficticias y acceso real.
- `STAGING_MUTATIONS=enabled` se utiliza **solo en objetos JavaScript dentro del proceso de CI**; el Worker desplegado continúa bloqueado con `STAGING_MUTATIONS=disabled`.
- No hemos contratado nuevos productos. Las pruebas se ejecutan en el plan disponible de GitHub Actions sin habilitar funciones Cloudflare de pago.
- La fase 5 sigue abierta hasta tener copias privadas restaurables, seguridad del login revisada, comprobación física y autorización de corte. No se ha migrado la web pública.


## 16. QR por cámara simulada y doble lectura con Worker real — APROBADO

**Fecha:** 11 noviembre 2026.

### 20/20 pruebas de integración del Worker — aprobado

En el test `cloudflare/test_worker_full_stack.mjs`, se añadieron cinco casos a las quince pruebas anteriores:
- Sin sesión, la ruta de puerta devuelve 401.
- Un socio sin rol de puerta no puede validar visitas (403).
- Se rechazan códigos QR inválidos o no encontrados (400/404).
- El personal de puerta valida el código ficticio `MBR-QA-TESTSOCIO`, registra una visita y concede exactamente 10 puntos.
- La segunda validación del mismo código ese día devuelve 409 y no altera puntos, visitas ni el historial adicional.

La prueba ejecuta **el entrypoint completo del Worker** sobre SQLite D1 en memoria, nunca la D1 real. Evidencia:
https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43111575023

### 8/8 pruebas de Chrome con cámara sintética y lector jsQR original — aprobado

En `cloudflare/test_browser_qr_isolated.mjs` se levanta un Worker completo sobre `localhost` con sesión ficticia de personal de puerta. Una imagen QR generada mediante `BellaQR.render`, la misma biblioteca de la web original, se reproduce sobre un `canvas.captureStream()` que simula una cámara del navegador. Se fuerza el lector auxiliar `jsQR` para comprobar el funcionamiento aun sin BarcodeDetector nativo.

La interfaz real abre la cámara simulada desde «Activar cámara QR», el lector reconoce el código de un socio ficticio y envía la solicitud al Worker local. La primera lectura devuelve HTTP 200 y suma 10 puntos; **la segunda devuelve HTTP 409**, y la base SQLite mantiene exactamente 10 puntos, 1 visita y 1 registro histórico. También se verifican el número de aperturas de cámara y ausencia de errores JS/HTTP 5xx.

Evidencia: https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43112449913

Se detectó y corrigió **una carrera en la secuencia de pruebas**: la segunda apertura de cámara se hacía mientras la vista todavía se refrescaba después de la primera validación. No se ha modificado el código del sitio por este hallazgo; la ejecución final pasa tras esperar la confirmación de la primera visita.

### Condiciones y límites

- Se utilizaron IDs, sesiones, puntos y códigos **totalmente inventados**.
- La cámara es un flujo Canvas del navegador; **no es una cámara física**, ni una prueba en Safari iPhone o Samsung real.
- `STAGING_MUTATIONS=enabled` se usa solamente en el Worker local en memoria, **jamás** en el Worker remoto con los perfiles originales.
- El flujo de regresión `qa-phase5-full.yml` ejecuta ahora también los 20 casos del Worker completo. Las pruebas individuales pueden solaparse; no sumar resultados como funciones independientes.
- Quedan pendientes las copias privadas restaurables de datos, la revisión completa de autenticación, la prueba física en dispositivos reales y el corte reversible de fase 6.

**Confirmado: no hubo cambios en DNS, bellaquitas.fr, D1 staging, Supabase ni puntos/visitas reales.**
