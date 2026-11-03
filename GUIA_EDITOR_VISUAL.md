# Guía fácil: «Editar web» (solo administradores)

Esta guía está pensada para quienes **nunca han editado una web**. No hace falta saber programación.

## Primero: preparar la función (solo una vez)

La página necesita un proyecto Supabase real. El editor no guarda cambios si Supabase no está conectado.

1. Rellena **solo** la URL y la clave pública de Supabase en `config.js`.
2. Si la base de datos es nueva, ejecuta `supabase.sql` **y a continuación** `INSTALAR_EDITOR_WEB.sql` en Supabase → SQL Editor.
3. Si la base de datos ya estaba instalada con una versión anterior de Bellaquitas Fest, ejecuta `AMPLIAR_PANEL_ADMIN.sql` **y a continuación** `INSTALAR_EDITOR_WEB.sql`. Si ya ejecutaste la ampliación anteriormente, basta con `INSTALAR_EDITOR_WEB.sql`.
4. Registra tu cuenta real y asígnale el rol `admin` desde el SQL Editor de Supabase, como se explica en `README.md`. El registro público no crea administradores.
5. Cierra sesión y vuelve a entrar.

## Cómo cambiar la página, paso a paso

1. Entra en Bellaquitas Fest con tu cuenta de **administrador**.
2. En la parte superior pulsa **✎ Editar web**. También puedes entrar desde **Panel administrador → Editar web**.
3. Elige una parte de la página en el menú lateral: **Portada, Experiencia, Eventos, Ventajas, Preguntas, Invitación final, Otros textos, Orden y visibilidad o Modelos**.
4. Escribe los textos nuevos; la **vista previa** te muestra el resultado mientras editas. Puedes elegir **Ordenador** o **Móvil**.
5. Pulsa **Guardar borrador** si quieres seguir otro día **sin mostrar los cambios al público**.
6. Cuando todo esté listo, pulsa **✓ Publicar cambios** y confirma. La web pública se actualizará usando los datos guardados en Supabase.

### Tres modelos de diseño

- **Original Bellaquitas:** oscuro, dorado y elegante.
- **Modelo elegante:** fondo oscuro y tonos suaves.
- **Modelo festival:** colores más vivos para destacar actividades.

Al escoger un modelo **no se borran** los textos ni los eventos. Puedes probarlo en la vista previa antes de publicar.

### Cambiar fotografías y el logotipo

En **Portada** puedes pegar una URL HTTPS de la imagen o pulsar **Subir imagen** para enviar JPG, PNG o WebP (máximo 5 MB). Las fotos se almacenan en Supabase Storage y son públicas. No subas documentos confidenciales. El editor permite cambiar la imagen principal; las fotografías de los eventos y premios se gestionan desde el **Panel administrador**.

### Cambiar el orden de la página

Abre **☰ Orden y visibilidad**. Usa las flechas **↑ / ↓** para colocar primero lo más importante. Desmarca una casilla para **ocultar una sección** sin borrarla. Se aplica al público únicamente al publicar.

## ¿Cómo modifico un evento o un premio?

El editor visual sirve para **textos, imagen principal, aspecto y secciones de la portada**. Para añadir, editar, publicar, ocultar o eliminar **eventos, premios y promociones**, utiliza las opciones correspondientes del **Panel administrador**. Consulta `GUIA_PANEL_FACIL.md`.

## Si te equivocas

- **Todavía no publicaste:** pulsa **↶ Recuperar lo publicado** para descartar el borrador local y volver a lo que el público ve. Se pide confirmación si procede.
- **Ya publicaste:** vuelve a **✎ Editar web**, corrige el texto o el modelo y pulsa **Publicar cambios** otra vez. No hay historial automático de versiones en este editor.
- **No se guardan los cambios:** comprueba tu conexión con Supabase, los permisos del administrador y que ejecutaste `INSTALAR_EDITOR_WEB.sql`.

## ¿Publicar cambios actualiza GitHub?

**No.** La primera versión del código se sube al repositorio GitHub. Los cambios normales que hagas con **✎ Editar web** se almacenan en **Supabase** y se muestran en la web sin volver a subir archivos a GitHub. Para cambiar funcionalidades o código del sitio, sí hay que subir una nueva versión al repositorio.

## Seguridad

Solo cuentas con el rol `admin` pueden editar y guardar. Los borradores se guardan en una tabla privada (`site_drafts`) con reglas de acceso (RLS). La portada publicada se guarda en `site_content`. No permitas que usuarios normales puedan cambiar roles ni publiques claves privadas o `service_role`.