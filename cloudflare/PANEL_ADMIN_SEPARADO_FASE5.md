# Bellaquitas Fest — Panel de administración independiente

**Fase:** 5 de 6 · **Estado:** candidato de código, validado con datos ficticios, **NO desplegado**  
**Destino previsto cuando se apruebe la migración:** `https://bellaquitas.fr/administracion/`  
**Acceso directo a la edición:** `https://bellaquitas.fr/administracion/?seccion=web`

## La experiencia para el administrador

Cuando el administrador pulsa **Panel de administrador** o **Editar web** en la página pública, se abre **otra pestaña**. La página de Bellaquitas Fest, sus vídeos, su menú y el diseño público siguen en la pestaña original.

La pestaña nueva presenta una pantalla independiente con **correo y contraseña**. Ni un socio ni el personal de puerta pueden entrar. No basta con iniciar sesión en la web pública ni con conocer la dirección. El servidor comprueba la contraseña **y** el rol administrador.

Una vez dentro, el administrador tiene un panel de trabajo similar al flujo de WordPress (sin instalar WordPress, plugins de pago ni contratar hosting adicional):

1. **Escritorio:** resumen de eventos, premios, socios y sugerencias.
2. **Editar página:** portada, secciones, textos, enlaces e idiomas ES/FR; borrador y publicación diferenciados, y configuración avanzada opcional.
3. **Eventos:** crear, editar, ocultar, publicar o borrar eventos; nombres y descripciones ES/FR; fotografías.
4. **Premios y ventajas:** recompensas y promociones.
5. **Socios y permisos:** consulta de roles, puntos, visitas; cambios requieren motivo y auditoría del servidor.
6. **Comunidad:** sugerencias, galería Bellaquitas Moments, creación/publicación de álbumes y subida, visualización y borrado de imágenes.
7. **Historial:** operaciones de socios, puntos, visitas y cambios administrativos.

La interfaz es adaptable a escritorio y móvil. Los botones de "Editar web" abren directamente la sección del editor **después de autenticarse**.

## Separación y seguridad implementadas en el candidato

- Ruta distinta `/administracion/` con HTML, CSS y JavaScript propios, no renderizada dentro de la SPA pública.
- Cookie administrativa separada `__Host-bf_admin` con `Secure; HttpOnly; SameSite=Strict` y vida máxima de 1 hora **también en D1**. Las cookies públicas de socios no dan acceso al panel.
- Comprobación `role=admin` en **cada petición** privada, no solo al mostrar botones.
- Reutiliza verificaciones del servidor original: permisos, origen/CSRF, R2 y `STAGING_MUTATIONS`.
- `noindex`, `no-store`, CSP, prohibición de iframe y de acceso a cámara/micrófono desde este panel.
- Cierre de sesión revoca la sesión admin y preserva la sesión pública, si existía.
- No hay credenciales ni claves administrativas en el repositorio.

## Archivos relevantes de la rama de auditoría

- `cloudflare/qa-candidates/admin-console.html` — pantalla de acceso y panel.
- `cloudflare/qa-candidates/admin-console.css` — diseño.
- `cloudflare/qa-candidates/admin-console-browser.js` — funciones del editor, eventos, socios y comunidad.
- `cloudflare/qa-candidates/admin-console-ui.js` — bundle estático.
- `cloudflare/qa-candidates/admin-console-routes.js` — autenticación, sesiones y APIs del panel.
- `cloudflare/qa-candidates/bellaquitas-api-staging-admin.js` — entrypoint candidato.
- `app.js` en **rama de auditoría** — enlaces `target=_blank` y `rel=noopener noreferrer`, sin abrir editor antiguo en la SPA.
- `cloudflare/assemble-admin-candidate.mjs` — construye la copia con **los HTML/CSS/idiomas/vídeos originales intactos**; rechaza assets empaquetados desactualizados.
- `cloudflare/test_admin_console.mjs` y `cloudflare/test_admin_console_browser.mjs` — pruebas automáticas.

## Resultados de la prueba de aceptación

**51 controles aprobados en una ejecución:**

