# Bellaquitas Fest — fase 6: comprobación de límites gratuitos y R2 (19/11/2026)

## Evidencia aportada por el propietario

Se recibieron tres fotografías del dashboard Cloudflare: facturación R2, vista Workers y páginas y vista D1. No contienen una factura definitiva ni autorizan cambiar configuración.

- **R2 / Uso facturable:** la tabla de tres productos muestra **$0.00** en todas las filas y en total; aparece pequeño consumo acumulado no facturable (aprox. 0.01 GB-mes de almacenamiento, 249 operaciones de una clase y aprox. 1.09k de otra). No se interpreta como cobro.
- **Workers:** el panel muestra solicitudes del día **por debajo del máximo de 100.000** y errores de observabilidad 0/200.000. La imagen no permite atribuir números exactos con precisión suficiente para automatizar umbrales; la suscripción Workers Free ya se verificó con capturas anteriores.
- **D1 / vista Hoy (19/11):** 7/10 bases de datos, aprox. 1.08k/5M filas leídas, 0/100k filas escritas, 1.87 MB/5 GB de almacenamiento; uso facturable estimado **$0.00**.

## Confirmación por API Cloudflare (solo lectura)

Consulta de lista de buckets R2 mediante API de cuenta: **0 buckets existentes**, respuesta success=true. No se eliminaron objetos ni se editó la configuración. El uso R2 del periodo mostrado puede deberse a actividad anterior a la eliminación; este dato no demuestra por sí solo que la suscripción R2 esté cancelada definitivamente o que otras facturaciones futuras sean imposibles.

## Política de presupuesto cero y estado

- La zona del dominio está en Free Website y la pantalla anterior confirmó Workers Free.
- En el repositorio se encuentra el bloqueo `FREE_TIER_BILLING_VERIFIED=no` y el registro `phase6ZeroSpend` aún exige `otherPaidProductsAbsentVerified=true` y `billingAuditComplete=true`. **No alterar estos falsos por capturas parciales.**
- **No hay evidencia de cargos por R2/D1 en las capturas actuales**, pero no se afirma que toda la cuenta esté libre de cargos futuros sin ver detalle de suscripciones y facturas.
- El plan Workers Free bloquea peticiones adicionales al alcanzar su límite diario; no se promete disponibilidad ilimitada ni gasto cero de otros proveedores. Los vídeos deben conservar HTTP 206 en iPhone y no se puede saltar el gate de seguridad para ahorrar invocaciones.

**Operaciones ejecutadas:** solo consultas API de lectura y documentación en la rama de migración. No se han modificado Workers, bases D1, DNS, Hostinger, R2, usuarios ni puntos. PR #3 debe seguir draft.
