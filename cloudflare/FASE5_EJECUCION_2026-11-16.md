# Bellaquitas Fest — ejecución de los ocho bloqueos fase 5 (16/11/2026)

**Acción solicitada:** avanzar todos los bloqueos posibles sin detenerse a pedir confirmación. **Estado real:** 9 de 16 controles de lanzamiento aprobados (antes 8/16); la web de producción no se ha modificado.

## 1. Política de cuenta adicional — APROBADA Y AUTOMATIZADA

La séptima cuenta staging con correo verificado se **conserva**. El delta de altas del origen también se preservará; no se permiten pérdidas ni duplicaciones. Se bloquea cualquier conflicto de identidad, rol, puntos, visitas o código de socio antes de tocar datos. Se añadieron:
- `cloudflare/plan-account-cutover.mjs` (solo lectura, offline, sin exponer datos personales).
- `cloudflare/test-account-cutover-policy.mjs` (casos sintéticos de seis cuentas de origen + una local + alta tardía; 12 casos conflictivos).
- `cloudflare/POLITICA_CORTE_CUENTAS_2026-11-16.md` (criterios explícitos y rollback).
- [QA de migración verde](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43775436405).

Comprobación de Cloudflare mediante consultas D1 de **solo lectura** (staging y restauración):
- 7 perfiles; 2 administradores; 6 vínculos Google; 1 vínculo email y 1 credencial email verificada.
- 1.999.998 puntos y 0 visitas; sin identidades duplicadas ni errores de FK.

**Se ha aprobado solo la política `stagingOnlyAccountCutoverPolicyApproved`, no la conciliación final de cambios de producción.** El corte permanece bloqueado.

## 2. Cinco vídeos originales — intento real de despliegue QA ejecutado

Se activó el workflow [Bellaquitas multimedia QA](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43775094654):
- 20 medios originales verificados, entre ellos cinco vídeos MP4 y tres logos; guardas de tamaño/hash superadas.
- El workflow trató de hacer la subida solo a `bellaquitas-media-qa`, sin R2 ni producción.
- **Frenó de manera segura:** GitHub Actions no tiene `CLOUDFLARE_API_TOKEN` ni `CF_API_TOKEN` como Secret. El paso de subida se omitió sin modificar ningún dominio.
- El intento alternativo de leer MP4 binario mediante el conector GitHub falló por restricciones de contenido UTF-8; no se puede suplir con credenciales públicas ni afirmar que los videos ya estén alojados en Static Assets.

**Control `originalVideosDeployedToMediaQa` todavía pendiente.** No habilitar secreto en código ni copiarlo en chat.

### Alternativa Cloudflare Pages sin R2 ni API token

El 16/11 se intentó crear exclusivamente el proyecto QA `bellaquitas-media-qa-pages`, conectado al repositorio de GitHub en la rama de migración y compilando los archivos originales mediante `node cloudflare/build-static-assets.mjs --require-logos`. La API Cloudflare devolvió **HTTP 401, código 8000011: problema interno de la instalación Git de Cloudflare Pages**. La lectura posterior de la cuenta confirma **cero proyectos Pages creados**; no se cambió DNS, la rama principal, los medios ni las suscripciones.

La alternativa requiere que el propietario repare/reconecte la instalación GitHub de Cloudflare Pages o aporte una credencial limitada mediante GitHub Actions Secret, nunca en el chat. Hasta entonces no se puede declarar que los MP4 estén alojados en Static Assets propios.

## 3. Cámara/QR físico y verificación de vídeo — banco de pruebas real desplegado

Nuevo Worker **aislado** `bellaquitas-device-qa` creado con Cloudflare conectado:

https://bellaquitas-device-qa.bellaquitas-fest-410.workers.dev/

- Selector ES/FR, vídeo de cámara local, lector `assets/jsqr-local.js` auténtico (SHA de blob Git `99ea9df26907009e5553233ffe03c529c1521739`).
- Lista de cinco vídeos originales accesibles mediante espejo de staging, sin copiar bytes a R2 ni recomprimir.
- El contenido QR se analiza exclusivamente en memoria en el teléfono; **no se envía ni guarda**. Sin cookies, autenticación, D1, R2, formulario de envío ni permisos de edición.
- Solo rutas GET/HEAD en lista blanca, CSP restrictiva, `noindex` y bloqueo de solicitudes POST.
- [QA HTTPS real correcto](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43776050095) y [QA general de la rama correcto](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43776068714).

**Controles `realDeviceQrDoorTest`, `realHttp206AndIosAndroidPlayback` y `finalEsFrMobileVisualParity` continúan pendientes** hasta comprobación física o auditoría completa, sin atribuir a una simulación la validez de un teléfono real. Esta página no autoriza escanear el QR de socios en la puerta ni modificar visitas.

## 4. Copias de producción, clave antigua y administradores reales

- La copia cifrada y restaurada anteriormente corresponde a **D1 staging**, no a producción. Ninguna exportación real del origen fue obtenida en esta ejecución.
- La base D1 auxiliar de copias cifradas rechazó la consulta de metadatos con `SQLITE_AUTH`; no se forzó acceso ni se borró nada. **La antigua clave expuesta no consta rotada fuera del chat.**
- Las dos cuentas admin reales no tienen verificada la autenticación y reautenticación integral; el QA con cuentas ficticias no suple esa prueba.
- Las pruebas físicas no pueden completarse desde un servidor sin acceso a la cámara real de un usuario.

**Por estos motivos no se marcaron como completados** los controles de backup producción, clave histórica ni los administradores.

La [prueba HTTPS de los 5 MP4 con HTTP 206, bytes originales y sin cookies](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43776451180) también terminó correctamente; demuestra servicio de vídeo temporal, **no** subida a Cloudflare Static Assets.

## Producción protegida

- `bellaquitas.fr`, DNS, rama `main`, el contenido original, puntos, visitas, vídeos y contraseñas: **sin cambios**.
- `migracion/fase5-segura-20261114`: rama de trabajo; PR #3 debe seguir **abierta en borrador y sin fusionar**.
- Configuración de staging: `STAGING_MUTATIONS=disabled`, `ALLOW_NEW_ACCOUNTS=no`, `EMAIL_REGISTRATION_ENABLED=no` (sugerencias públicas con control propio pueden escribir en staging).
- No se ha autorizado ni ejecutado corte DNS ni nuevas suscripciones de pago.
