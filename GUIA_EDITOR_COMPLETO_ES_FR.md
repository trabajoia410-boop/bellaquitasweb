# Bellaquitas Fest · Editor completo e idiomas

## Qué se puede modificar

Accede como administrador y abre **✎ Editar web**.

- **Páginas:** Inicio, Experiencia, Eventos, Ventajas, Preguntas, invitación, acceso, registro, mi espacio, tarjeta, perfil, premios, agenda, puerta y panel.
- **Cabecera:** nombre de la marca (BELLAQUITAS), segunda línea (FEST), imagen pequeña de la marca, mostrar/ocultar texto e imagen. La imagen de cabecera es independiente de la imagen grande de portada.
- **Portada:** logo principal (sustituir o mostrar/ocultar), textos, botones, iconos, banners y secciones.
- **Experiencia, Ventajas y otras secciones:** sus textos e iconos; también se muestran como páginas independientes al seleccionarlas en el menú público.
- **Textos de toda la aplicación:** usa la categoría **☷ Textos de toda la aplicación** y busca la frase concreta para cambiar etiquetas, títulos y mensajes del sistema. En la vista previa puedes seleccionar directamente textos e imágenes de las páginas visibles.
- **Idiomas:** elige **Español** o **Français** dentro del editor. Los campos de texto publicables se guardan por idioma; el contenido francés no sobrescribe el español. Algunos nombres de marca y las imágenes son compartidos.
- **Guardar borrador** conserva una versión privada. **Publicar cambios** actualiza el contenido público de Supabase. No son la misma operación.

## Eventos, premios y promociones en dos idiomas

Al crear o editar un evento, un premio o una promoción desde el panel, introduce el texto español normal y rellena, debajo, los campos **Version française** para nombre, descripción y —cuando proceda— ubicación o categoría. Son contenidos independientes del editor de páginas. Si aún no has proporcionado una traducción francesa de un contenido nuevo, se mostrará el texto español como alternativa temporal; el sistema no inventa la traducción del evento.

## Base de datos

El proyecto Supabase ya tiene aplicada la ampliación `add_bilingual_content_for_events_rewards_promos`. Para otras instalaciones, ejecutar `INSTALAR_IDIOMAS_ES_FR.sql` una vez. No modifica ni borra los registros existentes.

## Lo que no se modifica desde el editor visual

Por seguridad, editar la web no da permisos para cambiar reglas de autenticación, políticas de acceso, puntos de otros usuarios o código ejecutable. Estas tareas corresponden a las opciones protegidas del administrador o a una actualización de software.

## Prueba en móvil

Prueba **🌐 Español / Français**, navega por las páginas y comprueba ambos textos. Cierra y abre la aplicación instalada si aún aparece una versión antigua (el service worker se actualizará cuando el navegador pueda conectarse). Confirma que el QR siempre pertenece a la cuenta real iniciada.
