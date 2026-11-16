# Fase 5: Google OAuth, paridad ES/FR y navegadores — verificado el 16/11/2026

**Alcance:** rama `migracion/fase5-segura-20261114`, Worker exclusivamente staging, GitHub CI. Sin DNS, `main`, despliegue a dominio público, nuevas cuentas reales, contraseñas ajenas ni cambios de puntos.

## 1. Corrección real de seguridad Google

- Antes: el `state` de Google OAuth estaba registrado en D1 con PKCE y nonce, pero **no se vinculaba al navegador que abrió la autorización**. Eso dejaba abierta la posibilidad de login CSRF/cambio de cuenta involuntario mediante callback obtenido en otro navegador.
- Ahora: `auth-routes.js` crea `__Host-bf_oauth` con el mismo state aleatorio, `Path=/; Max-Age=600; Secure; HttpOnly; SameSite=Lax`. En callback exige que la cookie del navegador coincida **antes** de leer/borrar el state en D1 o contactar Google. El state sigue siendo de un solo uso y se limpia la cookie tras éxito.
- Test unitario `test-oauth-browser-bound-state.mjs`: crea state ficticio, verifica atributos de cookie, comprueba rechazo 403 sin cookie y con cookie de otro navegador, y confirma que el state ajeno no consume D1.
- **Despliegue real solo staging**: commit marcador `dd9c352618083f3106105d32343c576266974e9b`, Cloudflare Workers Builds `75608538-ac1c-4ebf-938f-ce370d172110` **SUCCESS**, Worker versión `a3b872f7-0bd1-4205-94ef-8cc1ab6dd763`. Se preservaron 17 bindings, cinco secretos, D1 staging y binding multimedia; `STAGING_MUTATIONS=disabled`, `ALLOW_NEW_ACCOUNTS=no`, `EMAIL_REGISTRATION_ENABLED=no`, R2 ausente.
- Comprobación HTTP real de callback sintético sin cookie: **403**, sin sesión ni exposición de secretos. No se autentica a usuarios reales ni se consumen códigos válidos.

## 2. Navegadores, idiomas y privacidad

- En `cloudflare/test-public-routes-browser.mjs` se añadieron aserciones de navegación visible ES/FR y menú (Inicio/Accueil, Experiencia/Expériences, Eventos/Événements, Ventajas/Avantages, Preguntas/Questions).
- Se comprueba que el menú francés **no** conserva frases españolas conocidas y que durante la navegación no hay solicitudes a dominios `supabase.co`, `supabase.com`, `r2.dev`, `cloudflarestorage.com` ni `esm.sh`.
- Playwright en iPhone 13 **WebKit simulado**, Pixel 7 **Chromium simulado** y navegador escritorio Chromium: **66 combinaciones de 11 rutas × 2 idiomas × 3 navegadores** correctas, sin desbordamientos horizontales, escrituras anónimas ni conexiones al antiguo backend.
- El panel `/administracion/` publicado en staging supera en los tres navegadores prueba ES/FR, CSP con nonce, bloqueo anónimo, sin cookies y sin POST destructivos.
- La batería HTTP/seguridad actual suma **73 comprobaciones HTTP reales**: API, catalogo, consola, CSP, anticlíckjacking, OAuth sin cookie, cinco vídeos originales con diez rangos HTTP 206.
- CI completo [Bellaquitas Fase 5 — run 43859059479](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43859059479) — **SUCCESS**, los tres jobs.
- No se ha probado un iPhone físico: la emulación WebKit no lo sustituye. El usuario aplazó esta prueba hasta la publicación.

## 3. Integridad D1 confirmada después de pruebas

- Staging: **7 perfiles, 2 admin, 1.999.998 puntos actuales/históricos, 0 visitas**.
- Restauración aislada del origen: **6 perfiles, 2 admin, 1.999.998 puntos actuales/históricos, 0 visitas**.
- Sesiones admin activas distintas demostrables por D1 staging: **una**. Cuentas admin con password vinculada: **cero**. El flujo de vinculación ha superado CI con dos usuarios ficticios, no equivale a inicio real de ambos administradores.
- Medios del staging continúan servidos por Workers Static Assets; R2 no está configurado.

## 4. Gates que permanecen estrictamente pendientes

`realHttp206AndIosAndroidPlayback`, `bothRealAdminLoginsVerified`, `productionDatabaseBackupConfirmed`, `exposedBackupKeyRotatedOutOfChat`, `realDeviceQrDoorTest`, `finalEsFrMobileVisualParity`.

Las pruebas manuales positivas de administrador, Android y QR ya declaradas por el propietario **se respetan y no se solicitan de nuevo**. Sin evidencia independiente de ambos accesos Cloudflare, sin backup PostgreSQL integral y rotación privada, y sin prueba física iPhone no se dan por superados los gates estrictos. Sigue `productionChangesAuthorized=false`.
