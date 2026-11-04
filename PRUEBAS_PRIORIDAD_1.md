# Bellaquitas Fest — Prioridad 1: auditoría y pruebas funcionales
**Fecha:** 4 de noviembre de 2026
**Alcance:** Inicio de sesión, persistencia de sesión, QR personal, lector de puerta, permisos y despliegue.
**Principio:** no crear usuarios reales ni registrar puntos, visitas o canjes durante las pruebas.

## Resultados de pruebas con cuentas simuladas
### Autenticación — 8/8
- Inicio de sesión correcto para las rutas de socio, puerta y administrador.
- Rechazo controlado de contraseña incorrecta.
- Registro sin sesión activa: presenta la petición de confirmación por correo.
- Recuperación de contraseña: invoca el método de Supabase.
- OAuth Google: construye una URL de retorno a la misma web.
- Cambio de contraseña: cierra la sesión y vuelve a acceso.
**Nota:** se usaron respuestas simuladas, no contraseñas ni cuentas reales.

### Persistencia de sesiones — 7/7
- Primera apertura y recuperación tras reabrir.
- Un fallo de red al consultar el perfil conserva la sesión existente.
- Volver a la página con una sesión vigente no obliga a autenticarse otra vez.
- Desconexión detectada, restauración al reaparecer una sesión.
- La página en segundo plano no inicia consultas o renderizados innecesarios.
**Nota:** no sustituye una prueba real en Safari/Chrome con cookies/tokens legítimos.

### QR y escáner — 8/8
- El lector nativo de QR funciona si falla la descarga del lector auxiliar.
- QR válido detectado una sola vez y cierre de cámara posterior.
- Alternativa jsQR reconoce el código cuando no existe lector nativo.
- Segundo clic mientras se conceden permisos no abre otra cámara.
- Cancelar mientras la solicitud está pendiente cierra la cámara que llegue tarde.
- QR ajeno rechazado sin llamar al registro de visitas.
- Imágenes de QR ya generadas: códigos legibles con OpenCV a 320, 390 y 768 píxeles.
**Corrección:** el escáner se protege contra aperturas simultáneas, cancelación tardía y errores de carga del lector auxiliar.

### Supabase: verificaciones de solo lectura
- Proyecto identificado como ACTIVE_HEALTHY.
- Rol sin sesión: sin permisos de validación de visitas ni de canjes.
- Puerta: is_staff verdadero e is_admin falso.
- Administrador: is_staff e is_admin verdaderos.
- Personal de puerta: QR con formato ajeno rechazado.
- Los controles de autoaprobación de visita/canje existen en las funciones almacenadas, pero no se ejecutaron sobre cuentas reales porque no se deben escribir puntos o visitas.

## Protección de datos
Consultas iniciales: 3 perfiles, 2 filas de actividad, 0 visitas y 0 canjes. Las pruebas utilizaron un contexto de solo lectura y respuestas simuladas, sin solicitudes POST/RPC para registrar visitas reales. Verificar los mismos contadores al concluir.

## Despliegue
- GitHub contiene el código fuente y ejecuta flujos de compilación y despliegue.
- Los checks de GitHub del commit anterior terminaron satisfactoriamente.
- **La URL pública de Netlify no ha podido verificarse mediante una petición HTTP desde este entorno**, por lo que el estado de GitHub no equivale a una prueba independiente del sitio Netlify.
- La caché PWA se incrementó a v11 para forzar la actualización de app.js y evitar una mezcla de versiones.

## Pruebas manuales todavía pendientes, sin tocar puntos reales
1. Abrir Netlify en iPhone y Android y confirmar que carga todas las páginas sin errores de CSP.
2. Iniciar sesión con una cuenta de prueba autorizada y recargar, cerrar y reabrir el navegador, e instalar la PWA.
3. Confirmar login por Google y recuperación de contraseña con URLs de retorno permitidas en Supabase.
4. Probar lectura de un QR en iPhone Safari y Android Chrome, sin confirmar visitas reales; en su lugar validar visualmente que el lector detecta el código.
5. Probar registro real de una visita **solo** con un socio de pruebas creado explícitamente para ello y previa autorización del propietario.
6. Comprobar los encabezados Netlify mediante DevTools o `curl -I https://bellaquitasfest.netlify.app/` y que la caché instalada sea v11.

## Observaciones
- Cuando el navegador está en modo privado o limpia los datos, Supabase no puede conservar la sesión.
- Las restricciones RLS y la validación de funciones en la base de datos son la autoridad; ocultar botones no es suficiente.
- No se puede asegurar que las funciones de puerta completen una actualización real sin hacer una prueba autorizada de escritura, que deliberadamente se omitió.
