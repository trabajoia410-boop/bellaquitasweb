# Bellaquitas Fest — seguimiento de migración a Cloudflare
**Actualizado:** 10 de noviembre de 2026.

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
- [~] Login Google comprobado con una cuenta importada de rol admin y sesión persistente confirmada por el usuario. Pendiente probar otras cuentas y cierre de sesión autenticado.
- [~] Diseñado el plan de alta segura en `EMAIL_AUTH_PLAN.md`. No activar sin envío de correo/verificación/recuperación (las 6 cuentas existentes solo usan Google).
- [ ] Activar y probar escrituras en staging usando perfiles de pruebas, nunca datos reales.
- [~] Añadida y desplegada la interfaz de pruebas del mismo origen en `/preview` con perfil, eventos, login y logout. Pendiente adaptar `app.js` completo y sesiones de primera parte bajo `bellaquitas.fr`.
- [ ] Preparar DNS Cloudflare y Workers Route `bellaquitas.fr/v1/*` sin afectar GitHub Pages hasta el corte.
- [ ] Probar cámara QR en iPhone y Android, canje, corrección de puntos, edición admin y galerías.
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
- El acceso Google ha sido comprobado por el administrador; el cierre de sesión real aún requiere prueba con navegador autenticado.
- Cambios aislados en la rama `cloudflare-preview-login-20261110` y en el Worker **staging**.

