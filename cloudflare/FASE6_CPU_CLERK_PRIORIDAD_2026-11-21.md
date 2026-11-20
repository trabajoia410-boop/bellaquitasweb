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
