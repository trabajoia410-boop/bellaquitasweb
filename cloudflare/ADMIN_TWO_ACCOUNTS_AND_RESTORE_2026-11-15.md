# Bellaquitas Fest — respaldo restaurado tras instalar el panel y pruebas de dos administradores

**Fecha: 15 de noviembre de 2026.** Afecta exclusivamente a la **migración de preparación**. No se modificaron Supabase activo, `bellaquitas.fr`, GitHub `main`, DNS, puntos ni visitas.

## 1. Nueva restauración aislada en D1 (real)

Se creó la base privada **`bellaquitas-restore-postadmin-20261115`** (jurisdicción **UE**, sin conexión a ningún Worker). Es la **quinta de diez** bases incluidas en el máximo del plan D1 gratuito, según la documentación consultada el 15/11/2026. No se contrató ningún servicio de pago.

Origen de la copia: D1 **`bellaquitas-staging`**, que ya contiene las migraciones administrativas `0007` y `0008` y el panel desplegado en su Worker.

Se restauraron y comprobaron, **sin almacenar los registros privados en GitHub**:

| Elemento | Origen | Restauración | Resultado |
| --- | ---: | ---: | --- |
| Tablas | 22 | 22 | Mismos nombres y DDL |
| Índices propios | 17 | 17 | Mismos nombres y DDL |
| Triggers | 5 | 5 | Mismos nombres y DDL |
| Total de objetos de esquema comparados | 44 | 44 | Sin diferencias |
| Filas totales | 44 | 44 | **Coinciden campo a campo** |
| Perfiles | 7 | 7 | Coinciden |
| Puntos disponibles | 1.999.998 | 1.999.998 | Coinciden |
| Visitas | 0 | 0 | Coinciden |
| Cuentas administradoras | 2 | 2 | Coinciden |
| Sesiones administrativas reforzadas | 0 | 0 | Coinciden |
| Vinculaciones de correo administrativo pendientes | 0 | 0 | Coinciden |
| Integridad FK (`PRAGMA foreign_key_check`) | — | 0 errores | Correcto |

Se comprobó también que **ninguno de los cuatro Workers** de la cuenta tiene un binding D1 a la nueva restauración. Por tanto, no es accesible mediante la web pública ni los Workes de prueba actuales.

**Precisiones técnicas:** El intento de `PRAGMA integrity_check` fue rechazado por la API D1 con `SQLITE_AUTH`; NO consta ese chequeo. Sí constan comparación completa de esquema/filas y `PRAGMA foreign_key_check` sin errores. Durante la creación de los triggers el servicio devolvió asimismo un error al final de una operación, pero la comprobación posterior de `sqlite_master` confirmó que **los 5 triggers y los 17 índices se habían creado** y sus SQL coinciden exactamente con el origen. La validación definitiva de la restauración es la lectura y comparación después de aplicar todos los objetos, no el resultado aislado de aquella llamada.

## 2. Punto de restauración adicional

Se obtuvo un **bookmark Time Travel posterior al despliegue** de Cloudflare staging. Se guardó su valor exclusivamente en la D1 privada de archivos de respaldo con el identificador de referencia:

`post-admin-panel-backup-20261115`

El registro privado contiene la referencia a `bellaquitas-restore-postadmin-20261115` y los totales 7 perfiles / 1.999.998 puntos / 44 filas. El valor del bookmark no se ha publicado en Git ni en la conversación.

**Advertencia:** D1 Time Travel en el plan gratuito tiene retención de **7 días**. Esta nueva restauración aislada **no es** un archivo SQL cifrado descargado a un soporte externo. Todavía hay que crear y verificar ese archivo fuera de Cloudflare con **clave nueva**.

## 3. Pruebas aisladas de DOS cuentas administrativas

Archivo nuevo `cloudflare/test-two-admin-session-lifecycle.mjs`:

- Utiliza tres personas **ficticias** (dos admins + un socio) en **SQLite RAM**, con migración administrativa real `0007`.
- Emite dos sesiones con cookies `__Host-`, `Secure`, `HttpOnly`, `SameSite=Lax`.
- Bloquea cookies ausentes, incompletas, cruzadas y cuentas de socio.
- Verifica expiración de reautenticación, revisión del rol actual en cada solicitud y protección de cierre de sesión contra `Origin` externo.
- Verifica que cerrar sesión de admin A revoca solamente A, mientras B conserva acceso; **puntos/visitas ficticios quedan intactos**.

Se amplió `cloudflare/test-admin-email-link.mjs` para **dos administradores ficticios**:

- Cada uno conserva su misma identidad Google y obtiene su propia contraseña mediante confirmación por correo simulada, sin enviar mensajes reales.
- El enlace del admin A no se puede confirmar desde la sesión B. Los enlaces son diferentes, de un solo uso.
- Contraseña A no abre cuenta B. Ambas cuentas acceden con las credenciales correctas.
- **Ningún perfil duplicado y ningún punto/visita alterado**. Hashes y enlaces solo en SQLite RAM.

Ambos tests están incluidos en la integración continua de GitHub y el resultado es correcto:
- [QA migración](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43691248819) — éxito
- [Cloudflare safe QA](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43691248817) — éxito

## 4. Comprobación paralela de origen real

Consulta de solo lectura a Supabase **activo**: 6 perfiles, 2 administradores, 1.999.998 puntos, 0 visitas. Cloudflare staging y la restauración tienen 7 perfiles (incluye el socio adicional todavía por conciliar) y exactamente el mismo total de puntos/visitas.

**No se ha probado el acceso real de las dos personas con Google ni se ha vinculado correo/contraseña a sus cuentas.** Sigue pendiente, por decisión de no usar cuentas reales hasta preparar la publicación y el protocolo de prueba.

## 5. Requisitos aún pendientes antes de producción

- **Backup EXTERNO de Supabase activo** restaurado y comparado, y archivo de copia independiente con **nueva clave de cifrado generada fuera del chat**; la antigua ha quedado comprometida y NO se da por rotada.
- Accesos interactivos de ambas cuentas administradoras existentes, su autenticación reforzada y vinculación voluntaria de correo/contraseña con enlace de un solo uso.
- Conciliación del socio adicional staging y configuración correcta de Google OAuth/correo definitivo.
- Tres logos originales, cinco MP4 originales en Cloudflare QA, prueba HTTP Range 206 y validación real iPhone/Android.
- Pruebas físicas de QR, puerta y fidelidad, traducción ES/FR completa y comprobación visual final.
- No tocar DNS ni fusionar PR #3 hasta superar todas las condiciones del lanzamiento.

**La restauración aislada es válida como prueba de recuperación de staging; el control de release `productionDatabaseBackupConfirmed` sigue bloqueado.**
