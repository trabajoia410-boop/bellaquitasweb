# Bellaquitas Fest — fidelidad Wallet / Fidélité Wallet

**Estado al 21/11/2026: desarrollado en PR borrador, no publicado ni conectado a identidades reales. No cambia puntos, visitas ni recompensas originales.** Stack existente: HTML + CSS + JavaScript, Cloudflare Workers/D1, Clerk/Bellaquitas admin, diseño oscuro y dorado. No Supabase, R2, ni alojamiento de pago.

## Entrega por fases y pruebas

1. **Análisis:** auditados app.js, index.html, styles.css, admin-console.js, auth-routes.js y tablas originales. Se reutiliza el login administrativo, roles socio/puerta/admin y escáner QR jsQR/BellaQR. No rehacer portada ni base de datos.
2. **Modelo D1:** migración cloudflare/migrations/0010-wallet-digital-loyalty.sql: 13 tablas nuevas para programas, clientes, consentimiento, email OTP, sesiones, códigos de empleado, sellos, canjes, mensajes, instalaciones de Apple y outbox de actualizaciones. Sin ALTER, DROP, INSERT o UPDATE en tablas originales. Ensayo aislado: node --experimental-sqlite cloudflare/test-wallet-schema.mjs.
3. **Cliente:** /tarjeta/bellaquitas-fest, entrada por QR. Nombre y email con código temporal de 6 dígitos, sin contraseña. Teléfono opcional solo E.164; no permitir recuperación únicamente con número sin verificación SMS. La recuperación por el mismo correo verificado evita otra tarjeta. QR personal HMAC, sellos, recompensa, Google/Apple botones destacados según dispositivo. Mock /wallet/demo en staging únicamente con WALLET_MOCK_PREVIEW=yes, STAGING_MUTATIONS=disabled. GDPR: casilla obligatoria y borrado de datos nuevos.
4. **Admin:** pestaña Tarjetas digitales dentro de /administracion/; /administracion/fidelidad/ protegido con sesión y step-up existentes. Personalización de color/logo/banner/sellos, lista y búsqueda de clientes, filtro inactivos, empleados PIN4 limitado y revocable, estadísticas, canjes, QR alta SVG/PNG e Imprimir → Guardar como PDF. /admin/escanear con cámara, jsQR y sello con control de cooldown. El sistema nuevo usa solo sellos: cada alta nueva comienza con 0 sellos. Los puntos antiguos quedan como histórico inactivo, sin conversión 1:1 ni modificación de saldos.
5. **Wallet y campañas:** wallet/index.js exporta createPass, updatePass y sendNotification. Google API LoyaltyClass/LoyaltyObject en wallet/google.js con cuenta de servicio, Apple PKPass CMS firmado en wallet/apple-signer.mjs y PassKit web service en wallet/apple-service.js, integraciones inactivas hasta credenciales. El archivo wallet/sync.js procesa una cola D1 transaccional de actualizaciones bajo autorización explícita; NO hay cron desplegado. Campañas se guardan en borrador, sin enviar notificaciones reales ni afirmar que aparecen como push.
6. **Pruebas:** workflow .github/workflows/qa-wallet-digital.yml comprueba sintaxis, SQLite en RAM, QR, mock, seguridad y ausencia de secretos. No sustituye pruebas reales en iPhone/Android, correo de recuperación, PassKit ni métricas Workers Free.

## Activar Google Wallet real (después de aprobación)

1. Crear una cuenta de emisor en Google Pay & Wallet Console: https://pay.google.com/business/console/ . Solicitar la revisión de publicación de Google: https://developers.google.com/wallet/retail/loyalty-cards/getting-started/request-publishing-access .
2. Habilitar Wallet API en Google Cloud y crear una cuenta de servicio con permiso del emisor. Google pide agregar el email de esa cuenta de servicio en su Issuer account: https://developers.google.com/wallet/retail/loyalty-cards/getting-started/auth/rest .
3. Proporcionar mediante **secrets privados** del Worker, nunca en el repositorio o chat: WALLET_GOOGLE_ISSUER_ID, WALLET_GOOGLE_CLIENT_EMAIL y WALLET_GOOGLE_PRIVATE_KEY (PKCS8 PEM). Verificar que la LoyaltyClass y LoyaltyObject estén aprobadas y que la instalación y actualización funcionan en móvil.
4. Google Wallet **no garantiza notificaciones push redactadas por el desarrollador** para campañas. Pueden añadirse mensajes al pase, pero no prometer un aviso automático arbitrario: https://developers.google.com/wallet/retail/loyalty-cards/resources/faq .

## Activar Apple Wallet real (después de aprobación)

