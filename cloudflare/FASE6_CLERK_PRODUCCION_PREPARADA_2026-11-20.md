# Fase 6 — Clerk producción creada y preproducción segura actualizada

**Fecha:** 20/11/2026. **Alcance:** integración Clerk y Cloudflare privada de Bellaquitas Fest. Sin modificar `main`, DNS de Hostinger, `bellaquitas.fr`, usuarios, puntos ni rol.

## Identidad Clerk

Se reutilizó la aplicación Clerk **Bellaquitas** ya conectada: `app_3MLxHRJm2GlebhItEr9REyEivsz`, instancia de producción creada `ins_3MM7xtO06Ez6Cig1vKOoYo4gjA7` para el dominio raíz `bellaquitas.fr`. No se creó una aplicación adicional.

- Configuración clonada: email verificado con código, contraseña opcional de al menos 15 caracteres, Google OAuth habilitado como estrategia, sesión máxima 7 días y protección de credenciales filtradas.
- **0 usuarios en Clerk producción** en el último recuento; no se han clonado por email los 7 perfiles D1.
- Modo de registro de producción cambiado y confirmado: `auth_access_control.sign_up_mode=restricted`. Se mantiene cerrado hasta reconciliar el origen, y debe volver a revisarse antes de permitir nuevos socios. Clerk Billing dentro de la aplicación: `user_enabled=false`, `organization_enabled=false`, sin planes de pago configurados. Esto NO certifica el plan ni los gastos de la cuenta Clerk completa.
- Google OAuth producción **todavía sin client_id/client_secret propios**; Clerk no copia el cliente compartido del entorno de desarrollo. Las credenciales Google ya existentes en un Worker Cloudflare no pueden leerse en claro de forma segura ni transferirse automáticamente; evitar solicitarlas en el chat.
- No se enviaron invitaciones ni emails a socios o administradores.

## DNS Clerk preparado, sin tocar DNS

Clerk entregó 6 registros; los valores exactos están en `cloudflare/clerk-production-dns-plan.json`.

- `clerk.bellaquitas.fr CNAME frontend-api.clerk.services` (sin proxy).
- `accounts.bellaquitas.fr CNAME accounts.clerk.services` (sin proxy).
- `clkmail.bellaquitas.fr CNAME mail.0wjy6s533o1f.clerk.services` (sin proxy).
- `clk._domainkey.bellaquitas.fr CNAME dkim1.0wjy6s533o1f.clerk.services` (sin proxy).
- `clk2._domainkey.bellaquitas.fr CNAME dkim2.0wjy6s533o1f.clerk.services` (sin proxy).
- `_dmarc.bellaquitas.fr TXT v=DMARC1; p=none;`. **NO sobrescribir ninguna política DMARC existente**: inspeccionar primero registros autoritativos y conservar protección previa.

Verificación actual Clerk: **incomplete** (`dns in_progress`, `mail not_started`, `ssl not_started`). Cloudflare zona `bellaquitas.fr` estado `pending`, `Free Website`, nameservers originales `cosmos.dns-parking.com`, `nova.dns-parking.com` y propuesta Cloudflare `donald.ns.cloudflare.com` / `tricia.ns.cloudflare.com`. No se cambiaron registros en Hostinger ni en zona Cloudflare. Antes de delegar, la zona Cloudflare deberá replicar todos los MX, A, CNAME y TXT originales además de Clerk.

## Preproducción Cloudflare D1 y Worker

El esquema `cloudflare/migrations/0008-clerk-verified-links.sql`, probado previamente en staging, se instaló también en D1 `bellaquitas-produccion-preparada-20261116` (solo estructura). Cinco objetos DDL creados: 1 tabla, 1 índice y 3 triggers. Revisión comparativa completa de **14 tablas de aplicación** antes/después: **0 diferencias**; `auth_clerk_links=0`; **0 errores de claves foráneas**; **7 perfiles**, **2 administradores**, **1.999.998 puntos**, **0 visitas**.

Archivo de configuración `cloudflare/wrangler-api-preproduccion.jsonc` actualizado en PR #3: `CLERK_ISSUER=https://clerk.bellaquitas.fr`, `CLERK_ALLOWED_ORIGIN=https://bellaquitas.fr`, con `CLERK_JWT_ENABLED=no`, `CLERK_EXCHANGE_ENABLED=no`, `PUBLISH_APPROVED=no`, `FREE_TIER_BILLING_VERIFIED=no`, `FREE_TIER_CPU_VERIFIED=no`.

Cloudflare Workers Builds existente ejecutó, sin nueva suscripción ni nuevo Worker, el build privado **`4c549fc8-66ac-4ff0-8eb1-b08b648d9b0a`**, finalizado con `success` el 20/11/2026 a las 04:34:42 UTC. Nueva versión del Worker privado `bellaquitas-api-preproduccion`: **`157f7dcb-e92e-4c44-aff9-eba27216362f`**. Versión anterior identificada antes de compilar para posible reversión: `9f812f59-bd0d-4a18-b4a3-249ff1a1722e`.

Lectura Cloudflare tras despliegue:
- Todos los flags de publicación y autenticación siguen bloqueados.
- Workers.dev y previews **desactivados**, **0 rutas públicas** y **0 custom domains**.
- Emisor/origen Clerk producción fijados correctamente, pero **no utilizables** hasta verificación DNS y migración de usuarios.
- 7 perfiles, 2 admins, 1.999.998 puntos, 0 visitas, 0 enlaces Clerk y 0 errores FK preservados.
- Todos los controles GitHub Actions de la rama tras cambiar la configuración completaron `success`: QA migración, Cloudflare safe QA, fase 6 identidad y preflight de seguridad.

