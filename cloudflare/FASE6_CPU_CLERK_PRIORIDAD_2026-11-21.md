# Bellaquitas Fest — fase 6: CPU + Clerk (21/11/2026)

**Alcance decidido por el propietario:** trabajar solo CPU y Clerk. Posponer nuevas operaciones de respaldo, rotación de claves, DNS y publicación hasta una fase posterior. `main` no se modifica. Rama única PR #3.

## CPU Workers Free
- Límite publicado por Cloudflare Workers Free: **10 ms de CPU por petición y 100.000 peticiones diarias**, no una garantía de disponibilidad cuando se agota la cuota. No elevar de plan.
- La operación heredada de hashing de contraseñas PBKDF2 (600.000 iteraciones divididas en 6 fases) llegó a **136,424 ms** en la prueba controlada documentada. La autenticación Clerk de producción reemplaza estas rutas, **sin reducir las iteraciones ni debilitar los hashes antiguos**.
- Se añade regresión en `cloudflare/test-free-cpu-policy.mjs`: las seis rutas heredadas de login, registro, restablecimiento y asociación administrativa devuelven **410 en modo producción** aunque la bandera de email antigua esté activada por error. Ninguna consulta D1 ni operación de hashing se ejecuta. Google OAuth directo antiguo también queda cerrado en producción.
- Muestra Cloudflare Analytics SQL de 20–21/11 en `bellaquitas-api-staging`: máximo observado HTTP 206 **6.347 μs**, HTTP 200 **29.713 μs**, HTTP 503 **106.431 μs**. Esto **no** certifica 10 ms para todas las rutas. La ruta de KDF antigua permanece existente para pruebas heredadas de staging; no habilitarla en producción.
- La entrega de vídeo continúa separada mediante Static Assets y Worker de medios, con streaming 206; no utilizar R2 ni procesar MP4 en memoria.

## Clerk Hobby gratuito (producción)
La API de Clerk confirma aplicación Bellaquitas con dominio **bellaquitas.fr**, certificados/DNS/correo completos, Google OAuth con credenciales de producción configuradas, contraseñas activadas y código por email disponible. **0 usuarios** en Clerk producción al consultar; no generar cuentas artificiales ni enlazar solo por email. Los seis sujetos Google históricos y el séptimo socio verificado deben conservarse en D1.

La documentación oficial actual confirma **MFA de Clerk en producción como prestación de pago**: no activar TOTP/backup-code ni subir a Pro, ni hacer depender la web del segundo factor de pago. `auth_multi_factor` de producción permanece deshabilitado.

## Puente Clerk y segundo paso administrativo
- JWT RS256 verificado mediante JWKS fijado al emisor, cacheado, un solo fetch concurrente, respuesta máxima 64 KiB, 5 s de plazo por subrequest y cooldown ante fallos.
- Ahora se rechazan JWT de sesión `pending`, `ended`, `suspended` o de impersonación (claim `act`), incluso si la firma es válida.
- Nueva ruta **POST /v1/auth/clerk/admin/step-up**, dentro del puente existente; se activa solo con `CLERK_ADMIN_STEPUP_ENABLED=yes`, aparte de `CLERK_JWT_ENABLED` y `CLERK_EXCHANGE_ENABLED`.
- Solo permite crear la sesión de administrador cuando (1) JWT Clerk válido del titular vinculado, (2) `fva[0]` firmado indica **primer factor verificado hace 0–2 minutos**, (3) cookie BF existente pertenece **al mismo perfil**, (4) rol real en D1 es `admin` y (5) origen es el canónico. No acepta mera frescura de `iat` ni necesita MFA de pago. Usa hashes y cookies HttpOnly existentes; no modifica puntos/visitas/roles.
- Se añadieron ensayos sintéticos de reautenticación reciente, falta de `fva`, sesión ajena, token suspendido, impersonación y flags desactivadas.
- Se refuerza el candado `productionConfigurationReady`: hasta que exista reverificación administrativa autorizada, el corte permanece bloqueado.
- **Importante:** esta es la parte **backend preparada y probada**, no el flujo visual de Clerk en la consola. Quedan integrar el frontend de reverificación y probarlo con identidades reales antes de activar el flag.

## Seguridad y gasto
No se cambia Clerk producción, su plan ni las credenciales; no se crea ninguna cuenta ni se habilita MFA facturable. No se cambian Workers desplegados, `main`, DNS, D1 ni datos de socios. Los candados de preproducción continúan en `no`. **CPU máxima de producción todavía no certificada**; pruebas automáticas sintéticas no sustituyen métricas reales por ruta o con usuarios finales.

