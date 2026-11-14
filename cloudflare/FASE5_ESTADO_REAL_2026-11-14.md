# Bellaquitas Fest — resultados reales del 14/11/2026

**Fase 5/6 — NO listo para publicar.** Solo auditoría en GitHub `auditoria/fase5-2026-11-11`. Sin cambios en `main`, DNS, producción, perfiles, roles, puntos ni visitas.

## 1. Respaldo auténtico de usuarios, puntos y datos — PENDIENTE

- Supabase **Free**, proyecto `vlsipvngvxcgnwrhpjgg` activo PostgreSQL **17**. **Sin backups automáticos** en Free; requiere exportación manual por propietario.
- Programa privado de copia `cloudflare/backup_privado_local.py` preparado para extraer PostgreSQL/Auth, D1 staging y **3 originales Supabase Storage**, cifrar con GPG AES256, comparar nueve métricas agregadas y huella individual por perfil. R2 eliminado, 0 buckets.
- El respaldo D1 usa ahora **`cloudflare/wrangler.backup.toml` explícito**, con ID `c7ada9c9-d397-4e22-b5b8-3fbd8d13e550` y jurisdicción `eu`, para impedir confundirlo con otra base. No implementa ni publica Workers.
- `restore_privado_aislado.py` verifica los hashes y restaura solo en una base local vacía, comparando cuentas y puntos; requiere un servidor PostgreSQL 17 local con roles/extensiones compatibles con Supabase.
- **NO se ha generado un dump de los datos auténticos**, ni archivo GPG real, ni restauración real: el conector Supabase aquí permite consultas SQL, pero no un `pg_dump` completo de Auth/Storage hacia un equipo privado sin credenciales locales. En ningún momento se han exportado datos personales a GitHub.
- [QA de backup y config segura, con datos sintéticos: OK](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43547533110). [Guía de ejecución privada en Windows](./GUIA_COPIA_PRIVADA_Y_RESTAURACION_WINDOWS.md).

## 2. Panel con administradores auténticos — VÍNCULO VERIFICADO, SESIÓN PENDIENTE

Consulta real en Supabase, `auth.users`, `auth.identities`, `public.profiles` y D1 staging, solo lectura, sin almacenar ni registrar IDs:
- **2 de 2 administradores** con fila `auth.users` e identidad `google` válida.
- **2 de 2 roles `admin` coinciden** por identificador entre Supabase y D1.
- Código candidato verifica el access token con `/auth/v1/user`, el rol actual mediante RLS y D1 antes de permitir una sesión privada. No usa service_role ni copia contraseñas.
- Se corrigieron **dos imágenes del panel** que apuntaban incorrectamente a `/espejo/assets/logo-navbar.png`; ahora utilizan `/assets/logo-navbar.png`, disponible en la web original. La consola está preparada como pestaña aparte.
- [Puente SSO ficticio: OK](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43547685314), [Chrome y móvil con fixtures: OK](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43547840399), [aceptación con datos ficticios: OK](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43547840385).
- **NO se ha probado el login real de estos administradores:** no existe acceso a la sesión autenticada del navegador del propietario y no se debe pedir que revele JWT, cookies ni contraseñas. Tampoco se ha publicado el panel. No son pruebas equivalentes.

## 3. Ruta `bellaquitas.fr/administracion/` y límites gratis — PREPARACIÓN HECHA, SIN DESPLIEGUE

Auditoría real Cloudflare:
- **0 zonas para `bellaquitas.fr`** y 0 custom domains Workers. Una ruta del Worker bajo el dominio requiere que el dominio sea zona Cloudflare activa y DNS proxied. **No se han tocado DNS ni nameservers Hostinger**.
- El único Worker actual `bellaquitas-api-staging` todavía tiene un binding `MEDIA` al bucket R2 eliminado y secretos de servicios antiguos; no es el Worker candidato ya depurado. No desplegar el antiguo en la ruta final.
- La candidata permite que `/administracion/*` pase por Workers; `/`, `/assets/*` y `/config.js` seguirían siendo GitHub Pages del mismo origen, sin alterar diseños ni vídeos. **Falta zona/route real**.
- [Prueba estática de ruta, logos, JS/CSS, API mismo origen y R2 denegado: OK](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43547985765).
- Free (documentación Cloudflare): Workers **100.000 peticiones/día, 10 ms CPU/llamada, 50 subrequests**; D1 **5 millones filas leídas/día, 100.000 escritas/día, 5 GB totales, 500 MB por DB, 10 DB**. La D1 de ensayo ocupa aproximadamente 264 KiB; no demuestra que el tráfico futuro vaya a entrar en los límites o que el login funcione a 10 ms de CPU.
- **Supabase Free puede pausarse por baja actividad** tras 7 días; usar Supabase Auth en Workers no soluciona por sí solo ese riesgo. El requisito de disponibilidad continua sin pago sigue sin garantía.
- API de facturación Cloudflare devuelve HTTP 403 al conector; las capturas anteriores del usuario indican 0 USD observados en noviembre, **no son comprobación actual de consumo futuro ni garantía de 0 EUR**.
- [Plan detallado de same-origin y rollback, sin cambiar DNS](./FASE5_PLAN_DOMINIO_PANEL_CERO_EUROS.md). Documentación: https://developers.cloudflare.com/workers/configuration/routing/routes/ ; https://developers.cloudflare.com/workers/platform/limits/ ; https://developers.cloudflare.com/d1/platform/pricing/ ; https://supabase.com/docs/guides/platform/free-project-pausing .

## Resultado

**Tareas verificadas hoy:** admin IDs/Auth/Google/D1 ligados; configuración D1 backup sin peligro de elegir otra base; logotipos del panel en ruta real; pruebas CI de navegador y coste; límites Free documentados; ninguna llamada de escritura o despliegue.

**Bloqueos reales:** copia PostgreSQL completa cifrada **auténtica** y restauración aislada no efectuadas; SSO de admin **con sesión real** no probado; zona Cloudflare/DNS/Worker privado no preparados para tráfico real; uso CPU y gratuidad a escala no comprobados; riesgo de pausa Supabase Free sin solución gratuita garantizada.

**Solo después** de resolverlos y aprobar formalmente el corte podrá avanzar la fase 6. No se han contratado planes, reactivado R2, alterado la producción ni publicado el código de prueba.
