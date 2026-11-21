# Bellaquitas Fest — preparación real de pruebas físicas y cuentas administrativas (16/11/2026)

**Estado de lanzamiento: 10/16 controles, con corte DNS y producción bloqueados.**

## QR sintético sin usuarios: publicado y verificado

**Página independiente:** https://bellaquitas-device-qa.bellaquitas-fest-410.workers.dev/

Se ha mejorado el Worker de diagnóstico (sin bindings D1/R2, sin cookies y sin peticiones POST):
- Muestra el QR fijo `BELLAQUITAS-QA-QR-2026`, ficticio y sin permisos de puerta.
- Permite comprobar el decodificador `jsQR` original con un botón, **sin cámara**. La prueba `cloudflare/test-device-qr-challenge.mjs` construye los píxeles originales y confirma que el lector devuelve **exactamente** ese QR ficticio.
- La cámara se activa **solo mediante un clic**; escanea en memoria, reconoce el código ficticio y se apaga al salir. No se transmite, conserva ni muestra el contenido de códigos reales.
- Un informe ES/FR se prepara únicamente en el navegador (QR de prueba, cámara, vídeo cargado, vídeo avanzando). El usuario puede copiarlo voluntariamente. No contiene correos, contraseñas ni valores QR.
- Las cinco etiquetas MP4, los mensajes QR y los informes están traducidos ES/FR.

## Vídeo de iPhone/Android

- Se detectó y corrigió un defecto reproducible: la cabecera `Cross-Origin-Resource-Policy: same-origin` del Worker multimedia impedía que los vídeos públicos se cargaran desde otro Worker de QA. Se ha cambiado **solo para recursos multimedia públicos** a `cross-origin`; salud del servicio, endpoints no permitidos, bases de datos y sesiones mantienen sus protecciones.
- **Cloudflare Workers Builds** publicó el arreglo correctamente, compilación `c9d4be74-e755-4795-b43d-c57b1ec22f9a`.
- [GitHub Actions WebKit/Chromium y páginas ES/FR](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43791639958) pasó: lector QR ficticio, textos ES/FR, sin overflow y sin POST. Desaparecieron los bloqueos CORP.
- En Chromium emulando Pixel 7 y escritorio, un MP4 original alcanzó `readyState=4` y avanzó a ~1,26 segundos, sin error. **Esto no constituye prueba de reproducción física en Android.**
- WebKit emulando iPhone 13 no generó error ni bloqueo CORP, pero en la observación no había avanzado: **aún no se puede certificar Safari físico**. Se mantiene pendiente este control.
- La verificación del Worker multimedia en CI ya exige 5 respuestas HTTP 206 reales con principio/fin de bytes idénticos a los originales y 3 logos intactos.
- Hay una prueba adicional que exige `currentTime > 0.4` en Chromium para impedir regresiones en las que el vídeo cargue sin reproducirse: `cloudflare/test-device-qa-browser.mjs`.

## Dos administradores reales: situación observada sin contraseñas

Consulta **exclusivamente de lectura** a D1 staging y restauración aislada:
- **2 perfiles administradores** en ambas.
- Ambos tienen una identidad Google vinculada.
- **0 administradores con credenciales de correo verificadas**, 0 sesiones de reautenticación administrativa y 0 vinculaciones pendientes.
- Cloudflare staging tiene `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` configurados como secretos; los valores no se extrajeron ni se imprimieron.
- El código OAuth aplica PKCE, state, nonce y cookies protegidas; el inicio de Google crea un registro temporal en D1 y **no se invocó**, para no fabricar sesiones ni atribuir accesos reales.
- La función de vincular correo/contraseña al **mismo perfil** requiere un login de administrador real, verificación del correo y activación explícita `ADMIN_EMAIL_LINK_ENABLED=yes`. Esta función continúa desactivada para no introducir nuevas credenciales reales sin verificación.

**Por tanto el control `bothRealAdminLoginsVerified` continúa FALSO.** No se puede sustituir la intervención legítima de las dos personas administradoras por contraseñas simuladas.

## Copias, claves y paridad de datos

Se volvió a consultar D1 staging y la restauración aislada por `SELECT` / `PRAGMA foreign_key_check`:
- Ambas: 7 perfiles, 2 admins, 6 vínculos Google y 1 email verificado.
- Ambas: 1.999.998 puntos disponibles, 1.999.998 históricos, 0 visitas, 0 errores FK.
- No hubo escrituras sobre estas bases durante las comprobaciones.
- La copia cifrada externa ya recuperada es **únicamente de staging**, no de producción. Falta obtener el origen real sin utilizar Supabase como destino.
- **No se rotó ninguna clave histórica de producción** y no se sustituyó el respaldo antiguo, por falta de acceso autorizado a la clave/archivo correspondiente.

## Control de costes de compilación

Se modificó únicamente el trigger de `bellaquitas-media-qa` en Workers Builds (rama segura) para reconstruir medios solo cuando cambien `assets/*` o siete archivos de configuración/inventario multimedia. Los cambios de documentación o pruebas no vuelven a subir los 56,8 MB de medios, evitando consumo innecesario del nivel gratuito.

## Para la prueba física cuando haya dos dispositivos

1. Mostrar el QR ficticio en un ordenador o segundo teléfono desde la página QA.
2. Abrir la misma página QA en el iPhone/Android. Pulsar **Iniciar cámara**, conceder permiso y apuntar al código ficticio.
3. Verificar el texto de reconocimiento y detener la cámara; probar la selección de vídeos móviles y la reproducción efectiva.
4. Pulsar **Copiar informe local**; solo compartir el resultado técnico, nunca una contraseña, código real de socio ni enlace privado.

No se registra automáticamente la prueba como superada: faltan dispositivos reales y, para puerta, una verificación autorizada sin sumar visitas ni puntos.

**No se ha cambiado `bellaquitas.fr`, DNS, GitHub `main`, los siete perfiles, sus puntos o contraseñas ni la PR #3 (sigue borrador).**
