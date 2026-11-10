# Bellaquitas Fest — verificación sin afectar producción

Fecha: 10 noviembre 2026.

## Reconciliación de base de datos
Comparación entre Supabase original y D1 de Cloudflare tras copia de
datos (consultas de solo lectura en Supabase):

| Indicador | Supabase | Cloudflare D1 |
| --- | ---: | ---: |
| Perfiles | 6 | 6 |
| Saldo de puntos | 1.999.998 | 1.999.998 |
| Puntos históricos | 1.999.998 | 1.999.998 |
| Visitas | 0 | 0 |
| Identidades Google | 6 | 6 |
| Movimientos | 2 | 2 |
| Cambios administrativos | 3 | 3 |

Las seis identidades tienen formato Google Subject compatible. Ninguna
de las seis cuentas tiene una contraseña propia almacenada en Supabase.

## Pruebas con datos ficticios en D1
Se crearon temporalmente tres perfiles con identificadores
`00000000-0000-4000-8000-00000000f00[1-3]`, un premio y un canje
de prueba, únicamente en D1 staging.

- ✅ Primera visita ficticia: +10 puntos / +1 visita.
- ✅ Segunda visita el mismo día: bloqueada por índice único.
- ✅ Canje ficticio: descuento exacto de 20 puntos mediante trigger.
- ✅ Validación del canje: sin segundo descuento.
- ✅ Modificación administrativa: aplicada y auditada dentro de D1.
- ✅ Todos los registros ficticios eliminados.
- ✅ Tras limpiar, permanecen 6 perfiles, 1.999.998 puntos y 0 visitas.

## Prueba HTTP
- ✅ GET /health: HTTP 200, `database=connected`, `storage=configured`
  verificado usando el navegador remoto de Cloudflare.
- ⏳ Las demás rutas HTTP no están verificadas: Cloudflare Browser
  Rendering devolvió HTTP 429 (límite temporal). No tratarlas como éxito.

## Controles activos
- El endpoint público no tiene operaciones de escritura habilitadas.
- Las rutas privadas requieren cookie de sesión validada y permisos
  del servidor; aún no se han configurado credenciales OAuth.
- `STAGING_MUTATIONS=disabled`, `ALLOW_NEW_ACCOUNTS=no`.
- El bucket R2 `bellaquitas-media-staging` permanece privado.
- La web de producción sigue usando Supabase.

## Bloqueos antes del corte definitivo
- Credenciales Google OAuth nuevas para Worker, almacenadas como secrets.
- Servicio verificable de correo para alta/restablecimiento con contraseña.
- Revisión y activación de la ruta del mismo origen en el dominio final.
- Copia verificada de los tres logos de Supabase Storage a R2.
- Pruebas HTTP completas, navegador móvil, perfil administrador y QR.
- Reconciliación final de datos tras congelar escrituras antes del corte.

## Transferencia de archivos y limpieza
- ✅ Copiados los 3 logos originales a R2, con 1.939.302 bytes en total.
- ✅ Tamaños individuales verificados: 904.603 + 130.096 + 904.603.
- ✅ SHA-256 registrado para cada archivo (64 caracteres hexadecimales).
- ✅ GET /v1/assets/logos/705cc152-5de2-407a-a880-1e78ca4b30ea.png:
  HTTP 200, content-type image/png (navegador remoto Cloudflare).
- ✅ D1 site_content y site_drafts reescritos a /v1/assets/logos/;
  JSON válido conservado.
- ✅ Worker temporal de migración borrado tras desactivar cron
  y subdominio. No queda tarea de copia recurrente.
- ✅ GET /v1/auth/me: HTTP 200 y authenticated=false para visitante
  no autenticado. No se revela información del socio sin sesión.

## Nueva fase: interfaz, QR y correo

- Verificación visual del usuario: Google login correcto con rol admin,
  persistencia en navegador y botón «Cerrar sesión» devuelve a acceso Google.
- `/preview` desplegada con QR personal, movimientos, modo puerta
  solo lectura, resumen de administración y ES/FR.
- Librerías QR y jsQR servidas desde el Worker staging por el mismo origen;
  no se depende de servicios externos para dibujar o decodificar el QR.
- Prueba automática sintética de la lógica: la librería crea SVG para
  `MBR-TESTABC123`; convertido en imagen, jsQR recupera
  exactamente `MBR-TESTABC123`. **No es una prueba de cámara física**.
- Migración D1 `0006-email-auth.sql` aplicada sin modificar cuentas:
  tablas de credenciales y tokens vacías, 6 perfiles, 1.999.998 puntos
  y 0 visitas mantenidos.
- Módulo de email desplegado (registro, verificación, acceso, olvido,
  restablecimiento), pero `EMAIL_AUTH_ENABLED` ausente;
  `ALLOW_NEW_ACCOUNTS=no` y `STAGING_MUTATIONS=disabled`.
- La interfaz y el endpoint de estado se han incluido en el Worker;
  los formularios email permanecen ocultos hasta añadir todos los secretos
  y la configuración. La última prueba de renderizado confirma el DOM con
  `emailTools` oculto y visita anónima.
- Prueba HTTP adicional del endpoint `/v1/auth/email/status` pendiente:
  Cloudflare Browser Rendering respondió 429 (limitación temporal),
  por lo que no se marca como confirmación de comportamiento HTTP.
- Se mantiene la web pública GitHub Pages + Supabase sin alteraciones.

## Pruebas unitarias con mocks (sin tráfico ni datos reales)
Se ejecutaron rutas compiladas con objetos Response/URL simulados:
- `GET /v1/auth/email/status`: HTTP 200, `login=false`,
  `registration=false`, `turnstileSiteKey=null`.
- `POST /v1/auth/email/register` sin credenciales/flags: HTTP 503
  (operación **desactivada**).
- `GET /v1/auth/email/login`: HTTP 405.
- `GET /v1/door/members` y `GET /v1/admin/members`
  sin identidad: HTTP 401 (lectura protegida).
Estos son tests unitarios de los handlers, **no** validan de extremo a
extremo el envío de emails ni la cámara móvil.

## Activación acotada de correo — 11/11/2026
- Secretos en Worker: RESEND_API_KEY, EMAIL_RATE_KEY, TURNSTILE_SECRET,
  GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET verificados por **nombre/tipo**; sin lectura de valores.
- Turnstile widget configurado en el hostname exacto del Worker, modalidad managed.
- Se ha separado EMAIL_REGISTRATION_ENABLED de ALLOW_NEW_ACCOUNTS:
  las altas por correo de **pruebas** pueden abrirse sin abrir nuevas identidades Google.
- Flags actuales: EMAIL_AUTH_ENABLED=yes, EMAIL_REGISTRATION_ENABLED=yes,
  ALLOW_NEW_ACCOUNTS=no, STAGING_MUTATIONS=disabled.
- Tests de handler con env simulado: registro se anuncia disponible cuando
  las claves existen; sin secreto Turnstile se anuncia como deshabilitado;
  GET en una ruta POST devuelve 405.
- Renderizado real de /preview: campos de inicio y registro email visibles,
  contenedor Turnstile y aviso de contraseña exclusiva para pruebas visibles.
- Consulta D1 posterior al despliegue: 6 perfiles, 1.999.998 puntos,
  0 visitas, 0 credenciales email, 0 tokens; ninguna escritura en esa consulta.
- **Pendiente:** uso de un buzón de prueba con acceso para realizar el flujo
  registro → entrega → confirmación → login → logout → recuperación, y prueba
  de controles de abuso. No dar por completado todo el módulo todavía.
