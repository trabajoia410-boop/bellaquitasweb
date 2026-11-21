# Bellaquitas Fest — continuación de migración (15/11/2026, noche)

**Alcance:** solo rama `migracion/fase5-segura-20261114`, Worker de preparación y consultas D1 de solo lectura. **Sin cambios** a GitHub `main`, DNS, dominio `bellaquitas.fr`, contraseñas, visitas ni puntos.

## Estado confirmado directamente en Cloudflare

- La cuenta Cloudflare conserva `bellaquitas-staging` y la restauración aislada `bellaquitas-restore-postadmin-20261115`.
- Ambas bases, verificadas mediante consultas SQL `SELECT` en la API D1, muestran **7 perfiles, 2 administradores, 1.999.998 puntos, 0 visitas, 0 sesiones admin reforzadas y 0 vinculaciones nuevas de email admin**.
- El Worker `bellaquitas-api-staging` tiene `STAGING_MUTATIONS=disabled`, `ALLOW_NEW_ACCOUNTS=no` y `EMAIL_REGISTRATION_ENABLED=no`. El antiguo binding R2 `MEDIA` no está presente; hay un binding de servicio de vídeo de pruebas `VIDEO_QA_PROXY`.
- El panel aislado está publicado **solo en pruebas** en `https://bellaquitas-api-staging.bellaquitas-fest-410.workers.dev/administracion/`.
- La PR #3 sigue **abierta en borrador**, apuntando a `main`, y no se ha fusionado.

**Precisión:** `SUGGESTIONS_ENABLED=yes` permite gestionar sugerencias del espejo con controles específicos; `STAGING_MUTATIONS=disabled` bloquea las escrituras sensibles de socios, puntos y administración, no debe describirse como bloqueo universal de todas las rutas.

## Cambios realizados en esta continuación

1. `cloudflare/mirror-auth-ui.js`: avisos de nombre inválido y fallo localizados ES/FR; no se altera autenticación ni datos.
2. `cloudflare/test-mirror-regression.mjs`: regresiones para esas traducciones sin acceso a cuentas ni red.
3. `cloudflare/test-mobile-mirror-browser.mjs`: se exige **cambio real de texto** en navegación al alternar ES → FR; comprobar solo `document.lang` ya no es suficiente.

Commits: `230657b32e67`, `9ffd68e2d978`, `cbce78ada3b8`.

### CI revisada después de los cambios

- [QA migración (sin despliegue), éxito](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43767757622)
- [Cloudflare safe QA, éxito](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43767757768)
- [Auditoría móvil WebKit y Chromium, éxito](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43767752151)

Estas pruebas son automatizadas en staging. **No equivalen a acceso real de los dos administradores ni pruebas de teléfonos físicos.** La copia restaurada en Cloudflare no sustituye una copia cifrada auténtica en un soporte externo.

## Bloqueo de lanzamiento mantenido

`cloudflare/release-gates-2026-11-15.json` conserva **16 controles: 8 aprobados y 8 pendientes**. No cambiar sus banderas por pasar estas tres pruebas. Pendiente:

- Exportación auténtica de producción a **soporte externo**, cifrada con una **clave nueva fuera del chat**, restaurada y contrastada; la clave histórica expuesta sigue sin rotarse.
- Login, reautenticación y vinculación de correo de **las dos cuentas admin reales**, sin duplicar perfiles.
- Resolver mediante decisión explícita la conservación del **séptimo perfil existente solo en D1** y hacer conciliación final de altas y cambios.
- Distribución estable de MP4 originales sin depender del proxy multimedia temporal, verificación física en iPhone/Android y QR/puerta.
- Revisar toda la traducción ES/FR de formularios y del panel independiente, no solo el menú; confirmar editor y vídeo tras pruebas reales.
- Preparar corte reversible, copia diferencial final y plan de rollback antes de modificar DNS o la web pública.

**Decisión actual:** seguir trabajando únicamente en preparación. No publicar ni fusionar PR #3.
