# Bellaquitas Fest — Panel de administrador en el mismo origen, sin segundo login

**13/11/2026 · Fase 5 · Plan sin desplegar ni tocar DNS**

## Problema confirmado

- La web pública de `bellaquitas.fr` utiliza `supabase-js` y guarda su sesión en el almacenamiento del origen **`https://bellaquitas.fr`**.
- Un panel que se abre en `*.workers.dev`, `admin.bellaquitas.fr` o incluso `www.bellaquitas.fr` **no puede recuperar directamente esa sesión local**, porque el navegador separa el almacenamiento por origen.
- Copiar el JWT al subdominio, meterlo en la URL, añadirlo a `localStorage` de un dominio externo o quitar el segundo login sin verificar el token **no es aceptable**.
- La prueba de SSO de un Worker ficticio no demuestra aún que la configuración de dominio esté disponible en producción.

## Candidato principal (sin cuotas de Cloudflare): misma URL/origen

1. Mantener el dominio **`https://bellaquitas.fr`** y la página pública de GitHub Pages *idénticos* (vídeos originales, ES/FR, tarjetas y diseño).
2. Servir **`/administracion/*`** desde la API Cloudflare **solo cuando se hayan validado y autorizado las rutas de dominio**. La web pública conserva el resto de sus rutas.
3. El usuario que ya ha iniciado sesión en Bellaquitas abre una **pestaña nueva** a **`https://bellaquitas.fr/administracion/`**, sin volver a escribir contraseña.
4. El navegador reutiliza su sesión Supabase en el mismo origen. El Worker **verifica** el JWT contra Supabase Auth, consulta rol actual bajo RLS y comprueba el mismo ID y rol `admin` en D1. Sesión D1 privada limitada a `/administracion`; los endpoints D1 heredados se bloquean en modo puente.
5. Al salir se invalidan ambas cookies internas D1 y se conserva la sesión pública Supabase.
6. Las rutas se configurarían con **Workers Free + D1 Free** y **fail closed**. Sin R2, sin plan Paid ni operaciones multimedia con recargos.

**Dependencia importante de infraestructura:** Cloudflare solo puede resolver rutas Workers bajo `bellaquitas.fr` si la zona y su tráfico están efectivamente gestionados por Cloudflare (DNS/proxy y ruta aplicable). Comprar el dominio en Hostinger **no basta** para hacer funcionar la ruta; tampoco se debe mover la DNS antes de revisar cert, HTTPS, GitHub Pages, redirecciones y rollback. **No se ha hecho cambio de NS, DNS, proxy, Worker desplegado, `main` ni dominio.** Se necesita autorización expresa tras pruebas de corte.

## Validación automática ya en la rama audit

El puente rechaza:
- Worker alojado en `*.workers.dev` aunque alguien falsifique `Origin: https://bellaquitas.fr`.
- `https://www.bellaquitas.fr` como origen de SSO si la sesión pública está en `https://bellaquitas.fr`.
- `PUBLIC_ORIGIN` incorrecto en la configuración del Worker.
- Usuario que no sea administrador en **ambas bases**, token no verificado, rol revocado y cookie sin bearer real.
- Sesiones de D1 reutilizadas después de logout y rutas administrativas fuera del panel.

Los tests son **100 % ficticios**, usan solicitudes a un origin `bellaquitas.fr` simulado en memoria y respuestas Supabase interceptadas; no prueban el DNS ni el login real.
[Pruebas SSO y dominio](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43478153316).

## Plan B si no se desea tocar el DNS al publicar

Servir un panel **estático** en `bellaquitas.fr/administracion/` desde GitHub Pages y enviar la sesión Supabase por `Authorization: Bearer` a la API Cloudflare, con CORS allowlist, verificaciones de rol de servidor **en cada petición** y sin depender de cookies de terceros. **No está implementado ni probado**: requiere un adaptador de API diferente y ensayos completos de permisos, CSRF, cargas, cookies, cierre de sesión y coste. No se debe confundir con el candidato actual.

## Pruebas pendientes imprescindibles

- Abrir y cerrar la sesión de dos administradores reales y una cuenta no admin **sin modificar puntos**; confirmar navegador Chrome, Safari iPhone y Android.
- Validar mismo origen, cookies `Secure` y RLS, rol revocado, Google OAuth/correo y sesión persistente tras actualización.
- Verificar con tráfico realmente servido por la configuración final de DNS, no únicamente con mocks.
- Bloquear los antiguos endpoints D1 privados; medir CPU y cuota Workers Free; toda ruta crítica `fail closed`.
- Ejecutar una copia privada real y una restauración real aislada, reconciliar los 6 perfiles, excluir fixture y obtener autorización expresa para fase 6.

