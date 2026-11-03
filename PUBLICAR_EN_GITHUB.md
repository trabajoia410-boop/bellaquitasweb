# Cómo subir Bellaquitas Fest a tu GitHub

**Repositorio que has creado:** https://github.com/trabajoia410-boop/bellaquitasweb

Esta carpeta ya está preparada para **GitHub Pages**. No necesitas instalar programas para seguir estos pasos.

## Paso 1. Subir los archivos al repositorio

1. Descarga el ZIP que acompaña a esta entrega y **descomprímelo** en tu ordenador.
2. Abre tu repositorio: [bellaquitasweb](https://github.com/trabajoia410-boop/bellaquitasweb).
3. Si el repositorio está vacío, pulsa **uploading an existing file**. Si ya tiene archivos, pulsa **Add file → Upload files**. Debes entrar en tu cuenta de GitHub para poder hacerlo.
4. Arrastra **el contenido que está dentro de la carpeta descomprimida**, incluyendo `index.html`, `app.js`, `styles.css`, `config.js`, `assets/`, los archivos SQL y las guías. **No subas solo el ZIP**: GitHub Pages necesita ver `index.html` en la raíz del repositorio.
5. Abajo, escribe un mensaje como `Añadir Bellaquitas Fest con editor web` y pulsa **Commit changes**.
6. Comprueba que `index.html` aparece al lado de `README.md` en la pantalla principal del repositorio, no dentro de una carpeta adicional.

**Si ya tienes otros archivos en `bellaquitasweb`:** revisa antes de sobrescribirlos. Guarda una copia de los archivos anteriores si lo necesitas.

## Paso 2. Activar la web pública (GitHub Pages)

1. En GitHub abre tu repositorio y entra en **Settings → Pages**.
2. En **Build and deployment**, elige **Deploy from a branch**.
3. Elige la rama `main` (o la rama donde subiste los archivos) y la carpeta **`/(root)`**. Pulsa **Save**.
4. Cuando GitHub termine de publicar, tu web debería estar en:

   **https://trabajoia410-boop.github.io/bellaquitasweb/**

   Esta es la dirección esperada si los ajustes, el usuario y el nombre del repositorio son los indicados. Confírmala en **Settings → Pages**. No implica que la página ya esté publicada en este momento.

## Paso 3. Hacer que las cuentas, Google y el editor funcionen

GitHub Pages muestra archivos estáticos; **no guarda usuarios ni cambios por sí mismo**. Para el inicio de sesión, los eventos, las fotos y el botón **Publicar cambios** necesitas configurar Supabase.

1. Crea o abre tu proyecto en [Supabase](https://supabase.com/).
2. En Supabase → **SQL Editor**:
   - Si el proyecto es nuevo, ejecuta primero `supabase.sql` y luego `INSTALAR_EDITOR_WEB.sql`.
   - Si ya has usado una versión previa, ejecuta la ampliación `AMPLIAR_PANEL_ADMIN.sql` **solo si aún no la aplicaste**, y después `INSTALAR_EDITOR_WEB.sql`. Lee los comentarios de cada SQL antes de ejecutarlo.
3. Edita `config.js` en tu repositorio y guarda la URL y **clave pública** (publishable/anon) de tu proyecto Supabase. Puedes rellenar también `siteUrl` con la dirección GitHub Pages de arriba. **Nunca publiques** la clave `service_role`, una clave secreta de Google ni contraseñas.
4. En Supabase → **Authentication → URL Configuration**, configura **Site URL** con `https://trabajoia410-boop.github.io/bellaquitasweb/` y añade como **Redirect URLs**:
   - `https://trabajoia410-boop.github.io/bellaquitasweb/`
   - `https://trabajoia410-boop.github.io/bellaquitasweb/?recuperar=1`
   - `https://trabajoia410-boop.github.io/bellaquitasweb/?acceso=google`
5. Para el acceso con Google, activa **Authentication → Providers → Google** con un cliente OAuth configurado en Google Cloud. Copia exactamente la URL de devolución de llamada que muestre Supabase a los **Authorized redirect URIs** de Google Cloud. El secreto de Google se guarda solo en Supabase. Sigue la guía `README.md`.
6. Crea tu propia cuenta desde la web. Desde el SQL Editor de Supabase autoriza **solo esa cuenta** como administradora (las cuentas públicas siempre empiezan como socios). Consulta `GUIA_PANEL_FACIL.md`.
7. Vuelve a la web, inicia sesión como administrador y pulsa **✎ Editar web**. Después de publicar, los visitantes verán el cambio.

## Actualizar la web más adelante

- **Textos, modelos, orden de secciones, eventos, premios o promociones:** modifica directamente desde el **panel administrador** y publica los cambios. **No necesitas resubir el código a GitHub.**
- **Cambiar programación, funciones o diseño del código:** sube los archivos nuevos a GitHub con otro commit. GitHub Pages actualizará la web cuando se publique el cambio de código.

## Si algo no funciona

- **Aparece un error 404:** comprueba que `index.html` está en la raíz y que Pages publica la rama correcta.
- **Los botones de registro no guardan cuentas:** revisa `config.js`, la base de datos de Supabase y las URL de redirección.
- **Google no deja iniciar sesión:** revisa la configuración OAuth y las URL exactas en Google Cloud y Supabase.
- **No aparece «Editar web»:** inicia sesión como administrador real y revisa el rol en Supabase.
- **No se guarda el borrador:** ejecuta `INSTALAR_EDITOR_WEB.sql` y revisa la consola/errores de Supabase.

**Nota:** este paquete no afirma haber sido subido a GitHub. Solo aparecerá en tu repositorio una vez que completes los pasos de subida.