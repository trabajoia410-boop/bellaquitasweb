# Bellaquitas Fest — Acceso al panel sin cálculos de contraseña en Workers Free
**13/11/2026 · Fase 5 · candidato técnico, sin desplegar**

La experiencia solicitada sigue intacta: botón `Panel administrador` en la web pública → **nueva pestaña** `/administracion/` → inicio de sesión verdadero con **correo y contraseña** → editor tipo WordPress para textos, eventos, socios, sugerencias y galería.

El comprobador PBKDF2 propio de 600.000 iteraciones continúa **bloqueado** en Workers Free por el coste CPU estimado (~94 ms en Node frente a 10 ms por solicitud en el Free de Workers). **No reducir la seguridad ni activar `ADMIN_PASSWORD_RUNTIME_APPROVED` por estos ensayos.**

## Qué se ha creado realmente

- `cloudflare/qa-candidates/admin-oidc-verifier.js`: verificador OIDC de **ID tokens RSA/RS256** con firma criptográfica, JWKS pasado por el servidor (sin URL procedente de JWT), emisor y cliente exactos, `nonce` anti-repetición, caducidad, hora de emisión, `nbf`, `azp` y clave `kid` única. Resultado mínimo: proveedor + emisor + sujeto, sin email/roles/claims del navegador.
- `cloudflare/migrations/0006-admin-external-identity-candidate.sql`: esquema de vinculación privada `(provider,issuer,subject) → profile_id`, sin crear perfiles, sin asignar roles y sin vinculación automática por email. **No se aplicó a D1 real.**
- `cloudflare/test_admin_oidc_identity.mjs`: casos falsos firmados con claves RSA generadas por la prueba y D1 SQLite `:memory:`. Comprueban vinculación existente, no elevación de socio, revocación, firma alterada, JWT sin firma, emisor, audiencia, `nonce`, tiempos, `azp`, inyección de JWKS y proveedores cruzados.
- `.github/workflows/qa-admin-oidc-identity.yml`: CI únicamente local, sin iniciar sesión ni acceder a proveedores externos.

Pruebas aprobadas: https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43355074775

## Qué falta para tener un login real, y por qué sigue bloqueado

El código anterior **NO es un login desplegado** y no sustituye un flujo completo OAuth/OIDC:

1. El propietario elige y autoriza un proveedor con plan verificablemente gratuito sin tarjeta y sin escalado automático facturable; deben revisarse privacidad, límites de envío de emails, retención, bloqueo y posibles cargos. No se ha abierto ninguna cuenta.
2. Se crea una aplicación del proveedor y se implementa un **Authorization Code Flow con PKCE, state, nonce y callback HTTPS**. El backend obtiene el ID token del endpoint de tokens, nunca acepta uno arbitrario del navegador, y recibe JWKS exclusivamente de una URL fija del emisor (no de un token).
3. Un administrador original con **Google verificado recientemente** debe demostrar el control de su identidad y autorizar la **vinculación expresa** del nuevo `subject` a su `profile_id` de D1. No duplicar las dos cuentas existentes. La prueba rechaza a socios aunque tengan el mismo email.
4. Tras verificar el ID token, el Worker emite una sesión administrativa privada propia de una hora, `HttpOnly; Secure; SameSite=Strict`; verifica `role=admin` desde D1 en **cada solicitud**, y permite revocar el vínculo en D1. Nunca reutiliza una cookie de socio.
5. Registrar intentos, bloquear abusos, evitar fugas de tokens, probar rotación de claves, mantener Google actual durante transición, comprobar sesiones persistentes y salida; ensayar la CPU real, los costes y el plan de reversión. No publicar sin backups restaurables ni autorización final.

**Advertencia de seguridad:** un ID token OIDC válido no concede por sí solo una sesión administrativa, y el verificador aislado no realiza todavía el intercambio del código, la gestión de `state` ni la activación de cuentas. No utilizarlo como middleware de producción sin todos los pasos anteriores.

## Proveedores investigados; ninguno contratado

- [Clerk Hobby](https://clerk.com/pricing): el sitio oficial consultado en noviembre de 2026 describe plan gratuito sin tarjeta, hasta 50.000 usuarios mensuales retenidos, sesiones fijas de 7 días y límites funcionales. Correo/contraseña y social login son compatibles en principio. **Hobby no garantiza escalabilidad ilimitada ni todos los extras gratuitos**.
- [Documentación oficial: verificar tokens Clerk](https://clerk.com/docs/reference/backend/verify-token): aconseja verificar firma, emisor, destinatario/authorized party, JWKS y demás claims; recomienda `authenticateRequest` para un despliegue real. Este módulo propio es solo una prueba, no una sustitución certificada de su SDK.
- Auth0 Free es una opción adicional por estudiar, no seleccionada ni activada.

Este enfoque desplaza el cálculo costoso de contraseñas a un proveedor de identidad **solo si se acepta y se configura**. Hasta entonces no hay acceso nuevo con correo/contraseña en el dominio, no se han creado sesiones ni se ha enviado email alguno.

## Protección de respaldos privados

También se actualizó `cloudflare/phase6_readiness.py` para comprobar archivo de evidencias **0600** de propiedad del usuario (en POSIX), abierto sin seguir symlinks y con esquema de campos permitido; rechaza incluir campos extra como contraseñas o tokens. Ensayo aprobado:
https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43354536720

Esto NO reemplaza la exportación cifrada real de Supabase/Postgres, D1, Storage y R2 ni una restauración aislada. Esas tareas continúan pendientes.

**Conclusión:** fase 5 sigue abierta; `main`, Worker oficial, dominio, puntos y visitas reales permanecen intactos.
