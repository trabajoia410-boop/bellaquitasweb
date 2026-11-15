# Bellaquitas Fest — panel administrativo en staging Cloudflare

**Fecha:** 15/11/2026. **Objetivo completado:** servir `/administracion/` en el Worker de preparación, con formularios y consola de editor web independiente, SIN tocar el dominio público `bellaquitas.fr`.

## URL desplegada

`https://bellaquitas-api-staging.bellaquitas-fest-410.workers.dev/administracion/`

HTTP real: **200**, CSP con nonce variable, `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `noindex`, `Cache-Control: no-store`. `/administracion` redirige con 308. El panel ofrece visualmente inicio Google y email/contraseña, editor, eventos, socios, recompensas y seguridad; **las operaciones de guardar y los nuevos registros permanecen bloqueados**.

## Despliegue seguro y resolución de R2 inexistente

- Se partió de los **18 módulos JS** de la rama `migracion/fase5-segura-20261114`, incluidas las protecciones de alta por email, sesión admin reforzada y selección de vídeo Safari.
- Se creó una versión candidata sin activarla. Cloudflare bloqueó correctamente su publicación porque la configuración antigua heredaba `MEDIA`, un R2 `bellaquitas-media-staging` que **no existe**.
- Se construyó una segunda versión candidata con **15 bindings válidos heredados** (D1 staging, secretos, OAuth, correo y flags), omitiendo **solamente** el binding R2 inexistente. El código operativo del Worker no usa `env.MEDIA`; el Worker autónomo de migración multimedia no forma parte de estos 18 módulos.
- Se creó una versión de **emergencia fail-closed**, lista para despliegue manual en caso de incidente: deniega todas las solicitudes con 503; no modifica D1, perfiles, DNS ni sesiones.
- Solo después del preflight se publicó al 100% la segunda candidata en `bellaquitas-api-staging`.

Versiones Cloudflare (NO son secretos, se consignan para operación y rollback):

| Tipo | ID |
|---|---|
| Panel staging publicado | `9a1a27be-936d-42e9-9037-c63fe4e7475d` |
| Versión previa (referencia; **no re-deplegable sin corregir R2**) | `4c7bbded-2e7a-4d2c-9406-9c11c6066aec` |
| Emergencia fail-closed (no desplegada) | `24f2b5fb-ba4c-447d-95fe-36c21a122060` |

**IMPORTANTE PARA REVERTIR:** debido a que el antiguo `MEDIA` apunta a un depósito inexistente, Cloudflare puede rechazar redeplegar la versión anterior. En una incidencia grave, utilizar como contención la versión de emergencia (deshabilita temporalmente **todo el Worker staging**, NO el dominio público) y después recuperar el servicio con una versión revisada. No prometer rollback a la versión antigua sin resolver antes la referencia R2. La versión antigua permanece registrada.

## Comprobaciones de entorno tras publicar

Se verificó por API de Cloudflare:

- 15 bindings correctos; D1 original `bellaquitas-staging` conservada. Los cinco secretos existentes no se copiaron a Git ni al chat.
- `STAGING_MUTATIONS=disabled` => edición de puntos, visitas, miembros, eventos y contenido cerrada.
- `ALLOW_NEW_ACCOUNTS=no` y `EMAIL_REGISTRATION_ENABLED=no` => no se admiten nuevas cuentas.
- `ADMIN_EMAIL_LINK_ENABLED` sin activar => no se vinculan aún contraseñas de administradores.
- D1: **7 perfiles, 1.999.998 puntos, 0 visitas**; 0 sesiones admin reforzadas y 0 vinculaciones admin de email.
- No se subieron vídeos ni logos. El estado `storage=not-configured` sigue siendo **correcto**; multimedia se prueba por separado.
- `bellaquitas.fr`, GitHub `main`, sus vídeos, diseño y DNS se han mantenido sin cambios.

La prueba HTTP `cloudflare/test-staging-admin-deployed.mjs` exige:
- panel GET/HEAD 200, redirección 308, método POST en HTML 405 y cabeceras de seguridad;
- formulario Google/correo y secciones administrativas presentes;
- `GET /v1/admin/session` 401, `GET /v1/auth/me` anónimo;
- registro email y link admin 503, edición de socio/editor denegadas sin credenciales, solicitudes de otro origen denegadas;
- espejo `/espejo/` funcional, vídeo Safari seleccionado y API de eventos accesible;
- ninguna cookie de sesión emitida durante las pruebas anónimas.

**CI exitosas:** [QA migración 43688146377](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43688146377) y [Cloudflare safe QA 43688146378](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43688146378).

## Pendiente antes de abrir la web definitiva

Los **dos administradores reales** siguen sin reautenticarse en staging durante la auditoría. Existen sus dos enlaces de identidad Google, pero todavía no hay contraseñas administrativas verificadas. Las pruebas con personas reales se realizarán en una ventana autorizada, cuando el entorno esté listo; no se deben crear perfiles duplicados.

Quedan pendientes los tres logos originales, despliegue y HTTP 206 real de cinco MP4, paridad visual móvil/FR, copia de seguridad externa cifrada con clave rotada, tratamiento de socio extra y pruebas QR físicas.

**PR #3 permanece en borrador y sin fusionar.** Las 14 condiciones del archivo `release-gates-2026-11-15.json` siguen impidiendo el cambio de DNS mientras haya cualquiera pendiente (actualmente 9).
