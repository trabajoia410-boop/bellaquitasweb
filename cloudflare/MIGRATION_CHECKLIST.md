# Bellaquitas Fest — seguimiento de migración a Cloudflare
**Actualizado:** 11 de noviembre de 2026.

## Completado y verificado
- [x] Cloudflare conectado a ChatGPT.
- [x] D1 privado `bellaquitas-staging` (jurisdicción UE).
- [x] Esquema de negocio, tabla de identidades y sesiones y migraciones SQL guardadas en GitHub.
- [x] Copia desde Supabase de 6 perfiles, 6 identidades Google, 2 movimientos, 3 cambios administrativos y 1 borrador; catálogo público copiado.
- [x] Comparación exacta de totales de perfiles, puntos (1.999.998), visitas (0), identidades y actividad.
- [x] API Worker `bellaquitas-api-staging` desplegada con bindings D1/R2.
- [x] GET /health verificado HTTP 200 con D1 y R2 conectados.
- [x] GET /v1/auth/me sin sesión verificado HTTP 200, authenticated=false.
- [x] Implementación de Google OAuth con PKCE SHA-256, nonce, estado de un solo uso, JWT RS256 verificado y cookie HttpOnly.
- [x] Rutas protegidas para socios, personal de puerta y administrador, con comprobaciones de rol exclusivamente en servidor.
- [x] Reglas D1 para una visita por socio y día, canjes atómicos y auditoría de cambios de socios.
- [x] Pruebas con cuentas ficticias de doble visita, canje y cambios de administrador; registros de pruebas borrados y totales reales sin cambios.
- [x] R2 privado `bellaquitas-media-staging`.
- [x] Los 3 logos originales copiados a R2; archivos verificados por tamaño y huella SHA-256 registrada.
- [x] Ruta R2 controlada `/v1/assets/logos/:file`, HTTP 200 image/png verificado.
- [x] URLs de logo reescritas SOLO en contenido publicado y borradores de D1 staging.
- [x] Worker de transferencia temporal eliminado, cron y subdominio desactivados.
- [x] Escrituras y registro de nuevas cuentas deshabilitados hasta pruebas de identidad.

## Bloqueos antes de cambiar la web real
- [x] Añadidos `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` como secretos de Cloudflare; callback autorizado en Google Cloud Console.
- [~] Inicio Google, perfil admin y sesión persistente comprobados por el usuario. Cierre de sesión autenticado confirmado mediante capturas del estado antes y después; quedan por probar otras cuentas y dispositivos.
- [~] Rutas y formularios email/contraseña habilitados SOLO en staging; Resend/Turnstile verificados y secretos enlazados. Falta registro real ficticio extremo a extremo, email entregado desde Worker, login/reset y QA móvil. Cuentas anteriores siguen usando Google.
- [ ] Activar y probar escrituras en staging usando perfiles de pruebas, nunca datos reales.
- [~] Añadida y desplegada la interfaz de pruebas del mismo origen en `/preview` con perfil, eventos, login y logout. Pendiente adaptar `app.js` completo y sesiones de primera parte bajo `bellaquitas.fr`.
- [ ] Preparar DNS Cloudflare y Workers Route `bellaquitas.fr/v1/*` sin afectar GitHub Pages hasta el corte.
- [~] QR personal, lector de cámara con jsQR local y consulta de puerta/admin de solo lectura desplegados en `/preview`. Pendientes pruebas reales en iPhone/Android y operaciones de escritura con perfiles ficticios, canjes y galerías.
- [ ] Preparar backup de producción y exportación diferencial final; repetir reconciliación de datos.
- [ ] Realizar cambio gradual y reversible de backend, dominio/OAuth, seguimiento y recuperación.
- [ ] Retirar Supabase solo cuando la web nueva esté 100 % verificada.

**Producción no modificada**: GitHub Pages, dominio y Supabase siguen operativos.

