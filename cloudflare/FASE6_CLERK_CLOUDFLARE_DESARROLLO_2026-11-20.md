# Bellaquitas Fest · Clerk + Cloudflare, primera integración segura

**Fecha:** 20/11/2026. **Rama:** `migracion/fase5-segura-20261114` (PR #3 borrador). **NO publicar todavía ni cambiar Cloudflare DNS / GitHub Pages.** Sin nuevos servicios Cloudflare ni Workers Paid.

## 1. Clerk conectado y configurado

Se detectó mediante conector Clerk la aplicación preexistente **Bellaquitas** (`app_3MLxHRJm2GlebhItEr9REyEivsz`), con instancia de **desarrollo**, 0 usuarios y sin instancia de producción. No se ha creado otra aplicación.

Configuración comprobada en desarrollo:
- **Google**: activado (Clerk proporciona credenciales compartidas solo para desarrollo).
- **Correo + contraseña**: activado; contraseña **opcional** para usuarios que prefieran Google; longitud mínima 15 caracteres; verificación de correo obligatoria.
- Protección de contraseñas filtradas, bloqueo por intentos y verificación por email ya existentes; no reducir controles.
- Sesiones de desarrollo con máximo de 7 días. No confundir con persistencia ilimitada.
- Facturación dentro de Clerk **no activada**. El plan Hobby oficial anuncia base **$0**, sin tarjeta obligatoria, hasta 50.000 usuarios retenidos mensuales por aplicación. No activar add-ons ni funciones de pago. Referencia: https://clerk.com/pricing .

## 2. Arquitectura implantada en la rama segura

- `cloudflare/clerk-auth-bridge.js`: verifica **JWT RS256** de Clerk con JWKS del emisor HTTPS explícitamente permitido, valida **firma, kid, issuer, azp, iat, nbf, exp, user_ y sess_**. Rechaza emisores arbitrarios, tokens manipulados/caducados y solicitudes sin cabecera Bearer. No contiene secretos de Clerk ni realiza hashing PBKDF2 en Workers.
- `GET /v1/auth/clerk/me`: **solo lectura**. Devuelve perfil D1 únicamente si existe correspondencia `clerk_user_id -> profile_id` confirmada. Nunca vincula por correo; cuenta Clerk sin enlace: 403. Rol admin en la respuesta no equivale a permitir panel.
- `cloudflare/migrations/0008-clerk-verified-links.sql`: crea tabla separada `auth_clerk_links` con vínculo único a perfil y `link_method='migration_confirmed'`. **Solo esquema preparado; no se ha ejecutado contra datos reales.**
- `cloudflare/plan-clerk-verified-links.mjs`: planificador **offline** sin escritura; los identificadores Google originales se comparan con `providerUserId` verificado de la cuenta externa Google en Clerk. Ni email ni nombre bastan para vincular. Se rechazan duplicados.
- `POST /v1/auth/clerk/exchange`: **desactivado por defecto**. Tras verificar JWT y vínculo D1 confirmado, podrá emitir una sesión `__Host-bf_session` HttpOnly usando el sistema existente. **No emite `__Host-bf_admin`**: el panel mantiene su reautenticación administrativa por separado. No modifica puntos/visitas/roles.
- `cloudflare/clerk-qa-preview.js`: interfaz experimental de prueba con SDK oficial ClerkJS, ubicada en `/__qa/clerk/` y restringida a nombre de host staging, `SITE_MODE=staging`, `CLERK_QA_PREVIEW=yes` y `CLERK_JWT_ENABLED=yes`; **los flags no están activados**.
- `cloudflare/bellaquitas-api-staging.js` enruta las funciones de Clerk tras pasar el gate global de producción. **No sustituye todavía el login de Google y correo heredados**, ni la portada, QR, puntos o editor.
- `cloudflare/wrangler-api-preproduccion.jsonc` impone `CLERK_JWT_ENABLED=no`, `CLERK_EXCHANGE_ENABLED=no` y `CLERK_QA_PREVIEW=no`; también mantiene `PUBLISH_APPROVED=no`, `FREE_TIER_CPU_VERIFIED=no`, `FINAL_ORIGIN_RECONCILED=no` y `BACKUP_KEY_CUSTODIED=no`.

## 3. QA automática

- `cloudflare/test-clerk-auth-bridge.mjs`: prueba con RSA sintética, validación de firmas/claims falsos, no vincular desconocidos y prohibir segundo factor de administrador automático. Ensaya sesión HttpOnly solo con D1 falsa.
- `cloudflare/test-clerk-qa-preview.mjs`: comprueba que la pantalla está oculta por defecto y que nunca se muestra en `bellaquitas.fr` ni en preproducción.
- `cloudflare/test-clerk-verified-links.mjs`: seis perfiles Google ficticios, coincidencia exacta por `providerUserId`, rechazos de coincidencia por email y duplicados.
- Se añadieron los tres tests al workflow `.github/workflows/bellaquitas-phase5-preflight.yml`.

## 4. Qué NO está terminado ni se debe fingir

1. Clerk desarrollo **tiene 0 usuarios**. **No se han importado las seis cuentas originales** ni el perfil adicional D1. No crear duplicados, ni modificar roles/puntos; comprobar identidad Google verificable antes de vincular.
2. Clerk producción **no existe aún**. Requiere configuración DNS, emisores de producción y **credenciales propias Google OAuth**. Clerk compartidas de desarrollo no sirven en producción: https://clerk.com/docs/guides/development/deployment/production .
3. La ruta de intercambio y la API de D1 **no están activadas** y no han pasado un test OAuth humano en el hostname final. El frontend público sigue usando el acceso anterior; una vista QA no es migración completa.
4. `production-auth-readiness.js` y `release-policy.mjs` continúan bloqueando el corte. **No** convertir `FREE_TIER_CPU_VERIFIED` en `yes` simplemente por integrar Clerk: falta verificar CPU RS256/cache/rutas reales y desactivar PBKDF2 heredado en todas las rutas publicables de producción.
5. La contraseña antigua de una identidad Google no existe para trasladar. Las credenciales staging heredadas no se copiarán automáticamente a Clerk. Se debe usar Google/alta segura con nueva contraseña o migración autorizada compatible.
6. El coste del plan Hobby no demuestra gratuidad ilimitada de Cloudflare/Clerk o de otros productos; mantener alarmas de límites y gastos antes de publicación.

**Estado:** implementación inicial de desarrollo, con controles *fail-closed* y sin cambios sobre datos ni dominio. La migración completa requiere reconciliación real, prueba de acceso/recuperación, administración y aprobación segura del corte.
