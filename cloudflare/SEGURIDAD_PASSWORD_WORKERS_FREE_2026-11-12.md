# Bellaquitas Fest — Auditoría del coste de contraseñas en Workers Free

**Fecha:** 12/11/2026 · **Modo:** laboratorio aislado, sin autenticarse como usuario real y sin desplegar Worker.

## Hallazgo: bloqueo previo a puesta en producción

La implementación de acceso por correo del Worker utiliza `pbkdf2-chain6-sha256-v1`, seis fases secuenciales PBKDF2-HMAC-SHA256 de 100.000 iteraciones cada una, total **600.000 iteraciones**. El objetivo es proteger las contraseñas; no se permite debilitarlas sin análisis.

Cloudflare Workers **Free** permite **10 ms de CPU por petición** según sus límites publicados el **29 de octubre de 2026**. El exceso sostenido puede provocar error 1102 e impedir iniciar sesión.

Se creó `cloudflare/qa-candidates/bench-password-free.mjs` y se ejecutó en GitHub Actions usando Node 22 WebCrypto, con contraseña/salt FICTICIOS:

| Caso | Tiempo de ejecución (ms) | CPU del proceso (ms) |
|---|---:|---:|
| PBKDF2 una fase de 100.000 | 18,3 | 17,5 |
| PBKDF2 en seis fases de 100.000 | 93,7 | 94,7 |
| Segunda muestra seis fases | 92,4 | 92,5 |

**Fuente de la ejecución:** https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43193975322

**Advertencia:** son tiempos de Node/OpenSSL en un runner de GitHub, NO una medición del runtime Workers. No se debe afirmar que el login está definitivamente roto. Sin embargo, el resultado es suficientemente alto respecto de 10 ms como para **bloquear el despliegue de este hash** hasta validarlo o sustituirlo por un mecanismo compatible y seguro, sin adquirir el plan Paid.

**Medida aplicada al candidato:** el acceso `/administracion/api/login` requiere `ADMIN_PASSWORD_RUNTIME_APPROVED=yes`, además de las credenciales/rol admin. La vinculación inicial de email requiere **tres banderas**: `STAGING_MUTATIONS=enabled`, `ADMIN_EMAIL_ACTIVATION_ENABLED=yes` y `ADMIN_PASSWORD_RUNTIME_APPROVED=yes`. Estos permisos NO se han configurado en el Worker remoto; las pruebas los activan únicamente sobre D1 SQLite ficticia.

**No activar ninguna de esas banderas en Cloudflare real** hasta cerrar el problema y disponer de copia restaurable.

## Posibles vías gratuitas, todavía no aprobadas

1. Medir el coste real en un Worker **completamente aislado y sin datos reales**. Solo realizar un ensayo cuando esté claro que el presupuesto y las restricciones de despliegue lo permiten. Este paso no justifica desactivar el hash ni reducir su resistencia.
2. Evaluar un proveedor de autenticación administrada con modalidad gratuita estricta que realice la verificación costosa fuera de Workers, evitando almacenamiento de contraseñas en D1. Cualquier candidato debe respetar **cero cargos automáticos**, compatibilidad con usuarios existentes, privacidades, sesiones y capacidad de reversión. No migrar credenciales ni contratar servicios sin consentimiento.
3. Si la opción segura del plan Free se basa únicamente en Google OAuth y segundo factor, documentar que **NO cumple el requisito actual de escribir correo y contraseña**; solicitar aprobación del propietario antes de cambiar el flujo. Nunca simular un formulario de contraseña que no se comprueba.

No usar hashes rápidos sin KDF adecuada, no almacenar contraseñas en texto claro, no convertir un hash de contraseñas en token reutilizable ni desplazar secretamente el coste a los usuarios con un protocolo criptográfico improvisado.

## Activación de correo de los administradores existentes

Dos perfiles admin de D1 se vinculan a Google; cero tenían credenciales de correo verificadas en la última consulta de solo lectura.

