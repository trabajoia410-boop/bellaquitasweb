# Bellaquitas Fest · Fase 6 — Continuación verificada (20/11/2026)

**Ambiente:** rama de migración `migracion/fase5-segura-20261114`, PR #3 borrador. **NO producción**. No cambiar DNS, `main`, puntos, permisos ni sesiones reales.

## 1. Datos y copias: lectura comparativa auténtica

A través de API Cloudflare D1 se hizo `SELECT *` de las 14 tablas siguientes:
`profiles`, `auth_identity_links`, `auth_email_credentials`, `events`, `activity`, `admin_member_changes`, `site_content`, `site_drafts`, `rewards`, `promos`, `redemptions`, `community_suggestions`, `moments_albums`, `moments_photos`.

Se ordenó la representación completa de las filas dentro de la ejecución privada del API y se comparó por igualdad exacta; **no se devolvieron ID, correos, claves, nombres de socios ni hashes a la conversación/GitHub**.

| D1 | Perfiles | Puntos | Administradores | Resultado 14 tablas |
|---|---:|---:|---:|---|
| Producción preparada | 7 | 1.999.998 | 2 | Referencia |
| Staging | 7 | 1.999.998 | 2 | 14/14 iguales |
| Restauración 15/11 | 7 | 1.999.998 | 2 | 14/14 iguales |
| Restauración aislada 14/11 | 7 | 1.999.998 | 2 | 14/14 iguales |
| Origen recuperación 16/11 | 6 | 1.999.998 | 2 | Histórico: no contiene el séptimo perfil |

Las 14 tablas suman 23 filas de negocio/identidad (algunas contienen columnas JSON). No se afirma paridad de las tablas de sesiones efímeras, auditoría de migración ni de las tablas no enumeradas. **No se ha consultado en vivo el origen antiguo tras el snapshot**, por lo que sigue pendiente la conciliación del delta final.

El séptimo perfil ya fue auditado el 15/11: identidad de email verificada, rol socio, cero puntos y cero visitas. **Debe conservarse** hasta una política de fusión/corte explícita.

La copia D1 cifrada y restaurada del 18/11 está documentada en `FASE5_BACKUP_D1_CIFRADO_Y_RESTAURADO_2026-11-18.md`; esa prueba no se repitió indebidamente. Los archivos históricos `BELLAQUITAS_RESPALDO_CIFRADO_2026-11-16.bqbk` y su antigua clave constan en Biblioteca, pero una nueva llamada a `files__materialize` para ambos volvió a informar `This Project file does not have an authorized raw-byte materialization path`. **Rotación REAL del respaldo histórico no realizada.** Mantener copia y clave antiguas fuera de la web.

## 2. Integración Clerk reforzada sobre el trabajo EXISTENTE

Se encontró código previo en PR #3: puente JWT RS256, planificador de identidad Google, intercambio de sesiones condicionado por flags y vista QA con controles. No volver a implementar desde cero ni copiar credenciales.

Se reforzó la migración `cloudflare/migrations/0008-clerk-verified-links.sql` en esta rama:
- Las vinculaciones nuevas se crean como `pending`, nunca confirmadas por defecto.
- `migration_confirmed` exige `verified_at` y prueba del `provider_subject` original asociado al mismo perfil.
- Triggers de integridad rechazan cambio a identidad de origen que pertenezca a otro perfil y reasignación de la ficha.
- El planificador offline conserva `evidenceProvider=google` y `evidenceSubject` verificado; no vincula por email o por nombre.
- Se añadieron seis pruebas SQLite offline `cloudflare/test_clerk_links_guard.py` y ejecución en QA de GitHub.

**Importante:** un match histórico en D1 tampoco prueba posesión actual de Clerk por sí solo. El backend exige JWT firmado por emisor permitido y únicamente consulta vínculos ya confirmados. La confirmación exige verificación independiente del Google `sub` en Clerk. El panel admin mantiene su segundo paso de seguridad.

La nueva tabla **no se ha aplicado a D1 de producción preparada ni a staging**, ya que no hay cuentas Clerk verificadas y la fase 6 está protegida. La prueba SQL se hace en SQLite aislado de CI. Existe una rama separada PR #4 de QA preliminar; tomar PR #3 como integración principal para evitar dos migraciones incompatibles.

## 3. Cuenta y gasto cero

- API R2: **0 buckets**; Worker scripts: ocho previamente inventariados.
- Cloudflare Billing y Subscriptions: **403, sin Billing Read**. No afirmar ausencia global de cargos.
- Capturas previas del propietario acreditaron Workers Free. Documentación del proveedor: 100.000 peticiones/día y 10 ms de CPU por petición en Free; al superar se interrumpe la función. **No elevar plan ni activar productos con coste**.
- Clerk: app Bellaquitas, instancia **development**, **0 usuarios** en último recuento; sin instancia de producción. Google desarrollo habilitado; Google producción requiere credenciales propias. No generar nuevas cuentas para completar artificialmente la migración.
- CPU PBKDF2 antigua 136,424 ms medida previamente en el Worker sintético y retirada; no usar esa ruta en Workers Free. El camino Clerk/JWT queda por medir con cargas reales y sin exponer usuarios.
- No se han creado Workers ni buckets nuevos, modificado rutas DNS ni aprobado facturación.

## 4. Puertas que impiden el corte

1. Proveedor original vivo: certificar deltas de usuarios/identidades y reconciliar los siete perfiles sin pérdidas.
2. Clerk producción: configuración final de Google, control de correo/contraseña, identidad de seis Google verificada y séptimo socio preservado.
3. Respaldo histórico: rotación real imposible desde archivos Biblioteca sin permiso de materialización; conservar backup nuevo y llave separados.
4. Gastos: verificar la ausencia de otros planes facturables sin volver a pedir capturas ya aceptadas; el conector no puede leer Billing.
5. CPU, vídeo HTTP 206 y seguridad/roles: QA end-to-end del Worker candidato con actividad real controlada antes de reemplazar.
6. `release-gates-2026-11-15.json` y los flags del Worker de preproducción **permanecen cerrados**. Las pruebas físicas personales siguen diferidas hasta después de publicar.

No se promete que la fase 6 esté terminada ni que la web haya sido migrada. Esta anotación registra trabajo real sin exponer datos sensibles ni activar gastos.
