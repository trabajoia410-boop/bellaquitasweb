# Bellaquitas Fest — Salida gratuita para el acceso con contraseña (sin contratar)

**Fecha:** 12/11/2026 · **Estado:** estudio técnico; ninguna cuenta creada ni integración desplegada.

## Requisito no negociable

La administración debe abrirse en una **pestaña nueva**, pedir **correo y contraseña** y permitir gestionar web/eventos/socios sin alterar el diseño actual. El hosting/backend deben seguir sin suscripciones de pago ni cargos automáticos. La identidad de los dos administradores actuales debe conservar el **mismo `profile_id` D1**: no elevar roles por email ni duplicar fichas de fidelidad.

Cloudflare Workers Free limita cada petición a **10 ms de CPU** (documentación actual). La implementación PBKDF2 propia consume ~93–95 ms CPU en una prueba Node (no medida del Worker), por lo que está bloqueada. No debemos reducir iteraciones a ciegas.

## Alternativas evaluadas

| Opción | Correo + contraseña | Google | Coste/condición | Decisión |
|---|---|---|---|---|
| Seguir verificando PBKDF2 600k dentro de Workers Free | Sí | Sí | 10 ms CPU por solicitud; ensayo Node 94 ms CPU | **No desplegar** mientras no se demuestre viable |
| **Clerk Hobby** (servicio externo de identidad) | Sí | Sí | Plan gratuito sin tarjeta; hasta 50.000 usuarios retenidos/mes y 3 plazas de gestión; sesiones de hasta 7 días; algunas funciones como MFA completo, branding y opciones avanzadas son de pago | **Candidato prioritario para investigación**, NO adoptado |
| **Auth0 Free** (servicio externo) | Sí, sujeto a su configuración de base de usuarios | Sí | $0 y sin tarjeta; hasta 25.000 usuarios activos mensuales; otras funciones tienen límites y servicios propios de correo requieren examen | Alternativa, NO adoptada |
| Firebase Auth Spark | Sí | Sí | No exige método de pago en Spark; el propietario manifestó que **no desea usar Firebase** por preocupación por planes de pago | No proponer como solución principal |
| Cloudflare Access Free con Google/OTP | No es un login tradicional con contraseña elegida por el usuario | Sí | Acceso gestionado, pero no satisface literalmente el formulario propio de correo/contraseña | No sustituye el requisito |
| Supabase Auth Free | Sí | Sí | Funciona actualmente, pero puede pausar el proyecto por inactividad y el propietario quiere evitar depender de esa pausa | Mantener solo mientras dure transición |

**Foco recomendado de la investigación: Clerk Hobby**, porque permite delegar la verificación costosa de contraseña al proveedor sin ejecutar la KDF en Workers Free, y dispone de API/componente JavaScript para un login integrado. **No afirmar aún que está integrado o que no tendrá nunca límites**. No crear una cuenta ni aceptar términos en nombre del propietario sin autorización.

### Precauciones concretas si se acepta estudiar Clerk

- El plan Hobby indica **sin tarjeta de crédito**, pero no garantiza recursos ilimitados ni todas las funciones gratis. Comprobar si el volumen futuro sigue bajo 50k MRU; si se alcanza el límite, **detenerse sin pasar automáticamente a un plan facturable**.
- La documentación confirma email/password y social Google; algunas interfaces preconstruidas muestran marca del proveedor. Validar que el formulario del admin se puede adaptar manteniendo el diseño oscuro/dorado de Bellaquitas. No incrustar branding ajeno sin autorización.
- La duración de sesión publicada es de **7 días** en Hobby. Debe conservarse el login tras recarga/cierre dentro de sus condiciones; no prometer permanencia indefinida.
- El proveedor puede enlazar usuarios OAuth por **correo verificado** internamente; **esto NO autoriza** a vincular un usuario de Clerk con un perfil D1 y rol `admin` por coincidencia de email. Hacer un enlace explícito, con comprobación reciente de la identidad Google existente y prueba de control de la cuenta nueva.
- Guardar el vínculo `(issuer, external_subject, profile_id)` en tabla privada de D1, con unicidad y autorización por `profile_id` existente, sin crear perfiles ni copiar hashes PBKDF2. El rol se lee **siempre** de `profiles.role` y no de claims editables por el usuario.
- Validar tokens del proveedor mediante **firma, emisor, audiencia, expiración y JWKS**; nunca confiar en email, nombre o `user_metadata` recibidos del navegador. Exigir HTTPS y sesión propia separada del panel.
- La conexión futura sería una integración con tercero: antes de subir datos o activar cuentas reales se requiere aprobación del propietario, estudio de privacidad y comprobar que **nunca se crean cargos**.
- Si el proveedor rechaza registros / tiene una incidencia, el sitio público debe seguir visible y los datos D1 no deben modificarse.

## Trabajos completados sin nuevo servicio

- `cloudflare/qa-candidates/admin-console-*.js`: panel independiente y autenticación propia de ensayo.
- `cloudflare/qa-candidates/admin-activation-routes.js`: activación de administrador Google existente + correo, actualmente **fail-closed**; no se ha enviado un correo real.
- 62/62 pruebas integradas del panel con datos ficticios y bloqueo del hash costoso sin flag: https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43195984146.
- `cloudflare/backup_privado_local.py`: respaldo privado cifrado por GPG, SHA256 completo y verificación sin extraer fuera de la carpeta privada.
- Prueba de cifrado AES-256 con archivos **totalmente ficticios** y detección de contraseña incorrecta: https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43197482026.

## Fuentes oficiales consultadas

- Cloudflare Workers límites: https://developers.cloudflare.com/workers/platform/limits/
- Clerk Hobby: https://clerk.com/pricing
- Clerk flujo email/password personalizado: https://clerk.com/docs/guides/development/custom-flows/authentication/email-password
- Clerk vinculación social: https://clerk.com/docs/guides/configure/auth-strategies/social-connections/account-linking
- Auth0 planes: https://auth0.com/fr/pricing
- Firebase Spark: https://firebase.google.com/docs/projects/billing/firebase-pricing-plans

**Aún pendiente para fase 6:** proveedor/login compatible con plan $0 y consentido, respaldo REAL restaurado, conciliación, corte reversible y pruebas físicas pospublicación. No hacer compras ni tocar `bellaquitas.fr`.