**Decisión actualmente en vigor:** fase 5, solo GitHub rama `auditoria/fase5-2026-11-11`; el propietario exige preservar el sitio actual, ningún cargo y ningún cambio de DNS hasta validación.


## Estado confirmado el 14/11/2026 y despliegue preparado, NO ejecutado

**Auditoría real Cloudflare de solo lectura:** 0 zonas Cloudflare para `bellaquitas.fr`, 0 custom domains Workers y un Worker antiguo `bellaquitas-api-staging` que aún declara el binding del R2 `MEDIA`. El bucket y 20 objetos originales de la migración anterior están **eliminados**; el nuevo candidato evita esa dependencia. El dominio sigue funcionando en GitHub Pages. No existen las rutas Cloudflare necesarias para `/administracion/`, por lo que **no hay SSO real desplegado todavía**.

**Ruta que se implementará únicamente DESPUÉS de tener backup privado/restauración real y autorización del corte**:

```text
https://bellaquitas.fr/                → GitHub Pages original, igual que ahora
https://bellaquitas.fr/assets/...      → GitHub Pages: fotos y cinco vídeos
https://bellaquitas.fr/config.js       → GitHub Pages: clave ANON pública
https://bellaquitas.fr/administracion/*→ Worker Free protegido (ruta exclusiva)
```

Para que una ruta de Worker funcione en `bellaquitas.fr` es obligatoria una **zona Cloudflare activa y DNS de ese hostname proxied**, según la documentación oficial. **Añadir la zona y cambiar nameservers/proxy en Hostinger requiere un plan de vuelta atrás probado; NO lo hemos hecho.** La ruta debería configurarse para **fail closed**, no `fail open`, para evitar omitir el Worker ante error 1027. No adjuntar `R2`, `Resend` ni bindings innecesarios al Worker final.

Requisitos ya preparados y probados sin conexión real al navegador: HTML/CSS/JS de administración bajo `/administracion`, clave pública de config compartida, logos desde `/assets/logo-navbar.png`, bearer Supabase validado contra Auth + rol actual RLS + rol D1, cookies administrativas protegidas, bloqueo de APIs D1 heredadas y `COST_POLICY=free-only`. [Comprobación automática de rutas](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43547985765). **Estas pruebas son de candidato, no equivalen a una sesión real ni a un Worker desplegado en `bellaquitas.fr`.**

## Límites oficiales a comprobar antes de activar

- **Workers Free:** 100.000 solicitudes diarias (error 1027 al rebasar), máximo **10 ms de CPU por invocación** y 50 subrequests. Tiempo de espera de red normalmente no suma CPU.
- **D1 Free:** 5.000.000 filas leídas/día, 100.000 filas escritas/día, **5 GB de almacenamiento agregado, 500 MB por base y 10 bases**. Se bloquean consultas al superar cuota y no debe contratarse un plan de pago para resolverlo.
- D1 staging observada en la consulta de esta fase: **270.336 bytes, 20 tablas**, tamaño dentro de cuota (esto NO demuestra carga de producción, CPU real ni consumo diario futuro).
- **Supabase Free:** sin backups automáticos y **riesgo de pausa por baja actividad tras una semana**. Si la autenticación continúa usando Supabase Auth, no podemos prometer disponibilidad 24/7 sin pausas; hace falta estudiar una alternativa gratuita o aceptar expresamente la limitación antes de cortar. No proponer pago como solución automática.
- La API de facturación Cloudflare devuelve HTTP 403 para este acceso: las capturas del usuario aportan evidencia histórica de cero cargos, pero el asistente no puede certificar facturas actuales con el token conectado.

Fuentes oficiales: [Cloudflare Workers Free](https://developers.cloudflare.com/workers/platform/limits/), [Cloudflare D1 Free](https://developers.cloudflare.com/d1/platform/pricing/), [Cloudflare Workers Routes](https://developers.cloudflare.com/workers/configuration/routing/routes/), [Copias Supabase Free](https://supabase.com/kb/faqs/platform/free-plan-backups), [Pausas de Supabase Free](https://supabase.com/docs/guides/platform/free-project-pausing).

**No autorizado todavía:** cambios DNS, nuevas rutas Worker productivas, importación de datos reales, publicación `main`, uso de credenciales privadas del administrador o activación de servicios facturables.
