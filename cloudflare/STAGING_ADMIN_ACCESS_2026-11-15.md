# Bellaquitas Fest — cierre de registros staging y auditoría de acceso admin (15/11/2026)

**Acción real aplicada a Cloudflare Worker de preparación** `bellaquitas-api-staging`. No implica activación del panel, publicación de `bellaquitas.fr`, edición de usuarios, ni cambios DNS.

## Situación previa y corrección en Cloudflare

Antes de intervenir, los 16 bindings del Worker staging incluían:

- `STAGING_MUTATIONS=disabled` (ediciones web, puntos y roles bloqueados).
- `ALLOW_NEW_ACCOUNTS=no` (nuevas cuentas Google bloqueadas).
- `EMAIL_AUTH_ENABLED=yes` (login por correo para cuentas ya existentes).
- **`EMAIL_REGISTRATION_ENABLED=yes`: alta de nuevos perfiles por correo abierta**, pese al bloqueo global Google.
- `ADMIN_EMAIL_LINK_ENABLED` no configurado: vínculo de correo administrativo no activo.

**Corrección efectuada:** se hizo PATCH de configuración solo a `bellaquitas-api-staging` para pasar **`EMAIL_REGISTRATION_ENABLED=no`**. Se conservaron los 16 bindings existentes mediante `type=inherit` para los otros 15 y se verificó que los 16 nombres/tipos continúan presentes, incluidos 5 secretos, D1 y las restantes banderas intactas.

**No se publicaron tokens ni se cambiaron contraseñas.** No se modificaron las opciones de registro/login de la web pública.

## Protección adicional para el próximo código de migración

`cloudflare/email-auth-routes.js` exige ahora **simultáneamente** `ALLOW_NEW_ACCOUNTS=yes`, `EMAIL_REGISTRATION_ENABLED=yes` y la infraestructura de correo verificada para el alta. Antes solo comprobaba la segunda bandera: una cuenta nueva por correo podía existir en staging mientras el flag Google estaba cerrado.

`cloudflare/test-email-registration-gate.mjs` prueba en memoria que el login existente puede permanecer operativo mientras los nuevos registros se deniegan y que la API falla antes de usar D1.

**Nota de versión:** esta segunda barrera de código está versionada **en la rama de migración**, pero todavía NO se ha desplegado en el Worker staging legado. Allí la primera barrera `EMAIL_REGISTRATION_ENABLED=no` está vigente. QA contiene un Worker independiente con código actualizado de la rama, pero tiene todos los accesos desactivados.

## Estado actual de las dos cuentas administradoras

Lectura agregada en D1 staging, sin acceder a correos ni identificadores:

| Dato | Número |
| --- | ---: |
| Perfiles administradores actuales | 2 |
| Vínculos Google de esos administradores | 2 |
| Credenciales email+contraseña ya vinculadas a administradores | **0** |
| Enlaces pendientes de vinculación administrativa | 0 |
| Sesiones de acceso reforzado admin | 0 |
| Credenciales correo del socio extra staging | 1 |
| Perfiles en staging | 7 |
| Total puntos disponibles | 1.999.998 |
| Visitas | 0 |

Por tanto, **las dos cuentas admin NO pueden iniciar sesión con correo y contraseña en Cloudflare todavía**. El siguiente paso válido es verificar individualmente el acceso Google y, tras reautenticación, vincular un correo y contraseña a sus perfiles existentes usando la confirmación de email. Jamás crear dos perfiles admin nuevos.

## Despliegue web del panel

El panel completo está versionado en la rama como `cloudflare/admin-console.js`, con CSP nonce, gestión desde otra pestaña y reautenticación reforzada del backend.

**El Worker staging actualmente publicado es una versión anterior:** responde `404` en `/administracion/`, aunque las tablas necesarias ya se hayan instalado en su base D1. La vista del panel sí está disponible en el Worker aislado de QA con autenticación desactivada:

`https://bellaquitas-api-qa.bellaquitas-fest-410.workers.dev/administracion/`

Esta diferencia impide dar por verificado un login administrador real en staging. No se redeplegó el Worker staging con código no validado ni se activaron ediciones.

## Protección y pruebas

- `cloudflare/test-staging-auth-closure.mjs`: comprueba el Worker staging real por HTTP: no aceptar nuevas cuentas de correo, no abrir enlace admin ni operaciones de socios anónimas; mantiene modo legado hasta desplegar el panel.
- `cloudflare/test-email-registration-gate.mjs`: test local que impone ambas banderas.
- El panel en QA sigue funcionando como vista previa pero sin credenciales, sesiones ni datos reales.
- `cloudflare/release-gates-2026-11-15.json`: la verificación de **los 2 logins administrativos reales** permanece expresamente en **FALSE**, y no se permite el corte final.

## Siguiente fase segura

1. Confirmar en CI que staging rechaza altas por correo y que no se alteraron perfiles/puntos.
2. Preparar el despliegue del panel completo primero sobre un Worker de ensayo sin secretos ni datos reales, incluyendo prueba de CSP, email, sesión, permisos y cierre de sesión.
3. Preparar, antes de actualizar el Worker staging, un respaldo reciente con restauración verificada y revisar cómo heredar de forma segura el binding D1 y los secretos existentes.
4. Probar de manera interactiva las dos cuentas Google reales y, **solo tras verificar los prerequisitos**, vincularles correo mediante confirmación segura.
5. No tocar `bellaquitas.fr`, GitHub `main`, DNS ni puntos. Mantener PR #3 en borrador.

**Separación:** panel preparado en rama/QA ≠ panel desplegado en staging ≠ panel autorizado en el dominio público.

## Resultado final de QA automático

La prueba HTTP contra `bellaquitas-api-staging` confirmó las siguientes condiciones: el registro de email aparece **desactivado**, `POST /v1/auth/email/register` con solicitud vacía no crea cuenta, y no es posible gestionar socios de forma anónima. El endpoint `/administracion/` del Worker de preparación todavía responde `404`: se mantiene **como limitación identificada**, no como un éxito ficticio del panel.

Los tests reconocen las respuestas denegadas `401/403/404/405/503` según la ruta legada y siguen fallando si una ruta de escritura responde correctamente a un visitante anónimo. La vista previa de QA verifica el panel con CSP, pero no autoriza autenticación.

- [QA migración sin despliegue — verde](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43683919169).
- [Cloudflare migration safe QA — verde](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43683919142).

**No cambiar un bloqueo de acceso por un chequeo verde:** aún faltan el despliegue revisado del panel a staging y las pruebas reales de los dos administradores.
