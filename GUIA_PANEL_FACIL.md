# Cómo usar el panel de Bellaquitas Fest

Esta versión está pensada para personas que no tienen experiencia administrando páginas web. **No hay cuentas, eventos, premios ni promociones de ejemplo**. Todo lo que se crea se guarda en tu Supabase real cuando lo has conectado.

## Primero: activar la web (una sola vez)

1. Conecta tu proyecto Supabase poniendo su **URL** y **clave pública** en `config.js`. No pongas contraseñas ni claves secretas. Sigue los pasos de `README.md` para activar correo y Google.
2. Si el proyecto es nuevo, en **SQL Editor** ejecuta primero `supabase.sql` y después `INSTALAR_EDITOR_WEB.sql`. Si ya tenías instalada una versión anterior, ejecuta `AMPLIAR_PANEL_ADMIN.sql` (si aún no lo habías hecho) y luego `INSTALAR_EDITOR_WEB.sql` y `AMPLIAR_GESTION_SOCIOS.sql`. No se crean cuentas ni eventos de prueba.
3. Registra tu propia cuenta en Bellaquitas Fest con correo o Google. Después, para convertir esa cuenta en administradora, localiza su UUID en **Authentication → Users** de Supabase y ejecuta, desde SQL Editor:

   ```sql
   update public.profiles set role = 'admin'
   where id = 'UUID-REAL-DE-TU-CUENTA';
   ```

4. Cierra sesión y entra otra vez. Verás el botón **Panel administrador**. Solo las cuentas autorizadas pueden entrar; los socios normales no pueden editar.
5. Publica el sitio mediante HTTPS para que las sesiones y Google funcionen con una dirección real.

> El panel no puede iniciarse ni guardar datos reales hasta que el proyecto Supabase esté configurado. Esta entrega no incluye cuentas de prueba ni inventa un usuario administrador.

## Crear un evento

1. Abre **Panel administrador** y pulsa el botón grande **Crear evento**.
2. Escribe el nombre, elige el día en el calendario y escribe el lugar. La hora y la descripción son opcionales.
3. Puedes pulsar **Elegir foto** para adjuntar una imagen desde el móvil. Se admiten JPG, PNG y WebP de hasta 5 MB. La foto será pública: no subas documentos privados.
4. Deja activada la casilla **Mostrar a la gente ahora** para publicarlo al guardar. Si quieres prepararlo sin que nadie lo vea, desmárcala.
5. Pulsa **Guardar evento**. El evento aparecerá en la portada (hasta tres) y en la sección de eventos (todos los publicados).

Para cambiarlo: **Eventos → Editar**. Para retirarlo temporalmente: **Ocultar**. Para borrarlo definitivamente: **Eliminar** y confirma la pregunta. Lo borrado no se recupera desde el panel.

## Crear un premio

En **Panel administrador → Añadir premio**, escribe un nombre, los puntos que cuesta, su categoría y, si quieres, una foto y una descripción. Pulsa **Guardar premio**. Un socio podrá solicitarlo únicamente si tiene saldo suficiente. Los premios que tienen canjes asociados no se pueden eliminar porque se debe conservar el historial; puedes usar **Ocultar**.

## Crear una promoción

En **Panel administrador → Crear promoción**, escribe el nombre, los puntos anunciados y una explicación. Las promociones se mostrarán en la zona de socios. **No entregan puntos de forma automática**; las operaciones sobre el saldo requieren una validación segura independiente.

## Editar toda la portada y el diseño

Entra como administrador y pulsa arriba **✎ Editar web** (también en **Panel administrador → Editar web**). Puedes modificar textos, imagen principal, modelos visuales, orden y visibilidad de las secciones. Utiliza **Guardar borrador** para dejar los cambios privados y **Publicar cambios** cuando los quieras mostrar. Tienes instrucciones detalladas en `GUIA_EDITOR_VISUAL.md`. Esta edición no modifica contraseñas ni permisos de los socios.

## Ver socios, visitas y canjes

En la pestaña **Socios** se muestra la lista real de cuentas. Pulsa **✎ Editar socio** junto a una persona para cambiar su nombre, rol (socio, puerta o administrador), puntos disponibles, puntos históricos y contador de visitas. Escribe siempre el motivo y confirma los cambios; se guardan en Supabase y en **Últimos cambios de cuentas**. Puedes sumar o restar puntos con botones rápidos sin guardarlos hasta pulsar **Guardar cambios**. Por seguridad, no podrás quitarte tu propio permiso de administrador y no se pueden dejar puntos negativos. Si el saldo excede los puntos históricos, estos se ajustan hasta igualarlo. Los cambios no eliminan las operaciones anteriores. En **Movimientos** puedes ver el historial de puntos. En **Puerta**, el personal autorizado puede registrar visitas y validar premios; esa pantalla no concede nuevos permisos por sí misma.

## Qué hace cada botón

- **Crear:** añade un contenido nuevo.
- **Editar:** cambia el contenido ya guardado.
- **Publicar:** muestra un contenido oculto a los usuarios.
- **Ocultar:** deja de mostrarlo, pero no lo borra.
- **Eliminar:** lo borra de la base de datos, después de confirmar. Si está ligado a canjes, deberás ocultarlo en vez de borrarlo.

## Preguntas frecuentes

**¿Por qué sale un error al añadir una foto?** Verifica que ejecutaste `AMPLIAR_PANEL_ADMIN.sql`. Las imágenes se almacenan en un contenedor público de Supabase Storage que solo los administradores pueden modificar.

**¿Por qué no veo el panel?** Comprueba que has iniciado sesión con una cuenta a la que se le asignó `role='admin'` en Supabase y vuelve a iniciar sesión después de darle el permiso.

**¿Puedo crear una cuenta administrador desde la página pública?** No: por seguridad todos los registros públicos se crean como socios normales. El primer administrador se habilita desde el proyecto Supabase.

**¿Se guardará todo al cerrar el navegador?** Sí, si Supabase está activo y el botón ha confirmado que guardó los cambios. Sin Supabase conectado la web no inventa contenidos ni simula guardados.