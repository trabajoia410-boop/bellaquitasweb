# Bellaquitas Fest — auditoría de seguridad real, 13 de noviembre de 2026

**Fase 5 de 6; análisis de solo lectura de Supabase + cambios de candidato en GitHub. NO desplegado.**

## Permisos reales verificados sin escribir datos

Se consultaron `pg_policies`, `pg_class`, las subvenciones SQL y las funciones definidas en el proyecto Supabase oficial `vlsipvngvxcgnwrhpjgg` (solo SELECT). No se inició sesión como usuario ni se modificaron las cuentas reales.

- `public.profiles`: **RLS activado**.
- Rol `authenticated` tiene **SELECT directo únicamente** sobre `profiles`, no `INSERT`, `UPDATE` ni `DELETE` directos. El rol `anon` no figura con permiso de tabla.
- Política `read_profile`: `id = auth.uid()` o `is_staff()`; un usuario no puede consultar arbitrariamente las filas de los demás sin permisos de personal.
- `public.is_admin()` y `public.is_staff()` son funciones `SECURITY DEFINER` con `search_path` vacío, pero evalúan `auth.uid()` contra la tabla real `public.profiles`.
- `admin_update_member` valida explícitamente `auth.uid()` con rol `admin`, comprueba de nuevo el permiso bajo bloqueo de transacción, registra motivo y cambios y evita perder el último administrador.
- `register_visit` y `validate_redemption` comprueban personal autorizado mediante `is_staff()` y prohíben validar la tarjeta/canje propio; `request_redemption` se limita a la identidad actual; `update_display_name` solo cambia el nombre del usuario autenticado.

Esta revisión **no sustituye un pentest con cuentas reales controladas**. No se ha efectuado un intento real de subir rol, registrar visitas ni canjear puntos.

## Avisos Supabase Security Advisor (consulta de solo lectura)

La herramienta oficial devolvió **2 tipos de advertencias**:

1. **7 funciones `SECURITY DEFINER` expuestas a `authenticated`**: `admin_update_member`, `is_admin`, `is_staff`, `register_visit`, `request_redemption`, `update_display_name` y `validate_redemption`. Estas llamadas son en gran parte **intencionales para las funcionalidades de la web**. Se revisaron los controles de `auth.uid()` en su cuerpo; **no se han revocado permisos** porque se romperían la tarjeta/puerta y el panel. Ver https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
2. **Comprobación de contraseñas filtradas desactivada**. No se ha activado nada porque el propietario exige coste 0 €, y antes debe verificarse que la función esté disponible sin subir el plan. Ver https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

**Riesgo residual:** toda función elevada requiere tests de autorización y seguimiento de sus permisos cuando se cambie el esquema. Nunca dar por solucionados los avisos solo por ser funciones intencionales.

También hay avisos de rendimiento (4 claves foráneas sin índice, 3 tablas con políticas permisivas superpuestas, 5 índices sin uso registrado). No se ha tocado el esquema productivo ni se han creado índices que pudieran consumir recursos.

## Endurecimiento de Cloudflare SSO sin contraseña duplicada

En la rama de auditoría:

- `supabase-admin-bridge.js` llama al endpoint de usuario de **Supabase Auth** con la sesión existente y consulta `public.profiles` mediante RLS con ese token. La identidad validada debe coincidir con la fila `admin` en D1. No usa claves `service_role`.
- La cookie del token **padre de D1 se ha limitado a `/administracion`**, con nombre `__Secure-bf_admin_parent`, `Secure`, `HttpOnly`, `SameSite=Strict`; **no** se emite una cookie `__Host-bf_session` de `Path=/` que podría autorizar endpoints `/v1/admin` fuera del panel. La cookie `__Host-bf_admin` también requiere la comprobación del bearer Supabase por solicitud.
- `/administracion/api/logout` revoca la sesión padre D1 (cascada a sesión admin) incluso si el bearer Supabase ha desaparecido antes. **No elimina** la sesión de la web pública.
- Con `ADMIN_SUPABASE_BRIDGE=yes`, `free-only-cost-policy.js` **bloquea las rutas privadas D1 antiguas**, los inicios de sesión D1 por correo/Google y la administración fuera de `/administracion/api`. Evita rutas alternativas que no exigen identidad oficial Supabase.
- El navegador hace **una** llamada de puente al encontrar ya una sesión Supabase, sin probar antes el login D1 viejo, reduciendo peticiones del plan Free.
- Con `COST_POLICY=free-only` el Worker sigue sin acceder a R2 o servicios de correo externo facturables, y bloquea si falta la política.

**Importante:** Supabase puede seguir aceptando un access token JWT todavía no caducado después de que se cierre una sesión de refresco; no se promete revocación de JWT robados en tiempo real. El navegador deja de enviarlo tras salir, la cookie D1 queda limitada al panel y se revoca allí al cerrar; la autorización y el rol se comprueban en cada acceso. Antes del corte hace falta verificar la caducidad efectiva y la revocación con cuentas reales en entorno de pruebas controlado. La implementación permanece **apagada y sin despliegue**.

## Pruebas sintéticas aprobadas

- [Identidad oficial simulada y rol dual Supabase/D1, cookies y logout](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43463073298)
- [Bloqueo de rutas D1 antiguas y protección gratuita](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43463137142)
- [Regresión completa, sin alteración real de socios](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43463137767)
- [Candado de fase 6 y nuevas negativas obligatorias](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43463711224)

## Pendiente para completar fase 5

- Probar SSO real de las dos cuentas administradoras, origen `bellaquitas.fr`, cierre de sesión entre pestañas, denegación inmediata tras quitar el rol y posible expiración de JWT.
- Copia privada cifrada **real** de PostgreSQL/Auth/D1/Storage y **restauración real aislada**; los ensayos actuales de restauración son sintéticos.
- Confirmar Workers Free, fail closed, CPU, rutas de media finales y cobertura ES/FR/iPhone-Samsung/QR; no asumir que el candidato es producción.
- Verificar licencias y disponibilidad de protección de contraseñas filtradas sin contratar plan. No cambiar de plan, no recrear R2 y no enviar credenciales al repositorio.
- No publicar fase 6 ni tocar `main`, DNS o datos reales sin pruebas y autorización expresa.