1. Apple Developer Program cuesta **99 USD/año o equivalente local** para la mayoría de las cuentas; NO cumple el requisito del propietario de 0 € sin su aprobación expresa: https://developer.apple.com/help/account/membership/program-enrollment .
2. Crear Pass Type ID, Pass Type ID Certificate, WWDR Certificate y Team ID. Almacenar material de firma **fuera del Worker público, GitHub y chat**.
3. El firmante privado Node + OpenSSL + ZIP de wallet/apple-signer.mjs necesita APPLE_PASS_TYPE_ID, APPLE_TEAM_ID, APPLE_ORG_NAME, APPLE_PASS_CERT_PATH, APPLE_PASS_KEY_PATH, APPLE_WWDR_CERT_PATH, APPLE_ICON_PNG_PATH, APPLE_LOGO_PNG_PATH, WALLET_HMAC_KEY. Producción necesita Service Bindings privados APPLE_PASS_SIGNER y APPLE_PUSH_BRIDGE, todavía NO creados. No devolver ZIP sin firma como .pkpass.
4. Probar instalación en iPhone y web-service de actualizaciones: registro, desregistro, lista de tarjetas y recepción de APNs, con HTTPS y certificado: https://developer.apple.com/documentation/walletpasses/adding-a-web-service-to-update-passes . El servicio PassKit está preparado pero sin firmante/APNs no hay sincronización Apple real.

## Banderas y secretos (seguros por defecto)

En cloudflare/wrangler-api-preproduccion.jsonc: SITE_MODE=preproduction, PUBLISH_APPROVED=no, STAGING_MUTATIONS=disabled, WALLET_ENABLED=no, WALLET_SIGNUP_ENABLED=no, WALLET_STAFF_ENABLED=no, WALLET_ADMIN_WRITES=no, WALLET_MOCK_PREVIEW=no, WALLET_MODE=mock, WALLET_REAL_APPROVED=no, WALLET_SYNC_ENABLED=no y WALLET_REPLACE_LEGACY=no. La clave WALLET_HMAC_KEY debe ser aleatoria y diferente de otras claves, mínimo 32 caracteres, solo como secret.

El alta requiere correo verificado, aunque no cuenta/contraseña. El consentimiento funcional está separado del marketing opt-in; los mensajes masivos aún no se envían. La eliminación quita la información de las nuevas tablas Wallet, pero no la ficha antigua Bellaquitas, visitas ni puntos. La revocación de un pase ya instalado en otro proveedor necesitará medidas adicionales.

Workers Free mantiene límite de CPU (10 ms por petición) y de solicitudes (100.000 diarias). Este desarrollo **no certifica** la CPU real, el cero gasto de envíos o el importe de proveedores; los límites, las credenciales y la facturación se verifican antes de cualquier lanzamiento.

## Decisión definitiva: sellos sustituyen puntos (21/11/2026)

**Sin conversión de puntos a sellos.** Al inscribirse por correo verificado, el socio recibe una tarjeta nueva con 0 sellos. No se transfieren puntos antiguos ni se fija una tasa de cambio. La nueva cuenta Wallet sigue usando su QR HMAC y los sellos los otorga el escáner autorizado; el programa debe activarse solamente cuando su diseño, las reglas de sellado y las pruebas estén preparados.

**Cambio reversible en código, sin borrar historial:** con SITE_MODE=production, WALLET_ENABLED=yes, WALLET_REPLACE_LEGACY=yes y PUBLISH_APPROVED=yes, el endpoint antiguo de puerta sigue contando visitas pero deja de acreditar 10 puntos, los canjes nuevos por puntos responden HTTP 410, las ofertas antiguas se ocultan en /v1/rewards y /v1/promos y se prohíbe editar esos catálogos en el panel. El administrador puede modificar roles y visitas sin mutar points ni lifetime_points; la UI oculta esos dos campos y la sección de recompensas antiguas. Las validaciones de canjes históricos ya emitidos siguen siendo accesibles para no invalidar obligaciones previas.

**Los campos profiles.points, profiles.lifetime_points, activity y redemptions NO se borran, vacían ni convierten**. Los saldos quedan archivados para auditoría y recuperación. En la rama de pruebas, `wallet/retire-legacy-member-ui.js` sustituye solamente los renderizadores de `Mi espacio`, tarjeta y recompensas por una tarjeta de **sellos** y mantiene intactos el perfil y la agenda. Las llamadas a tarjetas en Ventajas y unirse al Club abren `/tarjeta/bellaquitas-fest`; el panel SPA viejo redirige a `/administracion/`. `wallet/retire-legacy-copy.js` ajusta los textos de Inicio y Ventajas en ES/FR, junto a la ruta `/locale-fr.js`. Los cambios se aplican únicamente cuando el candado de publicación de sellos está activo: el `app.js`, los vídeos, imágenes y CSS originales del repositorio permanecen sin modificar. QA automática de compilación y rutas en `cloudflare/test-wallet-stamp-member-ui.mjs`. Es necesario pasar la aceptación final antes de habilitar las banderas.

**No publicar aún**: nueva wallet sin configuración real de Google/Apple; pruebas físicas, conciliación D1, permisos Clerk, factura 0 € y CSS del cliente pendientes. Las banderas continúan en no. No alterar main, DNS ni D1 real hasta acabar las verificaciones.


**Resumen:** mock web con QR y fidelidad offline probada; Apple y Google Wallet reales y sus notificaciones NO se han activado ni certificado. Ningún cargo ni suscripción nueva autorizados.
