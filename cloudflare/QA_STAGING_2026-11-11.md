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
