# Bellaquitas Fest — conciliación previa al corte (15 noviembre 2026)

**Lectura de los dos orígenes en vivo, sin modificar registros ni credenciales.**

- Supabase real (proyecto `vlsipvngvxcgnwrhpjgg`): todavía activo. Es la referencia de la web pública hasta el corte confirmado.
- Cloudflare D1 `bellaquitas-staging`: entorno de preparación; NO es la nueva producción.
- Worker QA: base independiente, sin perfiles ni puntos; no se ha mezclado con ninguno.

## Resultado de los recuentos de 12 tablas comunes

| Tabla | Supabase | Cloudflare staging | Diferencia |
| --- | ---: | ---: | ---: |
| profiles | 6 | 7 | +1 en Cloudflare |
| events | 1 | 1 | 0 |
| rewards | 0 | 0 | 0 |
| promos | 0 | 0 | 0 |
| redemptions | 0 | 0 | 0 |
| activity | 2 | 2 | 0 |
| admin_member_changes | 3 | 3 | 0 |
| site_content | 1 | 1 | 0 |
| site_drafts | 1 | 1 | 0 |
| community_suggestions | 0 | 0 | 0 |
| moments_albums | 0 | 0 | 0 |
| moments_photos | 0 | 0 | 0 |

### Puntos, roles y visitas

- Supabase: 6 perfiles, 2 admins, 1 personal de puerta, 1.999.998 puntos disponibles, 1.999.998 históricos y 0 visitas.
- Cloudflare: 7 perfiles, 2 admins, 1 personal de puerta, los mismos 1.999.998 puntos y 0 visitas.
- Los **6 IDs presentes en Supabase también existen en Cloudflare**, sin diferencias en `role`, `points`, `lifetime_points` ni `visits`.
- Cloudflare contiene **1 perfil adicional**: rol socio, vinculado a correo, creado en D1 el 10/11/2026 a las 23:53:05 (fecha según D1), 0 puntos, 0 visitas, 0 sesiones activas y 0 movimientos.
- No se han incluido nombres, correos ni IDs de usuarios en este informe.

## Comparación más profunda de los datos (15/11/2026)

Además de los recuentos, se compararon los registros completos con la misma clave primaria, normalizando únicamente diferencias de representación Postgres/SQLite (fechas, booleanos y campos JSON).

- `profiles`: 6 de 6 registros de Supabase coinciden campo por campo; 1 adicional solo en Cloudflare
- `events`: 1 registro idéntico
- `activity`: 2 registros idénticos
- `admin_member_changes`: 3 registros idénticos
- `site_content`: 1 registro idéntico, incluido `page_settings`
- `site_drafts`: 1 registro idéntico, incluido `settings`

**Total: 14 registros comunes coinciden sin diferencias de contenido.** Los otros seis grupos comunes tienen 0 registros en ambos sistemas. La comparación es una fotografía puntual; debe repetirse antes del cambio DNS.

**Identidades de acceso:** Los 6 usuarios `auth.users` de Supabase tienen 6 identidades Google vinculadas a sus perfiles (sin perfiles huérfanos). Las 6 correspondencias `profile_id`/`provider_id`/`sub` coinciden exactamente con `auth_identity_links` en D1 staging, incluidos 2 admins y 1 personal de puerta. D1 tiene además 1 perfil de correo que no aparece en Supabase.

**Incidencia de esquema:** La D1 staging aún NO contiene `auth_admin_sessions` (migración 0007) ni `auth_admin_email_links` (migración 0008), aunque ambas tablas ya están en QA aislado. La reautenticación real del panel requiere la migración 0007. No se aplicaron escrituras a staging; ver `AUTH_DATA_PARITY_2026-11-15.md` y el test ficticio `test-admin-migration-preflight.mjs`.

## Decisión de seguridad

**BLOQUEO:** no copiar tablas a ciegas, no eliminar ese perfil y no activar Cloudflare como producción hasta averiguar si el perfil adicional es una prueba o un usuario legítimo registrado exclusivamente en staging. La coincidencia de saldos globales no demuestra por sí misma igualdad de toda la base.

Antes del cambio definitivo:
1. Crear copia de seguridad verificable y cifrada de Supabase (incluido Auth/Storage), y mantenerla fuera del proveedor; rotar clave expuesta del archivo antiguo.
2. Repetir recuentos y comparaciones de IDs y campos críticos inmediatamente antes del corte; bloquear si hay un nuevo delta.
3. Establecer el tratamiento de perfiles creados solo en Cloudflare o solo en Supabase, sin sobrescrituras automáticas.
4. Verificar los dos administradores reales mediante login y panel separado, sin crearlos otra vez.
5. Confirmar que los archivos estáticos (vídeos y 3 logos recuperados) son originales.
6. Conservar DNS y producción sin cambios hasta finalizar y documentar rollback.

**Ninguna escritura se ejecutó sobre bases reales durante esta conciliación.**
