# Bellaquitas Fest — fase 5: validación final sin cambiar el diseño

**Fecha de actualización:** 11 de noviembre de 2026  
**Sitio público:** https://bellaquitas.fr/ (se mantiene intacto)  
**Espejo de lectura:** https://bellaquitas-api-staging.bellaquitas-fest-410.workers.dev/espejo/  
**Estado:** controles automáticos aprobados; seguridad, respaldos privados y preparación del corte **pendientes**. Las pruebas con móviles físicos se realizarán **en la fase 6, inmediatamente después de publicar la migración en bellaquitas.fr**.

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

- **19/19 pruebas WebKit estilo Safari, con iPhone emulado (390 × 844)**: tanto bellaquitas.fr como el espejo decodificaron el MP4 móvil (464 × 832; readyState=4), presentaron la misma geometría de vídeo y cabecera, atributos autoplay/playsInline, fuentes móviles para el segundo vídeo y ausencia de desbordamiento horizontal. Son controles del motor WebKit en Linux, **no una prueba en un iPhone físico**.
  - Evidencia: https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43015971325

Los navegadores de CI emulan dimensiones y agente de usuario; **NO son un iPhone físico ni Safari WebKit**. No se verificó la reproducción fluida de los vídeos ni el escáner de cámara en dispositivos reales.

### Novedades: reproducción y editor en pruebas automatizadas

- **Segundo vídeo decodificado en WebKit**, a 1080 × 1920 tanto en original como en Cloudflare, `video.play()` exitoso; no sustituye Safari de iPhone físico. [Evidencia](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43019648645)
- **15/15 pruebas del Worker completo** con datos ficticios en SQLite y R2 en memoria; creación de evento real a través del enrutador principal, sin datos de producción. [Evidencia](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43020117830)
- **11/11 comprobaciones del editor en navegador** usando el Worker real en localhost y sesión admin ficticia: borrador, publicación, idiomas ES/FR y vista previa móvil. [Evidencia](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43021180171)
- Queda **pendiente** el ensayo de estos flujos con autenticación real sobre una instancia de backend de pruebas totalmente aislada y el reconocimiento/validación QR en iPhone/Samsung físicos.

### Comprobación ampliada del escáner sin dispositivo real

- **20/20 controles del Worker completo** con base ficticia, incluidos códigos QR válidos/invalidos, restricciones de personal y doble visita rechazada. [Resultado](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43111575023)
- **8/8 comprobaciones del recorrido visual del QR en Chrome** con la biblioteca `BellaQR` original, fallback `jsQR`, cámara sintética desde Canvas, sesión ficticia de puerta y SQLite en memoria. Primera lectura +10 puntos / 1 visita; segunda lectura rechazada con HTTP 409, sin duplicación. [Resultado](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43112449913)
- Sigue **pendiente** el permiso de cámara en Safari de iPhone y Chrome de Samsung físicos. No usar QR ni cuentas reales para pruebas.

## Bloque B — Fase 6: pruebas con dispositivos reales tras la publicación oficial

**Decisión del propietario:** no hacer ensayos físicos con iPhone o Samsung antes del cambio de backend. Cuando el nuevo sistema esté publicado en **bellaquitas.fr**, ejecutar esta lista como validación inmediata posterior al despliegue. Mantener posibilidad de reversión y el sistema anterior disponible hasta verificarla.

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

## Bloque C — Imprescindible antes de publicar en fase 6

- [ ] Revisar esquema de contraseñas personalizado y riesgo de enumeración en registro
- [ ] Confirmar que hosting, envíos y almacenamiento funcionan dentro de planes gratuitos sin cobro automático (condición explícita del propietario)
- [ ] Crear y probar una restauración de respaldo **privado y cifrado** de Supabase, D1 y R2; no añadir datos a este GitHub público
- [ ] Comprobar diferencial final de identidades, eventos, puntos, visitas, QR, medios y contenido
- [ ] Preparar y aprobar corte **reversible**, con Supabase original conservado como respaldo

**Importante:** las pruebas físicas son una **validación posterior al lanzamiento de fase 6**, no un bloqueo previo de fase 5. El corte sí exige respaldos restaurables, revisión de seguridad, protección de datos y reversión preparada. No se ha migrado el backend del dominio ni se han modificado los datos originales.
