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
