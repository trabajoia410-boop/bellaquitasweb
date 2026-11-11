# Bellaquitas Fest — fase 5: validación final sin cambiar el diseño

**Fecha de actualización:** 11 de noviembre de 2026  
**Sitio público:** https://bellaquitas.fr/ (se mantiene intacto)  
**Espejo de lectura:** https://bellaquitas-api-staging.bellaquitas-fest-410.workers.dev/espejo/  
**Estado:** controles de navegador aprobados; pruebas físicas, respaldos privados y corte **pendientes**.

## Bloque A — Verificado automáticamente sin usuario ni contraseñas

- **21/21 comprobaciones en Chrome real**, en escritorio, emulación Android y user-agent de iPhone:
  - Cabecera única, cinco enlaces y selector ES/FR.
  - Alternancia de idiomas, traducción de navegación, persistencia tras recargar y vuelta a español.
  - Menú móvil único, tres enlaces de comunidad, menú activo en Eventos, cierre con navegación y con Escape.
  - Sugerencias y etiquetas de su formulario traducidas al francés, sin enviar contenido.
  - Bellaquitas Moments y Club accesibles en francés.
  - Fuente correcta del vídeo de portada para escritorio/móvil, clase de encuadre iOS y fuente del segundo vídeo.
  - Acceso administrativo sin sesión no muestra formularios de socios.
  - El reporte `diagnostics.json` no registró errores JavaScript.
  - Evidencia: https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43014682930
- **13/13 comparaciones de paridad contra la web pública**:
  - Estructura y número de controles, navegación y traducciones ES/FR.
  - Formulario Sugerencias en francés idéntico.
  - Tamaño natural del logo idéntico.
  - Fuentes de ambos vídeos coincidentes.
  - Geometría y estilos CSS calculados de la cabecera y la zona de vídeo coincidentes (diferencias menores de 2 px).
  - Menú móvil idéntico.
  - Evidencia: https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43015001677

Los navegadores de CI emulan dimensiones y agente de usuario; **NO son un iPhone físico ni Safari WebKit**. No se verificó la reproducción fluida de los vídeos ni el escáner de cámara en dispositivos reales.

## Bloque B — Últimas verificaciones que requieren dispositivos reales

### iPhone con Safari
- [ ] Abrir bellaquitas.fr y el espejo de Cloudflare en pestañas separadas; verificar que portada, dos vídeos, logo, cabecera y banda dorada/animada son iguales
- [ ] Girar el teléfono horizontal y verticalmente: ausencia de franjas, recortes o desplazamientos anómalos
- [ ] Abrir/cerrar hamburguesa y entrar en Inicio, Eventos, Sugerencias, Moments y Club; una sola barra de navegación
- [ ] Cambiar ES/FR, navegar y recargar: todo se mantiene traducido
- [ ] Verificar inicio de sesión con una **cuenta de prueba aislada**, mantener sesión después de recargar y confirmar que cerrar sesión funciona
- [ ] Abrir cámara para leer un **QR ficticio**; no registrar ninguna visita de un socio real

### Android/Samsung con Chrome
- [ ] Repetir vídeos, rotación, menú, idiomas, login/logout y QR ficticio
- [ ] Confirmar que la experiencia coincide con iPhone y con la web pública

### Editor/puerta (solo entorno aislado de escritura)
- [ ] Crear cuentas ficticias con roles socio, puerta y admin; nunca reutilizar IDs, códigos, emails, puntos o visitas reales
- [ ] Crear, editar y ocultar un evento de prueba
- [ ] Guardar un borrador de texto ES/FR y publicarlo; comprobar en navegador real que no cambia estilos o vídeos
- [ ] Leer QR ficticio desde el móvil; registrar una única visita; rechazar duplicado y verificar puntos y auditoría **solo ficticios**
- [ ] Canjear premio ficticio y rechazar una segunda validación
- [ ] Confirmar que un socio no puede abrir/editar el panel

**No activar operaciones de escritura en la base `bellaquitas-staging` que contiene copias de los seis socios originales.** `STAGING_MUTATIONS=disabled` es un bloqueo de seguridad.

## Bloque C — Antes de fase 6

- [ ] Revisar esquema de contraseñas personalizado y riesgo de enumeración en registro
- [ ] Confirmar que hosting, envíos y almacenamiento funcionan dentro de planes gratuitos sin cobro automático (condición explícita del propietario)
- [ ] Crear y probar una restauración de respaldo **privado y cifrado** de Supabase, D1 y R2; no añadir datos a este GitHub público
- [ ] Comprobar diferencial final de identidades, eventos, puntos, visitas, QR, medios y contenido
- [ ] Preparar y aprobar corte **reversible**, con Supabase original conservado como respaldo

**Importante:** 21 + 13 comprobaciones de navegador/paridad aprobadas, además de las 80 pruebas lógicas/API y seis de vídeo anteriores. No se ha migrado el dominio ni se han modificado los datos originales.
