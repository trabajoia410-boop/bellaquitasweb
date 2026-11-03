# Bellaquitas Fest — web con editor visual para administradores

La web incluye los botones **Iniciar sesión**, **Crear cuenta** y **Continuar con Google**. Si entras con una cuenta autorizada como **administrador**, aparece arriba **✎ Editar web**. Puedes cambiar textos, imagen principal, modelos visuales, orden y visibilidad de secciones, previsualizar móvil y ordenador, **guardar un borrador privado** y **publicar los cambios**.

Para eventos, premios y promociones, el panel tiene opciones de **Crear, Editar, Publicar, Ocultar y Eliminar**. No se incluyen cuentas ni registros de prueba.

**Guías recomendadas:**

- **`PUBLICAR_EN_GITHUB.md`**: cómo subir los archivos a [bellaquitasweb](https://github.com/trabajoia410-boop/bellaquitasweb), activar GitHub Pages y conectar las cuentas reales.
- **`GUIA_EDITOR_VISUAL.md`**: cómo cambiar la página desde el botón **✎ Editar web**, con modelos y vista previa, aunque no sepas programación.
- **`GUIA_PANEL_FACIL.md`**: cómo crear y gestionar eventos, premios y promociones.

**Configuración necesaria:** conecta tu Supabase público en `config.js`; en un proyecto nuevo ejecuta **`supabase.sql` y después `INSTALAR_EDITOR_WEB.sql`**. En uno anteriormente instalado, ejecuta **`AMPLIAR_PANEL_ADMIN.sql`** si aún no se hizo y después **`INSTALAR_EDITOR_WEB.sql`**. Los controles de acceso se aplican mediante políticas RLS. El botón de publicar cambios requiere Supabase: GitHub Pages por sí solo no guarda cambios ni cuentas.

---

# Bellaquitas Fest — Web con panel administrador fácil

**Nueva versión:** el administrador tiene un panel con accesos grandes para **Crear evento**, **Añadir premio**, **Crear promoción** y **Editar mi web**. Se pueden añadir fotos desde el móvil, editar, publicar, ocultar y borrar contenidos, con confirmación y formularios sencillos. El panel es adaptable a móvil y ordenador. Los nuevos contenidos se guardan en Supabase; no incluye datos de demostración.

**Importante para activar el panel:** en un proyecto Supabase nuevo, ejecuta `supabase.sql` y después `INSTALAR_EDITOR_WEB.sql`. Si ya configuraste Supabase con una versión anterior de Bellaquitas Fest, ejecuta **`AMPLIAR_PANEL_ADMIN.sql` (si falta) y luego `INSTALAR_EDITOR_WEB.sql`** desde SQL Editor para añadir campos, permisos de borrado, textos editables y almacenamiento público de fotos. No borra tus cuentas existentes. Luego entra con una cuenta de `role='admin'`. Consulta **`GUIA_PANEL_FACIL.md`** para aprender a usarlo paso a paso.

**Límite:** las promociones se muestran, pero no entregan puntos automáticamente. Las reglas de puntos y la asignación del administrador siguen protegidas en el servidor. Para registros, sesión por Google y correos reales necesitas configurar Supabase y Google con tus propias credenciales.

---

# Bellaquitas Fest — Inicio de sesión, registro y Google

La web incluye **dos botones visibles, «Iniciar sesión» y «Crear cuenta»**, tanto en ordenador como en móvil. Los formularios permiten registro con nombre, correo y contraseña, confirmación de contraseña, inicio/cierre de sesión y recuperación por correo. Además, en las páginas de acceso y registro existe **«Continuar con Google»** para iniciar sesión o registrarse mediante Google sin compartir la contraseña de Google con la web. Cada alta real comienza con cero puntos y cero visitas. No se incluyen cuentas, eventos, premios ni movimientos de demostración.

**Estado de esta entrega:** la interfaz y las llamadas al servicio de autenticación están implementadas, pero `config.js` se entrega **sin credenciales de proyecto**. Hasta que conectes tu propio Supabase, los botones abren sus formularios pero las acciones de envío y el acceso con Google quedan deshabilitados y aparece un aviso de configuración. Esto evita crear cuentas ficticias o simular un inicio de sesión que no sea real.

## Cómo activar el registro y el inicio de sesión reales

1. Entra en https://supabase.com y crea un proyecto (o usa uno de tu propiedad si ya existe). Las cuentas registradas estarán en **Authentication → Users**.
2. En ese proyecto, abre **SQL Editor** y ejecuta `supabase.sql` **en una base de datos nueva o revisada por ti**. Instala el perfil automático de usuario y las reglas de permisos sin crear cuentas de ejemplo.
3. Abre **Project Settings / Connect / API Keys** según la versión del panel y copia la **Project URL** y la **publishable key** (o clave pública `anon`). Edita `config.js`:

   ```js
   window.BELLAQUITAS_CONFIG = {
     supabaseUrl: 'https://TU-PROYECTO.supabase.co',
     supabaseAnonKey: 'TU_CLAVE_PUBLICA',
     siteUrl: 'https://TU-WEB.es'
   };
   ```

   Utiliza **solo** una clave pública. **No incluyas nunca** `service_role`, `secret key`, tokens de sesión ni contraseñas en el ZIP o el navegador.
4. En **Authentication → Providers → Email**, habilita los registros con correo y contraseña. Es recomendable mantener activada la **confirmación de email**. Configura el servicio de envío de correos y sus límites según tus necesidades reales; el correo predeterminado de pruebas de Supabase no es adecuado para grandes cantidades de usuarios.
5. En **Authentication → URL Configuration**, introduce la URL pública exacta del sitio como **Site URL** y agrégala a **Redirect URLs**. Añade también la misma URL con el parámetro `?recuperar=1` como retorno para recuperación de contraseña, por ejemplo:
   - `https://tuweb.es/`
   - `https://tuweb.es/?recuperar=1`

   Si publicas en una subcarpeta o como `index.html`, adapta ambas URL a la ubicación real. Los enlaces de confirmación del registro y los de recuperación vuelven a esa misma página.
6. Publica los archivos en un sitio **HTTPS** (Netlify, GitHub Pages, Cloudflare Pages u otro alojamiento estático). Un archivo abierto con `file://` no es una URL válida para los enlaces de confirmación de correo de producción.
7. Abre la web y prueba **Crear cuenta → confirmación por correo → Iniciar sesión → Mi espacio → Cerrar sesión → Recuperar contraseña**. Las tablas de socios deben estar vacías antes del primer alta real.
8. Para asignar permisos de administración, crea primero tu cuenta real y después ejecuta, desde **SQL Editor** (nunca desde JavaScript público):

   ```sql
   update public.profiles set role = 'admin'
   where id = 'UUID-REAL-EN-AUTH-USERS';
   ```

   Para un trabajador autorizado, asigna el rol `puerta` al UUID correspondiente. Cierra y vuelve a iniciar sesión después de cambiar el rol.


## Activar «Continuar con Google»

Además de completar la configuración básica de Supabase descrita arriba, debes configurar el proveedor Google. **El botón ya está incorporado y usa OAuth real; no funcionará hasta activar el proveedor**. No hacen falta correos o perfiles ficticios.

1. En [Google Cloud Console](https://console.cloud.google.com/), abre **Google Auth Platform** y configura la pantalla de consentimiento/branding según los requisitos de Google. En **Clients**, crea un cliente OAuth 2.0 de tipo **Web application**.
2. En **Authorized JavaScript origins**, añade el origen real de tu web, por ejemplo `https://tuweb.es` (sin rutas).
3. En tu proyecto Supabase entra en **Authentication → Providers → Google**. Copia la **Callback URL** que aparece en ese panel, normalmente `https://TU-PROYECTO.supabase.co/auth/v1/callback`. Añádela en Google Cloud a **Authorized redirect URIs**. **No pongas ahí la dirección de la página web**: Google vuelve primero a Supabase.
4. Copia el **Google Client ID** y el **Google Client Secret** en el proveedor Google de Supabase y actívalo. El **Client Secret** debe quedarse en el servidor de Supabase: **no lo pegues en `config.js` ni lo publiques en el ZIP**.
5. En Supabase, en **Authentication → URL Configuration**, incluye la web en la **Site URL**, y registra en **Redirect URLs** su URL exacta con el parámetro de retorno `?acceso=google`:

   - `https://tuweb.es/`
   - `https://tuweb.es/?acceso=google`

   Si la web está en una subcarpeta, el retorno también lo estará: `https://tuweb.es/bellaquitas/?acceso=google`. La ruta debe coincidir exactamente con la de publicación. Conserva también los retornos de correo y recuperación (`?recuperar=1`) que se documentan arriba.
6. Si vas a **instalar en un proyecto Supabase nuevo**, usa el `supabase.sql` actualizado antes del primer registro: aprovecha el nombre que envía Google para el perfil. Si ya instalaste la versión anterior del SQL, ejecuta **`ACTUALIZAR_PERFIL_GOOGLE.sql`** una vez desde SQL Editor, sin modificar las cuentas existentes.
7. Publica en HTTPS, prueba «Continuar con Google» en **Iniciar sesión** y **Crear cuenta**: se abrirá Google, el usuario autorizará, regresará a Bellaquitas Fest y accederá a su espacio. Al registrarse por primera vez, será socio sin puntos ni visitas, igual que con correo y contraseña.

**Importante:** Google puede exigir publicación o verificación de la pantalla de consentimiento para permitir acceso a cualquier persona. En modo de prueba, el inicio de sesión de Google puede estar limitado a usuarios de prueba autorizados por ti. Estas acciones se realizan en las consolas de Google y Supabase, no se activan con el ZIP.

- [Guía oficial de Supabase: Google](https://supabase.com/docs/guides/auth/social-sign-in/auth-google)
- [Guía oficial: Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)

## Rutas de la web

- `#/` — página principal con los botones.
- `#/acceso` — formulario «Iniciar sesión».
- `#/registro` — formulario «Crear cuenta», también con Google.
- `#/acceso` y `#/registro` — botón «Continuar con Google» (redirige al sitio de Google a través de Supabase).
- `#/recuperar` — solicitar enlace de recuperación.
- `#/restablecer` — cambiar contraseña después de abrir un enlace válido.

## Seguridad y limitaciones

- El control de acceso se realiza con Supabase Authentication y políticas RLS del archivo `supabase.sql`. No existe un registro falso guardado solamente en el navegador.
- Los nuevos usuarios reciben el rol `socio`, sin poder elegirse administrador desde el registro público.
- El ZIP no puede crear, consultar ni borrar usuarios de una instancia Supabase externa sin conectarlo a tu proyecto. Tampoco elimina perfiles que ya existan en otro servidor.
- La persistencia entre dispositivos requiere el proyecto de Supabase activo y accesible. Los correos de confirmación y recuperación dependen de su configuración de Auth/SMTP.
- Antes del lanzamiento público, verifica las reglas RLS, añade la información legal y de privacidad aplicable y prueba las cuentas con un entorno de prueba aislado.

### Archivos

- `index.html`: página y navegación.
- `styles.css`: aspecto adaptable a ordenador y móvil.
- `app.js`: registro, inicio de sesión, recuperación, sesiones y resto de la aplicación.
- `config.js`: punto de conexión (vacío por seguridad).
- `supabase.sql`: tablas, roles y reglas de seguridad, sin datos ficticios.
- `ACTUALIZAR_PERFIL_GOOGLE.sql`: ajuste opcional de nombres para proyectos Supabase ya instalados.
- `assets/google-g.svg`: icono local del botón de Google.
- `GUIA_PANEL_FACIL.md`: guía sencilla de uso del administrador.
- `AMPLIAR_PANEL_ADMIN.sql`: instalación adicional para una base de datos anterior sin perder los datos.
- `INSTALAR_EDITOR_WEB.sql`: borradores privados y configuración de la portada.
- `GUIA_EDITOR_VISUAL.md`: uso del botón superior para editar y publicar.
- `PUBLICAR_EN_GITHUB.md`: subida al repositorio y publicación con GitHub Pages.
- `assets/`: logo e iconos.