## Verificación adicional 10/11/2026
- Worker de pruebas desplegado con `/preview` y `/preview/app.js`, CSP y noindex.
- Navegador de Cloudflare: pantalla cargada, script ejecutado, visitante anónimo y eventos consultados correctamente.
- Los secretos OAuth y vínculos D1/R2 conservados después del despliegue.
- Consulta de solo lectura en D1: 6 perfiles, 1.999.998 puntos, 0 visitas; 0 cambios en la consulta.
- `STAGING_MUTATIONS=disabled` y `ALLOW_NEW_ACCOUNTS=no` se mantienen.
- El usuario compartió capturas de `/preview` con sesión autenticada (perfil y rol admin visibles) y, tras pulsar cerrar sesión, `Sesión cerrada correctamente` con botón `Continuar con Google`. Test manual de cierre de sesión completado para esa cuenta/navegador; no implica cobertura de otros roles o dispositivos.
- Cambios aislados en la rama `cloudflare-preview-login-20261110` y en el Worker **staging**.


## Fase adicional: QR y correo (10/11/2026)
- [x] `/preview` incluye QR de socio, pantalla ampliada, movimientos y consulta de puerta/admin.
- [x] Cámara en modo prueba con jsQR local para Safari/iPhone y lectura manual alternativa, sin llamadas al endpoint de registro de visitas.
- [x] Migración `0006-email-auth.sql` aplicada SOLO en D1 staging: credenciales 0, tokens 0; perfiles 6, puntos 1.999.998, visitas 0.
- [x] Código de rutas email creado (registro, confirmación, login, recuperación, reset), con PBKDF2/Turnstile/límites; acceso desactivado por defecto y formulario oculto.
- [x] Despliegue de nuevo Worker sin perder bindings ni secretos existentes.
- [x] Página de pruebas verificada mediante renderizado remoto: módulos QR/email presentes, eventos visibles y sesión anónima sin errores.
- [ ] Comprobar lectura QR real en iPhone/Samsung (requiere dispositivo físico).
- [~] Resend/Turnstile configurados; formularios email activados en staging con banderas independientes. Pendiente prueba de cuenta ficticia con correo real y cierre de sesión.
- [ ] Adaptar el `app.js` de producción y todas las funcionalidades al API Cloudflare.

**Importante:** estas pruebas no equivalen a una migración completa de la web real.

## Validación secretos de correo (11/11/2026)
- [x] `RESEND_API_KEY` y `EMAIL_RATE_KEY` guardados por el usuario y verificados en el Worker staging.
- [x] `TURNSTILE_SECRET` y claves Google conservadas; D1/R2 vinculados.
- [x] Estado HTTP real `/v1/auth/email/status`: `login=false`, `registration=false` (fail-closed).
- [x] Datos D1 sin cambios: 6 perfiles, 1.999.998 puntos y 0 visitas. Sin altas email.
- [ ] Envío y recepción de correo y alta ficticia de prueba, con protección anti-bot y monitorización; no activar altas públicas antes.

## Activación restringida de email, 11/11/2026
- [x] Resend tiene dominio verificado; Widget Turnstile autorizado para hostname staging.
- [x] Resend, Turnstile y clave de limitación de intentos permanecen en secretos Cloudflare.
- [x] `EMAIL_AUTH_ENABLED=yes`, `EMAIL_REGISTRATION_ENABLED=yes` habilitados únicamente en Worker staging.
- [x] `ALLOW_NEW_ACCOUNTS=no` mantiene cerradas nuevas identidades Google.
- [x] `STAGING_MUTATIONS=disabled`: visitas y puntos continúan bloqueados.
- [x] En navegador remoto: formularios de correo visibles, advertencia «solo pruebas» visible.
- [x] D1 comparada: 6 perfiles, 1.999.998 puntos, 0 visitas, cero credenciales email, cero tokens pendientes.
- [ ] Confirmar envío de email **desde el Worker** con buzón de prueba autorizado y verificar el resto del flujo de alta y recuperación.

## Corrección registro con correo, 11/11/2026
- [x] Diagnóstico de ausencia de correos: antes de llegar a Resend se bloquearon 10 intentos por cuotas consumidas antes de Turnstile.
- [x] Arreglados el orden de verificación CAPTCHA/cuotas y el mensaje de error situado debajo del botón correspondiente.
- [x] Reaplicados los cambios solo a Worker `bellaquitas-api-staging`.
- [x] Reiniciados exclusivamente contadores antispam de staging para permitir una nueva prueba.
- [x] D1 conservó 6 perfiles, 1.999.998 puntos, 0 visitas, 0 registros email tras el arreglo.
- [ ] Confirmar la entrega real del correo desde la página de pruebas, completar confirmación del enlace, login y recuperación.
