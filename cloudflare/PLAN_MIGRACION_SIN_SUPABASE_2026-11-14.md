# Bellaquitas Fest — decisión: no utilizar Supabase
**14/11/2026 · Fase 5/6 · Versión de auditoría NO desplegada**

## Arquitectura elegida por el propietario

- **Web, aspecto, imágenes y 5 MP4:** GitHub Pages + dominio `bellaquitas.fr`. Mantener los 19 blobs `assets/`, HTML, CSS, ES/FR y navegación originales.
- **API, inicio de sesión con Google, QR, puerta y fidelidad:** Cloudflare Workers Free.
- **Usuarios, roles, visitas, puntos, recompensas, eventos y sesiones:** Cloudflare D1 Free, única base futura.
- **Panel separado:** `https://bellaquitas.fr/administracion/` en nueva pestaña, misma sesión pública mediante cookie `__Host-bf_session` HttpOnly. Sesión independiente `__Host-bf_admin`; la comprobación de permisos se hace en D1.
- **Almacenamiento nuevo:** sin R2. Los logos, vídeos y fotografías que deban mantenerse públicos necesitan ficheros estáticos accesibles sin servicio facturable. Las subidas dinámicas están bloqueadas temporalmente hasta escoger una solución gratuita verificable.
- **No usar:** Supabase como proveedor de autenticación, base de datos, API ni origen de recursos **en la versión nueva**. No contratar planes ni cuotas para resolverlo.

## Verificaciones reales de Cloudflare, solo lectura

D1 staging `bellaquitas-staging`, EU: **7 perfiles** (6 ya existentes + 1 cuenta ficticia de QA), **6 sujetos Google vinculados a seis perfiles distintos**; distribuidos en 2 administradores, 1 puerta y 3 socios. **0 identidades huérfanas**. Total disponible conservado en la instantánea D1: **1.999.998 puntos**, 0 visitas.

El Worker de staging ya tiene **`GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` configurados como secretos** (los valores no fueron consultados ni mostrados), además de D1. La ruta OAuth verifica firma Google RS256, audiencia, nonce, PKCE y vincula por subject firmado, **nunca por email ni por nombre**. `ALLOW_NEW_ACCOUNTS` debe permanecer `no` hasta completar verificación y reconciliación. Los datos de producción no fueron modificados.

**Bloqueo de esquema confirmado:** D1 remota **NO tiene** la columna `auth_sessions.auth_method` y **NO tiene** la tabla `admin_sso_sessions`. Las migraciones `0005-auth-session-method.sql` y `0007-admin-sso-sessions.sql` ya existen en GitHub, pero SOLO han pasado en bases ficticias. **No aplicarlas a D1 con datos reales** antes de crear/verificar su copia privada. Las sesiones D1 previas deben pasar al estado no verificado y renovarse por Google, nunca autorizar automáticamente a un admin.

**Aún existe** en el Worker desplegado antiguo un binding R2 obsoleto y un secreto de correo externo. El Worker futuro NO debe incluirlos; el candidato Free-only los bloquea, pero la configuración REMOTA no se ha modificado.

## Cambios realizados en rama de auditoría

1. Panel nativo: `qa-candidates/admin-console-browser.js` ya no importa SDK ni lee tokens de un proveedor externo; usa únicamente la cookie pública Cloudflare y `/administracion/api/sso`.
2. Backend: `qa-candidates/admin-console-routes.js` usa `auth_sessions`, `admin_sso_sessions` y rol `profiles.role='admin'`; no verifica JWT externos ni ofrece otra contraseña de panel. Logout revoca solo la sesión privada administrativa.
3. HTML/CSP: el panel ya no carga `/config.js` ni un SDK externo. El ensamblaje del Worker no importa ningún puente anterior.
4. Google OAuth: el destino oficial después de login, en `bellaquitas.fr`, se ha preparado para volver a `/#/mi-espacio` en lugar de la vista previa.
5. Se retiraron de la rama la integración antigua y su workflow obsoleto. El intento de reactivar su flag de autenticación queda bloqueado `503`.
6. **Nuevo respaldo sin proveedores externos:** `cloudflare/backup_d1_solo.py` exporta D1 con Wrangler a un directorio privado del equipo, comprueba roles y puntos, cifra GPG AES256, compara SHA-256 y permite verificar/restaurar en SQLite LOCAL nuevo. No lleva datos ni contraseñas a GitHub.
7. El candado `phase6_readiness.py` ha sido REEMPLAZADO por requisitos específicos de **Cloudflare-D1-only**: exige respaldo/restauración real, 6 sujetos Google, 2 logins administradores auténticos, cuotas Free, media original, cuenta ficticia excluida, frontends sin backend antiguo y autorización expresa.

Pruebas sintéticas verdes:
- [Google OAuth + D1 + administrador, sin proveedor anterior](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43559062444)
- [D1 cifrado y restauración sintética](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43559502335)
- [Candado fase 6 solo D1, cierre seguro](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43559754391)

## Bloqueos para completar migración

