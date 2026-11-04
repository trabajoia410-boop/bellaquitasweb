# Administrar socios sin conocimientos técnicos

1. Abre tu web, entra con una cuenta administradora y abre **Panel administrador → Socios**.
2. Busca una persona por su **nombre o código**. También puedes filtrar por rol.
3. Pulsa **✎ Editar socio**.
4. Puedes cambiar su **nombre**, su rol (**Socio**, **Personal de puerta** o **Administrador**), sus **puntos disponibles**, sus **puntos históricos** y sus **visitas acumuladas**. Los puntos disponibles son el saldo que puede gastar; los históricos marcan su categoría.
5. Usa los botones **+10**, **+50**, **+100** y **−10** si deseas modificar el saldo. Ajusta los números a mano si necesitas otra cantidad.
6. Escribe un **motivo real** para el ajuste; todos los cambios quedan registrados.
7. Pulsa **Guardar cambios del socio**, revisa los cambios y confirma. Después podrás consultarlos en **Últimos cambios de cuentas** y los ajustes de puntos en **Movimientos**.

## Seguridad

- Solo administradores autenticados pueden guardar cambios mediante la función protegida `public.admin_update_member`.
- La autorización se valida en la base de datos, **no solo ocultando botones**.
- No se pueden introducir puntos o visitas negativos ni dejar la web sin administrador. Tampoco puedes quitarte tu propio acceso de administrador desde el panel.
- Si se aumentan los puntos disponibles por encima de los históricos, los históricos se elevarán hasta el mismo importe.
- Los datos de las cuentas no se pueden borrar desde este panel. Cambiar las visitas no borra su historial anterior.
- El registro de cambios muestra nombre, rol y cantidades anteriores/nuevas, el motivo y la cuenta administradora que los cambió.
- Los datos de usuarios no se publican en la página pública.

## Instalación

En la base de datos ya existente, ejecutar `AMPLIAR_GESTION_SOCIOS.sql` desde Supabase SQL Editor una sola vez. En un proyecto nuevo, `supabase.sql` ya incluye la ampliación. No incluye cuentas de muestra ni inventa puntos.