# Bellaquitas Fest — Auditoría de permisos Supabase (solo lectura)

**Fecha:** 11/11/2026 · **Proyecto comprobado:** `vlsipvngvxcgnwrhpjgg` · **Estado:** no se ha aplicado ningún cambio a la base de producción.

## Resultados verificados

- La organización asociada con Bellaquitas Fest utiliza **Supabase Free**. No se ha cambiado el plan.
- **12 de 12 tablas de `public` tienen RLS activado**. La auditoría de Supabase no ha detectado una tabla expuesta sin RLS.
- El Security Advisor señala **7 funciones `SECURITY DEFINER` accesibles a usuarios autenticados** y una advertencia de *leaked-password protection* desactivada.
- Las siete funciones señaladas **no permiten ejecución directa al rol `anon`** (`has_function_privilege('anon', oid, 'EXECUTE') = false`). Sí están disponibles para usuarios `authenticated`, conforme al diseño actual del cliente.
- Estas funciones tienen `SECURITY DEFINER` y propietario de privilegio elevado (`postgres`). Es importante seguir auditándolas: están expuestas a usuarios autenticados aunque ejecuten con mayor permiso.

## Revisión individual de las siete funciones

| Función | Comprobación interna observada | Evaluación |
|---|---|---|
| `admin_update_member` | `auth.uid()` debe pertenecer a perfil `admin`; valida rol, puntos, visitas, motivo, bloqueo del último admin y registra cambios | Autorización interna presente |
| `register_visit` | Requiere `auth.uid()` y `is_staff()`; verifica código, impide autovisita, impide duplicado diario | Autorización interna presente |
| `validate_redemption` | Requiere personal autorizado, comprueba código, estado pendiente e impide validar canjes propios | Autorización interna presente |
| `request_redemption` | Usa `auth.uid()` del solicitante, bloquea saldo de su propio perfil, comprueba coste y premio activo | Operación por usuario presente |
| `update_display_name` | Requiere `auth.uid()` y solo actualiza el propio perfil | Operación por usuario presente |
| `is_admin` | Comprueba el rol admin de `auth.uid()` | Función auxiliar intencional |
| `is_staff` | Comprueba el rol puerta o admin de `auth.uid()` | Función auxiliar intencional |

**Conclusión:** los 7 avisos no prueban por sí solos una escalada de permisos, pues se observaron comprobaciones internas de identidad y rol. Aun así, conservan riesgos potenciales y no hay que revocar `EXECUTE` indiscriminadamente: esto rompería el QR, los canjes, el panel o las políticas que dependen de `is_admin`/`is_staff`.

## Advertencia de contraseñas filtradas

El Security Advisor indicó que la comprobación automática de contraseñas previamente comprometidas está desactivada en Supabase Auth. Según la tabla de prestaciones del **plan Free**, la función de *leaked password protection* no forma parte de Free. **No se recomienda pasar a Pro**: contradice el requisito de presupuesto cero. En el backend Cloudflare se revisarán, en cambio, validaciones de contraseña, límites de intentos, captcha y el futuro diseño de hash.

## Verificaciones sin datos personales

- Inventario público de esquema: `public` tiene 12 tablas y todas usan RLS.
- `auth` tiene cuentas e identidades que requieren respaldos completos. El proyecto conserva seis usuarios en cada una de esas tablas.
- **Supabase Storage tiene 3 objetos en el bucket `bellaquitas-media`**. Son archivos binarios, no quedan respaldados simplemente exportando PostgreSQL.
- Cloudflare D1 contiene las tablas necesarias para perfiles, identidades, sesiones y editor, pero su inventario real debe conservarse.

## Recomendaciones antes de fase 6

1. Mantener intactos los permisos Supabase en producción hasta culminar el cambio reversible.
2. Preparar/validar una copia **privada y restaurable** de PostgreSQL (incluidos `auth` y `storage`), **los 3 archivos Storage**, D1 y los 20 objetos originales de R2.
3. Usar `cloudflare/backup_privado_local.py`: el modo `--self-test` está aprobado y no accede a ninguna cuenta; `--run` requiere configuración local segura e intervención del propietario. **No se ha ejecutado un respaldo real desde el chat.**
4. Verificar un ensayo de restauración completo de Postgres en una instancia de pruebas antes de publicar.
5. Finalizar análisis de CPU/contraseñas en Workers Free. Nada de planes de pago.
6. Hacer las pruebas físicas de iPhone/Samsung **después del cambio de fase 6**, como quedó acordado.

## Referencias oficiales

- Avisos Supabase sobre `SECURITY DEFINER`: https://supabase.com/docs/guides/observability/advisors?lint=0029_authenticated_security_definer_function_executable
- Respaldos en Supabase Free: https://supabase.com/docs/guides/platform/backups
- Los backups de PostgreSQL no incluyen los archivos binarios Storage: https://supabase.com/docs/guides/storage/management/download-objects
- Protección de contraseñas disponible según plan: https://supabase.com/pricing

**No se han revelado identidades ni credenciales, ni ejecutado SQL destructivo.**