1. **Respaldo D1 real cifrado y restauración privada real**, con prueba contra el estado y cuentas actuales. El programa no se ejecutó con datos reales; usa herramientas y credenciales que permanecerán en el ordenador del dueño, no en este chat.
2. Aplicar `0005` + `0007` después del backup verificado, en candidato aislado o staging autorizado y con rollback; volver a verificar las seis identidades y saldos sin mutarlos.
3. **Adaptar el frontend PÚBLICO.** El `app.js` publicado todavía depende de la solución antigua; el nuevo panel nativo por sí solo no sustituye login, tarjeta QR, puntos o control de puerta del sitio. El control de publicación prohibirá el corte hasta probar la versión Cloudflare del frontend sin referencias externas.
4. **Medios de portada:** el contenido D1 de staging todavía conserva URLs anteriores hacia 3 logotipos. No cambiar el diseño a ciegas: verificar equivalencia con imágenes originales de GitHub y sustituirlas por URLs fijas de `/assets/`. Sin R2 ni almacenamiento ajeno.
5. **Email/contraseña y recuperación:** las 6 cuentas tienen Google vinculado, pero la compatibilidad de otros modos de acceso todavía debe comprobarse. No migrar hashes de contraseñas automáticamente ni hacer PBKDF2 costoso en Workers Free sin medir CPU; sin servicio gratuito de correo verificado, no activar recuperación.
6. **Dominio y OAuth:** Cloudflare sigue sin zona ni rutas `bellaquitas.fr`. Además de `/administracion/*` hay que servir rutas API como `/v1/auth/*` y demás operaciones protegidas desde el mismo origen. Configurar el redirect URI Google `https://bellaquitas.fr/v1/auth/google/callback` con control de propiedad y pruebas; requiere aprobación de cambio DNS y rollback.
7. Verificar en Free **100.000 solicitudes/día**, CPU **10 ms/invocación**, D1 **5 millones de filas leídas y 100.000 escritas al día**, sin cargos ni upgrades automáticos. La cuota no garantiza disponibilidad si se supera.
8. Confirmar manualmente ES/FR, iPhone, Android, vídeo, QR, login Google, puerta y sesiones sin alterar puntos ni visitas reales de prueba.

## Cómo ejecutar el respaldo privado

Ver [guía Cloudflare D1 sin Supabase](./GUIA_BACKUP_D1_SIN_SUPABASE_WINDOWS.md). El script tiene `--check`, `--self-test`, `--run`, `--verify` y `--restore-local`. **La copia real no se ha realizado todavía.**

**Estado de producción:** sin cambios de `main`, `bellaquitas.fr`, DNS, usuarios, puntos, visitas, vídeo ni contrataciones. No desconectar el backend publicado hasta que todas las funciones sustitutas estén probadas, respaldadas y el dueño apruebe el corte.


## Avance verificado: web pública D1, QR y puerta en Chrome (14/11/2026)

Se han desarrollado componentes nuevos **solo en la rama de auditoría**, sin modificar `app.js`, `index.html`, `styles.css` ni `assets/` del repositorio oficial:

- `qa-candidates/public-d1-read-routes.js`: GET `/v1/me/overview` limitado a los datos de la sesión D1, GET `/v1/door/overview` exclusivo a roles `puerta`/`admin` y GET `/v1/moments/public-photos` que únicamente devuelve medios de `assets/` de álbumes publicados. Ninguna escritura, no R2.
- `qa-candidates/public-d1-browser-impl.js`: cliente `fetch` con `credentials:'same-origin'` y `redirect:'error'` hacia `/v1/` del propio dominio, sesión en cookie HttpOnly. Adapta carga de eventos, recompensas, puntos, visitas, tarjeta QR y acceso de puerta. Las escrituras de puntos solo se delegan a endpoints D1 protegidos y continúan bloqueadas en staging.
- `build-public-d1-candidate.mjs`: genera, **sin alterar los archivos originales**, `recovered-src/app-cloudflare.js`, `index-cloudflare.html` y `sw-cloudflare.js`. El índice candidato retira el script de configuración del proveedor anterior, elimina sus orígenes de la CSP y usa el código D1. El SW nuevo no cachea datos privados ni rutas `/v1/`, y evita servir accidentalmente el `app.js` viejo tras cambiar.
- Por protección de datos/coste el candidato **solo permite Google** hasta completar validación de email/contraseña Free y recuperación. El buzón de sugerencias **no afirma guardar mensajes** hasta que se configure Turnstile; las fotos dinámicas siguen bloqueadas mientras no exista almacenamiento gratuito verificado. Se conservan páginas y estilos.

Pruebas completadas con **solo cuentas y API locales inventadas**:

- [Rutas D1 por socio y puerta — 7 pruebas, aprobadas](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43565418221).
- [Web candidata: conservación del HTML, CSP, Service Worker, ES/FR, QR, puntos, foto/medio y Chrome escritorio/móvil — aprobado](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43566880422).
- [Batería completa fase 5 sin mutaciones — aprobada](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43566769049).

Prueba visual funcional Chrome: invitado ve la portada original; invitado no puede ver su tarjeta; socia ficticia ve **53 puntos**, cuatro visitas y tarjeta QR en móvil; personal ficticio de puerta puede abrir su pantalla y consultar el socio. El login real de Google en el dominio **NO** se probó en estas pruebas.

**Bloqueos que siguen vigentes:** backup D1 auténtico y restauración local real; ejecutar migraciones de sesiones D1 en entorno autorizado después del backup; separar cuenta ficticia de las seis reales; URL OAuth/Workers y zona `bellaquitas.fr`; corregir medios que aún referencien almacenamiento retirado; validar QR físico, sesión Google real, editor/administrador, correo/contraseña, recuperación, sugerencias, costes y reversión. Ninguna modificación de DNS, `main` ni D1 remota.
