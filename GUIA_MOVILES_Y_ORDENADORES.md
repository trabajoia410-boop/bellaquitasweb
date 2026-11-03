# Bellaquitas Fest en Android, iPhone, tablet y ordenador

## Qué se ha preparado

- Es **una única web adaptable (PWA)**. El mismo enlace abre las mismas cuentas de Supabase en cualquier navegador compatible. No son cuatro aplicaciones diferentes.
- Funciona como sitio web normal en navegadores actuales de Android, iOS, Windows y macOS. Se ha añadido manifiesto PWA con iconos PNG 192/512, icono para iPhone y acceso directo desde pantalla de inicio.
- Barra inferior de navegación en móvil con espacio para los gestos de iPhone, menús de 44 px, entrada de datos sin zoom automático en iPhone y panel administrador en disposición de una columna.
- Para QR, hay lector con BarcodeDetector si existe y con jsQR si no. Siempre existe la opción de escribir el código manualmente.
- Se ha añadido una guía de instalación tocando «Instalar la app». En los sistemas compatibles el navegador también puede mostrar su propio diálogo de instalación.

## Cómo instalarla

1. **Android:** abre la URL pública en Chrome, pulsa el menú ⋮ y selecciona «Instalar aplicación» o «Añadir a pantalla de inicio».
2. **iPhone/iPad:** abre la web en Safari, pulsa «Compartir» → «Añadir a pantalla de inicio» → «Añadir». Si aparece «Abrir como app», actívalo.
3. **PC / Mac:** abre la web normalmente en Chrome, Edge, Firefox o Safari. Para instalarla en escritorio, usa la opción «Instalar» de Chrome/Edge o la opción equivalente del navegador compatible.

La instalación PWA **no es una publicación en Google Play o App Store**. Para eso hacen falta procesos y versiones adicionales.

## Internet y datos

- El inicio de sesión, Google, los eventos, los puntos y los cambios del administrador **requieren conexión a Internet** y la configuración de Supabase.
- El service worker solo puede conservar archivos públicos (código, estilos e iconos); nunca las respuestas de la base de datos, datos de cuenta, fotos privadas ni las redirecciones de autenticación. Las pantallas de cuenta no funcionan sin conexión.
- La cámara QR pide permiso al usuario y requiere HTTPS. Si el navegador no soporta el lector, usa el formulario para escribir el código.
- La entrada con Google requiere que el proveedor Google esté habilitado en Supabase y la URL pública esté en las redirecciones autorizadas.

## Archivos nuevos

- `manifest.webmanifest`: definición de instalación PWA.
- `assets/icon-180.png`, `assets/icon-192.png`, `assets/icon-512.png`, `assets/icon-maskable-512.png`: iconos para dispositivos.
- `sw.js`: instalación PWA y caché de recursos estáticos, sin cachear datos de usuarios ni de API.
- `GUIA_MOVILES_Y_ORDENADORES.md`: esta guía.

## Publicación

La web se publica en GitHub Pages desde `main` + `/(root)`:
`https://trabajoia410-boop.github.io/bellaquitasweb/`

Se necesita activar Pages en **Settings → Pages**. Para autenticación, configura las redirecciones de Supabase y el proveedor Google.

## Comprobaciones

- Prueba en Android/Chrome y iPhone/Safari reales antes de anunciar compatibilidad completa.
- Prueba registro, confirmación de correo, Google, recuperación de contraseña, tarjeta/QR y guardado/publicación de un cambio en modo admin.
- Comprueba funcionamiento cuando se pierde Internet: el contenido no sincronizado no se guarda y no deben aparecer datos de otras cuentas.