- **36/36** rutas Worker, permisos, QR, contraseña de administrador, sesión independiente, eventos y fotografías privadas con SQLite y R2 ficticios.
- **15/15** comprobaciones en Chrome: pantalla de login, escritorio, editor ES/FR, borradores, publicar, eventos, socios, galería, subir foto, borrar foto, publicar álbum, cerrar sesión y editor móvil.

[Ejecución CI de aceptación](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43147872789)

**Estos ensayos usan cuentas y archivos inventados**. No son pruebas con la base D1 de socios reales, ni demuestra que un administrador real ya pueda acceder en el dominio oficial.

## Bloqueo de activación indispensable: contraseñas admin

Comprobación de solo lectura en Cloudflare D1: existen **2 perfiles con rol administrador**, pero actualmente **0** cuentan con credenciales de correo/contraseña **verificadas**.

Por tanto **NO publicar el panel y afirmar que el propietario ya puede entrar**. Antes de la migración:

1. Identificar a los administradores existentes dentro del sistema privado mediante una sesión ya autenticada y verificada, sin publicar sus emails en GitHub.
2. Habilitar un mecanismo de **activación por invitación de un solo uso** para que cada administrador **establezca su propia contraseña** tras verificar el control de su correo.
3. Vincular esa credencial al ID **existente**, sin crear otro perfil, convertir automáticamente a un socio en admin, reiniciar puntos ni modificar roles.
4. Aplicar caducidad breve, un solo uso, límites de intentos y respuesta genérica; registrar la acción de seguridad.
5. Probar con identidades **totalmente ficticias** y comprobar que recupera acceso sin modificar cuentas existentes.
6. Verificar que el coste del hash y las funciones de correo encaja en **Workers Free / Resend Free**, sin activar planes de pago.

No solicitar la contraseña real del administrador por chat, GitHub, capturas ni a través de tareas automáticas.

## Pendiente antes de fase 6

- **Copia real privada, cifrada y restaurable** de Postgres Supabase, Supabase Storage, D1 y R2. La herramienta de respaldo está preparada, pero no se ha ejecutado una exportación real.
- Auditoría final del esquema de hash de contraseñas y límites de CPU del plan gratuito.
- Activación segura de credenciales de las cuentas admin originales.
- Última conciliación de perfiles, permisos, textos, vídeos, QR, puntos y visitas.
- Publicación controlada y reversible del nuevo sistema bajo el dominio oficial. El dominio **no se ha cambiado**.
- Pruebas en iPhone Safari y Samsung **inmediatamente después de publicar**, según la decisión del propietario.

**En ningún momento se deben alterar las cuentas, los puntos y las visitas reales para ensayos.**


## Actualización 12/11/2026 — Activación de las cuentas existentes

Se creó un procedimiento **candidato, aún inactivo** para permitir al administrador Google existente activar su contraseña sin crear usuarios duplicados:
1. Iniciar sesión de nuevo en Google como administrador.
2. En menos de 5 minutos pedir un enlace a un email que controla.
3. Recibir enlace de un solo uso, válido 15 minutos, con cuota máxima de 3 solicitudes por hora.
4. Elegir contraseña de 12 caracteres o más; el servidor vincula la credencial al **mismo ID de perfil Google** después de comprobar el token y rol.
5. Volver al panel de login independiente.

La URL elimina el token del historial al abrirla, y las cookies de socios no autorizan la operación. La primera petición exige Google reciente, el correo se comprueba con Resend, y el enlace no permite cambiar ningún rol.

**Pruebas realizadas: 44/44 integraciones y 18/18 pruebas de Chrome = 62/62** [ejecución](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43195543967).

**Bloqueo de seguridad/coste:** el hash PBKDF2 actual cuesta ~94 ms de CPU en laboratorio Node, frente a **10 ms de CPU** del plan Workers Free. El resultado no mide el Worker real pero no permite considerarlo apto para producción. Se exige `ADMIN_PASSWORD_RUNTIME_APPROVED=yes` para iniciar sesión admin, además de `ADMIN_EMAIL_ACTIVATION_ENABLED=yes` y `STAGING_MUTATIONS=enabled` para activar credenciales. **Ninguna de estas habilitaciones se ha aplicado al servicio desplegado.** No debilitar contraseñas ni cambiar de plan sin autorización.

Más detalles: `cloudflare/SEGURIDAD_PASSWORD_WORKERS_FREE_2026-11-12.md`.


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