Se implementó como **candidato NO desplegado**:

- `cloudflare/migrations/0004-admin-activation.sql`: tokens únicos, caducidad y cuotas, sin tocar roles.
- `cloudflare/qa-candidates/admin-activation-routes.js`: requiere sesión Google ADMIN nueva (máximo 5 min), protección de origen, bloqueo de escrituras, hasta tres solicitudes/hora con pausa de 3 minutos, correo enviado por proveedor configurado, enlace de 15 min y contraseña de al menos 12 caracteres.
- La activación consulta el `profile_id` de la identidad Google verificada y añade una credencial email **al mismo ID**. No usa el email para seleccionar ni crear el perfil.
- El token se almacena únicamente como SHA-256 en D1, se consume una sola vez y desaparece del URL del navegador al abrir el enlace.
- Se mantiene el mismo formato de hash de contraseña existente para interoperar con el código del login, pero **no puede habilitarse fuera de pruebas por el bloqueo de CPU**.

**Pruebas:** 44/44 casos de servidor y 18/18 casos Chrome de aceptación del panel, identidad Google, email sintético, enlace de un solo uso y no duplicación de perfiles. **62/62 aprobadas** en https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43195543967.

## Requisitos antes de fase 6

- Respaldos privados completos y comprobados de Supabase/Postgres/Auth, Storage, D1 y R2; restauración en entorno aislado.
- Resolución de autenticación conforme a **10 ms Free**, seguridad de contraseña y cero costes.
- Activar credenciales de cada administrador real de manera segura mediante pruebas controladas, sin pedir contraseñas en el chat ni compartir tokens.
- Conciliar cuentas, saldos, permisos y medios. Mantener reversión.
- Pruebas físicas iPhone/Samsung **después** de publicación, como acordó el propietario.

Documentación oficial: https://developers.cloudflare.com/workers/platform/limits/ y https://developers.cloudflare.com/workers/platform/pricing/.

**Estado:** ningún cambio ni pago sobre producción.


## Actualización de seguridad 12/11/2026 — sesión Google autenticada, no solo reciente

La auditoría encontró una vulnerabilidad **en el candidato, aún no desplegado**: comprobar que un administrador tuviera una identidad Google asociada y una sesión de menos de cinco minutos **no demostraba que esa sesión se hubiera iniciado mediante Google**. Una sesión reciente creada por otro proveedor para el mismo perfil podía cumplir la condición.

Se ha preparado una corrección que separa y atribuye el origen real de la sesión:
- `cloudflare/migrations/0005-auth-session-method.sql` añade `auth_sessions.auth_method` con valor por defecto **`unknown`** para sesiones antiguas. Nadie con una sesión preexistente obtiene automáticamente la condición de Google.
- `cloudflare/qa-candidates/auth-routes-admin-proof.js` etiqueta **`google` solo cuando el callback OAuth ha verificado ID token firmado, audiencia, nonce y subject**, y emite la sesión después de esa comprobación.
- `cloudflare/qa-candidates/admin-activation-routes.js` exige ahora **`auth_method='google'`**, sesión vigente y creada durante los últimos 300 segundos, además de perfil admin e identidad Google vinculada.
- Los ensayos prueban que sesiones `unknown`, `email` y sesiones Google caducadas **no pueden solicitar activación**. La migración nueva y el Worker modificado solo existen en la rama de auditoría.
- [Pruebas de aceptación: 73/73](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43198945838): 10 casos OAuth con JWT firmado ficticio y comprobación de método, 45 casos Worker completo y 18 comprobaciones Chrome.
- [Pruebas separadas de seguridad: 35/35](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43198959200): 10 casos Google y 25 casos de administración.

**Permanece bloqueada** la activación real por el coste CPU del hash frente a Workers Free, además de faltar respaldos reales restaurables. No se ha activado nada en producción ni enviado emails reales.