## Pendientes inevitables antes de publicar

1. Configurar los **seis registros DNS** en la autoridad real de dominio (Hostinger mientras la delegación Cloudflare siga pendiente), sin perder la web de GitHub Pages y correo.
2. Vincular credenciales Google OAuth de producción **en Clerk** con su propio cliente registrado, y verificar correo/contraseña.
3. Migrar las identidades **sin inventar 7 cuentas nuevas**: seis Google deben verificarse mediante subidentificador de Google y la cuenta email mediante posesión verificada; mantener roles/puntos y segundo control admin.
4. No se obtuvo auditoría integral de facturación Cloudflare: API Billing sigue 403; capturas anteriores indican Workers Free, pero **no** garantizan 0 € para toda la cuenta. No activar Workers Paid ni otros servicios.
5. CPU máxima Workers Free 10 ms: el antiguo KDF sintético 136,424 ms no cumple; el camino Clerk WebCrypto necesita perfilado final con JWT reales/controlados antes de abrir autenticación.
6. Respaldo original cifrado de 16/11 sin rotación real: Biblioteca deniega materializar bytes del antiguo `.bqbk` y su clave. Respaldo cifrado restaurado de 18/11 permanece válido y separado; no borrar el antiguo.
7. Conciliar altas nuevas del origen previo desde la última exportación, y prueba del flujo de sesión/admin; los tests físicos iPhone/QR del propietario permanecen diferidos hasta después de publicar.

**No se ha hecho el corte. No aprobar release-gates ni cambiar DNS/main.** Este archivo preserva evidencia de lo efectivamente realizado.


## Preparación DNS adicional — verificación del 20/11/2026

En la zona **pendiente** de Cloudflare se crearon los 5 CNAME exigidos por Clerk, todos `proxied=false`, TTL 3600. La lista exacta es `cloudflare/clerk-production-dns-plan.json`. La zona pasó de **10 a 15 registros**. Se verificó por Cloudflare API que los **10 registros originales conservan tipo, host, destino, proxy e identificador**, incluyendo GitHub Pages, MX y Resend. No se modificó ningún A, MX, TXT, NS ni se añadió ruta Worker pública.

**Los nombres de servidor autoritativos de Hostinger NO se han modificado**: Cloudflare sigue estado `pending`. Estos CNAME de Cloudflare no están aún publicados por el DNS autoritativo de Hostinger; no declarar dominio Clerk verificado ni sustituir Google OAuth. No se creó el TXT `_dmarc` porque no ha podido comprobarse una política DMARC ya activa de Hostinger; publicar `p=none` encima de una política fuerte podría debilitar el correo.

Se conservó `cloudflare/phase6-dns-fingerprints-20261119.json` como **fotografía histórica de los 10 registros originales**, no como estado actual; el estado actual queda en `phase6DnsVerification.pendingZoneDnsRecordCount=15`. Los release gates y la compilación privada siguen bloqueando producción mientras falten DNS autoritativo, Google OAuth, conciliación y auditoría Free.


## Candado de publicación reforzado: Clerk y DMARC

El mismo 20/11 se han incorporado a `release-policy.mjs` dos controles independientes:

1. `clerkProductionReady`: exige dominio Clerk validado, Google OAuth de producción, los **6 perfiles Google + 1 socio email** vinculados con prueba, acceso de administrador reforzado, recuperación de correo, eliminación efectiva de KDF heredada y medición CPU real del JWT en Workers Free. La creación de la instancia Clerk, el simple correo coincidente y una prueba sintética no dan autorización.
2. `clerkDnsSafe`: exige cinco CNAME Clerk sin proxy, conservar los diez registros anteriores y completar el registro DMARC sin debilitar la política autoritativa ya existente. No delegar los nameservers a Cloudflare mientras esa condición sea falsa.

En `release-gates-2026-11-15.json` el estado Clerk figura con **0/7 vínculos verificados**, DNS dominio no verificado, Google OAuth producción sin configurar y legado CPU sin resolver. Las banderas permanecen en `false`. Se añadieron pruebas negativas a `test-release-gates.mjs` para impedir que cualquiera de estas condiciones pendientes sea ignorada. **No se han modificado ni emitido sesiones reales.**

## Endurecimiento Clerk adicional (20/11/2026, segunda revisión)

Se detectó que el puente `clerkSessionExchange` heredaba los 30 días de la cookie BF de socio, mientras el máximo de sesión Clerk producción configurado es de 7 días. Se ha añadido un parámetro de duración opcional a `createAuthSession`, sin cambiar las sesiones antiguas: los intercambios Clerk emiten ahora BF HttpOnly **máximo 12 horas**, también comprobado en la inserción D1 sintética y en Max-Age. Eso **no implementa revocación instantánea sincronizada con Clerk**: se necesita vincular/desactivar sesiones al cerrar sesión y/o webhook para afirmar logout completo.

El planificador de enlaces reconoce también `external_accounts[].provider_user_id` de la API Clerk oficial, además de `providerUserId` de SDK, siempre sujeto a `verification.status=verified` y coincidencia exacta con `auth_identity_links.provider_subject`. No se enlaza por correo.

La nueva migración aditiva `0009-clerk-confirmed-evidence-immutable.sql` impide sustituir evidencia Google por evidencia email del mismo perfil tras confirmar un vínculo; tampoco permite alterar la fecha de verificación. En su prueba SQLite se introduce una segunda identidad verificada **ficticia del mismo perfil** y se confirma el rechazo del cambio de evidencia, sin alterar balances ni roles. Aplicar solo después de CI.
