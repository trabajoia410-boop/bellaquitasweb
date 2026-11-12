# Bellaquitas Fest — conciliación individual de perfiles (solo lectura)

**Fecha: 12/11/2026. Rama de auditoría. NO es autorización para migrar.**

## Resultado

Se compararon los registros en **Supabase original** y **Cloudflare D1 staging** usando consultas exclusivamente `SELECT`. Se extrajeron únicamente los campos técnicos imprescindibles para la comparación; **no se incluyen IDs, códigos de socio, nombres, emails ni datos fila a fila en este informe**.

| Control | Supabase | Cloudflare D1 |
|---|---:|---:|
| Perfiles | 6 | 7 |
| Administradores | 2 | 2 |
| Puntos disponibles (suma) | 1.999.998 | 1.999.998 |
| Visitas (suma) | 0 | 0 |
| Perfiles originales que coinciden campo a campo | — | **6/6** |
| Perfiles originales ausentes en D1 | — | **0** |
| Perfiles originales con diferencias | — | **0** |
| Perfiles adicionales en D1 staging | — | **1** |

Para los seis perfiles originales se verificó la coincidencia exacta de **id, role, member_code, points, lifetime_points, visits**. Se compararon por identificador, no por nombre o email; los IDs y los códigos de socio no se almacenaron en este informe. No se modificaron los datos: D1 notificó `rows_written: 0`.

## Alcance y condiciones pendientes

1. Este es un **estado puntual** de 12/11/2026. La conciliación debe repetirse en las 24 horas anteriores al corte y después de la sincronización final.
2. D1 mantiene un perfil adicional que no pertenece a los seis originales. No se ha borrado ni editado; debe quedar excluido del conjunto que se publique, después de verificar su naturaleza ficticia.
3. La comparación de estos seis campos **no sustituye** los controles de autenticación, sesiones, historial de actividad, eventos, canjes, QR, contenido ES/FR, medios ni los respaldos y restauraciones reales.
4. El requisito `reconciliation.profiles_row_parity_verified` del comprobador `phase6_readiness.py` exige que una persona valide expresamente esta comparación con evidencia reciente fuera del repositorio. No se debe marcar `true` automáticamente ni inventar evidencias.
5. El dominio `bellaquitas.fr`, DNS, rama `main`, Worker desplegado, cuentas, puntos y visitas siguen sin cambios a causa de esta comprobación.

**Conclusión:** la migración de perfiles muestra paridad individual 6/6 con un registro extra de prueba en destino; el corte continúa **NO AUTORIZADO**.