El propietario ha pedido **aplazar expresamente respaldo y publicación**: no ejecutar esos trabajos en esta tanda.


## Integración visual Clerk en rama aislada, sin publicación

Se añadió `cloudflare/clerk-login-page.js` y la ruta única **`/acceso/`** del Worker candidato; solo puede renderizar si `SITE_MODE=production`, el dominio es `https://bellaquitas.fr` y cuatro flags de identidad/UI se habilitan explícitamente. **En preproducción `CLERK_UI_ENABLED=no` y `PUBLISH_APPROVED=no`: ruta inaccesible, sin desplegar.** No se ha editado la web pública.

- Páginas separadas de inicio de sesión para socios (`/acceso/`) y admins (`/acceso/?return=administracion`). El parámetro `return` no acepta una URL: solo activa el destino canónico `/administracion/` y cualquier otro valor cae en `/#/mi-espacio`.
- Se carga ClerkJS y Clerk UI desde el **dominio verificado** `clerk.bellaquitas.fr`, con clave *publicable* `pk_live_` fijada por entorno, CSP con nonce y bloqueo de orígenes/hostnames extraños. No se incluyen `sk_live_`, API tokens ni credenciales privadas.
- Tras firmar el usuario, el navegador envía JWT por `Authorization: Bearer` a `/v1/auth/clerk/exchange`. Solo un `auth_clerk_links` con `migration_confirmed` crea sesión Bellaquitas con cookie HttpOnly; una identidad sin vínculo recibe 403, **no** se crea perfil ni se modifican puntos.
- El panel definitivo usa el enlace Clerk en lugar de ofrecer login viejo Google/email, preservando nodos inertes y ocultos de la interfaz anterior para no romper el JS heredado. Reutiliza protección por pestaña `bf_admin_tab_login` **solo después** de respuesta satisfactoria de `POST /v1/auth/clerk/admin/step-up` y comprobación de cookie BF, titular y primer factor reciente.
- Si falta frescura, aparece **Volver a identificarme**, que permite cerrar sesión y entrar de nuevo por Google/email con Clerk **sin MFA de pago**.
- Idiomas español y francés, selector ES/FR y preferencia guardada por navegador. Error de vínculo explica que no se crea ficha nueva.
- `cloudflare/test-clerk-login-page.mjs`: pruebas offline del marcado, CSP, orígenes y destinos fijos, producción bloqueada, panel ocultando login legado, JavaScript en VM simulando Clerk, éxito de socio/admin, rechazo de vínculo y segundo paso, reidentificación y texto francés. Se ejecuta en CI `qa-clerk-phase6`, `qa-cloudflare-migration` y `phase5-preflight`.

**Limitación clave:** este flujo visual tiene pruebas offline con SDK simulado, **no** un login real de producción con cuentas existentes; Clerk producción tenía cero usuarios verificados. Solo puede probarse con cuentas reales tras vinculación segura de identidad Google/email. No abrir flags ni crear usuarios de prueba que alteren la migración.

## Métricas Cloudflare CPU reales, 20–21/11/2026

Analytics SQL `events.workersInvocations`, muestreo por tipo de respuesta, ejecución **solo de lectura**:

| Worker/respuesta | muestras | CPU media | máximo observado |
|---|---:|---:|---:|
| API staging 206 (fragmentos de vídeo) | 3.405 | 0,94 ms | 6,35 ms |
| API staging 200 | 12.486 | 0,97 ms | 29,71 ms |
| API staging 503 | 250 | 1,62 ms | 106,43 ms |
| Media QA (distintas respuestas) | 772 | entre 0 y 0,79 ms | 1,69 ms |

El muestreo estimó 33.551 peticiones de API y 772 de medios en la ventana **de dos días**, lo cual **no equivale** a garantía de ningún día futuro ni a un saldo de facturación. La API no presenta desglose por ruta en estas estadísticas, y algunos máximos superan el presupuesto de 10 ms. Una muestra sintética de Clerk tampoco certifica CPU de Worker Free en el código final. `FREE_TIER_CPU_VERIFIED=no` sigue correctamente cerrado.

No utilizar R2, aumentar límites CPU ni activar cuotas pagadas. La decisión de posponer respaldo y publicación se mantiene.
