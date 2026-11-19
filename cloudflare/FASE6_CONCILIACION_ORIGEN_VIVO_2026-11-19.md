# Bellaquitas Fest — conciliación del origen vivo frente a Cloudflare D1 (19/11/2026)

**Solo lectura; sin publicar, cambiar DNS, modificar usuarios/puntos o acceder a secretos.**

## Contexto

Para fase 6 se obtuvo evidencia directamente de la instancia ORIGINAL aún activa por el conector de lectura de su base de datos; se utilizó exclusivamente como **fuente histórica de conciliación**, no como alojamiento definitivo. Se comparó con D1 privada `bellaquitas-produccion-preparada-20261116` mediante consultas SELECT a la API Cloudflare. No se repitieron exportaciones manuales ni se creó ningún servicio.

## Resultado 12 tablas de negocio

| Tabla | Filas origen | Filas D1 destino | Coincidencias por clave primaria | Diferencias de filas originales |
|---|---:|---:|---:|---:|
| profiles | 6 | 7 | 6 | 0 |
| activity | 2 | 2 | 2 | 0 |
| admin_member_changes | 3 | 3 | 3 | 0 |
| events | 1 | 1 | 1 | 0 |
| site_content | 1 | 1 | 1 | 0 |
| site_drafts | 1 | 1 | 1 | 0 |
| community_suggestions | 0 | 0 | 0 | 0 |
| moments_albums | 0 | 0 | 0 | 0 |
| moments_photos | 0 | 0 | 0 | 0 |
| promos | 0 | 0 | 0 | 0 |
| redemptions | 0 | 0 | 0 | 0 |
| rewards | 0 | 0 | 0 | 0 |

Comparación estructural de **14 registros originales, 14 coincidentes**. Se usaron ID de perfil/registro o `key` como identificador, y comparación de todos sus campos con normalización para equivalencia semántica de JSON, booleanos y marcas temporales. No se han almacenado nombres, correos, IDs de usuario ni hashes personales en el repositorio.

## Identidad y cuentas

- El esquema original `auth.users` tiene **6 usuarios activos**, con fecha de creación más reciente anterior a la exportación del 16/11.
- `auth.identities`: **6 identidades Google**, las 6 vinculaciones (`user_id`/perfil, `provider`, `sub`/provider_subject) coinciden contra D1 `auth_identity_links`.
- D1 destino: **7 identidades**, las 6 Google originales + **1 email adicional preexistente en Cloudflare**. Esta cuenta se conserva según `cloudflare/POLITICA_CORTE_CUENTAS_2026-11-16.md`.
- Recuento de puntos, visitas y roles de los 6 perfiles originales se incluye en la paridad íntegra de `profiles`; el total destino previamente comprobado permanece en **1.999.998 puntos, 2 admins y 0 visitas**.

## Límites de esta comprobación

**Esta lectura certifica la fotografía del 19/11, NO el delta definitivo de la ventana de corte.** La instancia original permanece activa: después de esta consulta podría ocurrir una alta/visita/cambio, y el proyecto exige comprobarlo otra vez y detener escrituras mutables durante el corte. Por ese motivo:
- `phase6ReconciliationAudit.originalProviderDeltaCertified=false` se conserva.
- `phase6PreproductionDb.finalAccountReconciliationCompleted=false` se conserva.
- `PUBLISH_APPROVED=no`, `BACKUP_KEY_CUSTODIED=no`, `FREE_TIER_BILLING_VERIFIED=no` se mantienen en la configuración.
- No se obtuvieron contraseñas o secretos del origen ni se consideró respaldada toda la autenticación nativa del proveedor anterior.

## Cuenta y presupuesto

El proyecto original está asociado a una organización cuyo plan el conector reporta como **free/tier_free**. No implica que se mantenga como alojamiento futuro ni acredita el costo de cada otro proveedor. Cloudflare Workers Free está acreditado por captura de usuario; facturación de toda la cuenta y baja administrativa de R2 siguen en revisión.

**Estado:** conciliación viva de 12 tablas y 6 identidades comprobada; publicación sigue bloqueada hasta custodia privada/rotación, auditoría gasto cero, delta final y autorización.