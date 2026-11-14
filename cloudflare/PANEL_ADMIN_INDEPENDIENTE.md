# Bellaquitas Fest — panel privado en pestaña separada (fase 5)

**Fecha:** 11 de noviembre de 2026  
**Estado:** implementado y probado en rama de auditoría. **NO desplegado** en Cloudflare ni en bellaquitas.fr.

## Experiencia pedida

El sitio público conservará exactamente la misma estética, cabecera, dos vídeos y navegación. Cuando un administrador pulse:

- **Panel de administrador** → se abrirá **otra pestaña** con `https://bellaquitas.fr/administracion/` cuando se publique la migración.
- **Editar web** → se abrirá otra pestaña con `https://bellaquitas.fr/administracion/?seccion=web`. Tras iniciar sesión aparecerá directamente el editor.

Los enlaces usan `target="_blank"` con `rel="noopener noreferrer"`. Los antiguos destinos internos `#/panel` y `#/editor` ya no mostrarán el panel en la aplicación pública al desplegar el cambio; enviarán a «Mi espacio». El código de la web pública solo modifica esas acciones administrativas, **no su diseño**, y está en la rama de pruebas.

## Seguridad del nuevo acceso

- Nueva página HTML/CSS/JavaScript, sin reutilizar la cabecera ni la barra de navegación pública, compatible con móvil y escritorio.
- Formulario de email y contraseña; se **verifica en Cloudflare contra correo confirmado y hash almacenado**, y **después** se comprueba el rol `admin` en D1.
- La cookie normal de socio `__Host-bf_session` **nunca autoriza la consola**.
- Cookie independiente `__Host-bf_admin`, con `Secure`, `HttpOnly`, `SameSite=Strict`, `Path=/`, duración máxima de **1 hora**, también limitada en la D1.
- El nuevo panel verifica rol admin en cada petición; se rechazan sesiones inexistentes, roles socio/puerta y peticiones mutadoras de origen externo.
- No almacena contraseñas en JavaScript, cookies accesibles por JS ni almacenamiento local; el formulario solicita nuevamente acceso al abrir una pestaña nueva.
- Logout del panel revoca solo su sesión y no cierra la cuenta normal del sitio.
- Se reutilizan las mismas rutas protegidas de catálogo/editor/socios y la condición `STAGING_MUTATIONS` del Worker existente. **El Worker remoto sigue con escrituras bloqueadas.**
- Cabeceras `noindex`, protección de frame `DENY`, `Cache-Control: no-store` y política CSP; no se carga JavaScript de terceros.

## Funciones del nuevo panel

1. **Escritorio** — indicadores y accesos rápidos.
2. **Editar página** — secciones de portada, experiencia, eventos, ventajas, preguntas, CTA y cabecera. Editar en ES/FR, guardar **borrador** y publicar por separado, sin reconstruir el diseño.
3. **Eventos** — crear, modificar, publicar, ocultar o borrar; descripción ES/FR y subida de fotografía JPG/PNG/WebP.
4. **Premios y promociones** — alta, modificación, visibilidad y borrado de catálogos.
5. **Socios y permisos** — listar socios y actualizar nombre, rol, puntos y visitas solo mediante operación auditada con motivo.
6. **Comunidad** — revisar sugerencias; crear, publicar, ocultar o borrar álbumes de Bellaquitas Moments, subir/borrar fotografías.
7. **Historial** — consultar cambios de administración y actividad de puntos/visitas.
8. **Cerrar sesión** — independiente de la sesión pública.

El diseño es una interfaz oscura y dorada tipo CMS, inspirada en la comodidad de WordPress sin depender de WordPress ni contratar hosting adicional.

## Pruebas finalizadas, con datos ficticios y sin servicios externos

- **13/13 pruebas del Worker completo y correo/contraseña sintéticos**: login válido/inválido, rol admin, separación de cookies, sesión de 1 hora, protecciones CSRF, escrituras bloqueadas y operaciones aisladas. https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43119060936
- **11/11 recorridos de Chrome en escritorio y móvil**: pantalla de login, escritorio de siete secciones, borradores, publicación ES/FR, creación de eventos, actualización de socio ficticio, comunidad y logout. https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43119061223
- `node --check app.js` también aprobado: los enlaces de la web pública abren nueva pestaña.
- Las suites del Worker de producción y diseño original siguen en la rama sin cambiar `main`.

### Código de la nueva consola
- `cloudflare/qa-candidates/admin-console-routes.js`: rutas y permisos.
- `cloudflare/qa-candidates/admin-console.html`: página independiente y login.
- `cloudflare/qa-candidates/admin-console.css`: diseño adaptado al móvil.
- `cloudflare/qa-candidates/admin-console-browser.js`: comportamiento del editor y catálogos.
- `cloudflare/qa-candidates/admin-console-ui.js`: recursos empaquetados para el Worker.
- `cloudflare/qa-candidates/bellaquitas-api-staging-admin.js`: entrypoint candidato que registra la consola sin tocar el Worker desplegado.
- `app.js` (solo rama auditoría): los enlaces admin de la web pública cambian a pestañas nuevas.

**La consola NO está todavía disponible en el dominio**: hasta la fase 6, el Worker remoto no contiene estas rutas. La actualización del snapshot del renderer del espejo también forma parte del futuro empaquetado de despliegue.

## Activación del email y contraseña reales: bloqueo pendiente

**Verificado en D1:** dos perfiles tienen rol admin, pero actualmente **ninguno tiene una credencial de correo verificada** en `auth_email_credentials`. La cuenta de email existente pertenece a un socio de pruebas. Por ello, **el formulario no podría autenticar hoy a ninguno de los dos administradores reales**.

Antes de la publicación hay que implementar y verificar un procedimiento seguro para vincular una dirección de email **comprobada** a un **ID de administrador existente**, con confirmación por correo y establecimiento de contraseña. No crear otro perfil ni convertir un socio en admin, no copiar contraseñas de Google/Supabase y no guardar credenciales en el chat o en GitHub.

Este paso debe incluir rate limit, verificación de titularidad de la cuenta Google administradora, prueba del email de confirmación y revisión de CPU del hash en Workers Free; **no pagar por desbloquear la función**.

## Fases

- **Fase 5 (actual):** código y tests de consola aprobados; todavía faltan activar credenciales admin verificadas, resolver seguridad de contraseñas, respaldos privados reales y preparar reversión.
- **Fase 6:** publicar nuevo backend en bellaquitas.fr con la consola incluida, sin cambiar la apariencia de la web pública. Solo después, según la decisión del propietario, probar con iPhone/Samsung físicos.
- **No desplegar antes** de cumplir los requisitos de seguridad y respaldo. `main`, DNS, producción, puntos y visitas siguen intactos.
