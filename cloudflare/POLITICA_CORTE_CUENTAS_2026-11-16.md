# Bellaquitas Fest — decisión de conservación y conciliación de cuentas (fase 5)
**Fecha:** 16 de noviembre de 2026. **Ámbito:** política aprobada para preparar el corte. **NO autoriza publicar, cambiar DNS, editar puntos o borrar cuentas.**

## Decisión inequívoca

1. Se **conservan las siete cuentas de D1 staging**, incluida la cuenta local posterior a la importación con correo y contraseña verificados. Su origen exacto no está probado; por ello nunca se eliminará ni se declarará ficticia.
2. Las seis cuentas heredadas por Google mantienen **exactamente sus identificadores de perfil y de Google**, sin generar duplicados.
3. **Se preservarán también las nuevas altas legítimas del origen** posteriores a la importación: una importación delta inmediatamente antes del corte no puede perderlas ni sustituir la cuenta local.
4. Los puntos disponibles, históricos, visitas, roles y códigos de socio de un perfil común entre los dos sistemas **no se sobrescribirán automáticamente** si divergen: se bloquea el corte para una conciliación explícita. Se prohíben restas, sumas y reinicios arbitrarios.
5. Se prohíbe que un correo electrónico o `provider_subject` termine asignado a dos `profile_id`; se preservan las credenciales email verificadas y la identidad asociada. Se aborta cualquier fusión con colisiones.
6. Se mantiene `ALLOW_NEW_ACCOUNTS=no`, `EMAIL_REGISTRATION_ENABLED=no` y `STAGING_MUTATIONS=disabled` durante las comprobaciones de staging. Esta decisión no habilita cambios en producción.
7. Antes del cambio, la prueba de integración exige: respaldo **real y externo de producción**, nuevo snapshot de origen y staging para calcular el delta, cuentas y contraseñas de los dos administradores verificadas, restauración independiente y una ruta de rollback.
8. **Si hay diferencias no conciliadas, no se ejecuta la importación ni el corte DNS.** Nunca borrar la cuenta exclusiva de staging para forzar un recuento de seis.

## Comprobación implementada

- `cloudflare/plan-account-cutover.mjs`: motor de plan **solo lectura, offline** con dos snapshots privados; valida unicidad de perfiles, códigos, identidades Google/email y credenciales; devuelve únicamente recuentos y aborta ante conflictos sin mostrar ID/email/hash.
- `cloudflare/test-account-cutover-policy.mjs`: pruebas sintéticas de seis perfiles originales, dos administradores, un perfil adicional email verificado; se prueban altas tardías y 12 casos de corrupción, divergencia, credenciales o identidades; no escribe en D1.
- [QA de migración aprobado](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43775436405) y [QA de seguridad aprobado](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43775440715).
- Cloudflare D1 **leída sin cambios**: siete perfiles, seis vínculos Google, un vínculo email, una credencial email, dos administradores, cero vínculos de identidad duplicados, `PRAGMA foreign_key_check` sin errores (verificación 16/11/2026).

## Alcance exacto del desbloqueo

Puede aprobarse el control `stagingOnlyAccountCutoverPolicyApproved`: la **política de conservación está decidida y automatizada**. Esto NO significa que la conciliación final de cambios de producción se haya realizado. Esta comparación requiere acceso a la última exportación del origen y sigue condicionada por `productionDatabaseBackupConfirmed` y por la puerta de publicación (PR #3 en borrador, DNS sin cambiar).

El motor, por defecto, rechaza cambios de puntos/roles entre fotos en lugar de resolverlos silenciosamente; no hace ninguna escritura en producción o staging.

**Todos los controles relativos a copia de producción, login real, vídeos/Static Assets, teléfonos físicos, QR y paridad final permanecen pendientes.**
