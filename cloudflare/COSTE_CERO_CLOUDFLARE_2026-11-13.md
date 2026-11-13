# Bellaquitas Fest — modo **solo gratuito** para Cloudflare
**13/11/2026 · Fase 5 · Implementado en rama de auditoría, NO desplegado**

## Contrato del propietario

**No contratar, no cambiar a Paid, no aceptar cargos automáticos, no permitir que el código use un servicio cuyo exceso pueda facturarse.** En caso de duda, el sitio debe **fallar cerrado** (deshabilitar la función), nunca generar una factura inesperada. No alterar la web pública, los puntos ni las visitas reales.

La protección de código no puede modificar la modalidad de facturación de **toda la cuenta** Cloudflare. En particular, un bucket R2 existente puede seguir acumulando cargos de almacenamiento aun cuando ninguna petición del Worker lo use. Se requiere verificar y gestionar la suscripción en la cuenta y sus otros recursos, además del código, antes de declarar coste cero. Las alertas de presupuesto **no son límites de gasto**.

## Estado real verificado

- La rama oficial `main` y el Worker remoto **no se han cambiado**. El dominio y los vídeos MP4 de GitHub Pages quedan intactos.
- Cloudflare se consultó previamente en modo lectura: hay **0 namespaces KV**. No se ha creado ninguno.
- La conexión de Cloudflare devuelve **403** para suscripciones y facturación. **No hay confirmación autorizada de que la cuenta no pueda generar cargos.**
- Existe R2 en el staging anterior; no se borran archivos ni se cambia la suscripción sin copia verificada y autorización. El código actual desplegado **todavía no incluye este guardia**.
- No se realizaron operaciones R2 ni se enviaron emails reales durante estas pruebas.

## Qué se ha implementado en el candidato

`cloudflare/qa-candidates/free-only-cost-policy.js` se ejecuta **antes de cualquier ruta** en `bellaquitas-api-staging-admin.js`:

1. Exige `COST_POLICY=free-only`. Si no existe, **HTTP 503** antes de consultar D1, R2, KV o los servicios externos. Esto hace que una publicación mal configurada no funcione, en lugar de usar servicios potencialmente facturables.
2. En modo Free-only entrega a todos los handlers un `env` protegido: `MEDIA` (R2), `RESEND_API_KEY`, `RESEND_FROM` y banderas de acceso R2 desaparecen. No importa que `R2_MUTATIONS_APPROVED` o `R2_READS_APPROVED` estén accidentalmente en `yes`: no quedan accesibles en esa petición.
3. **HTTP 423** al pedir subir, leer o servir una imagen dinámica desde R2, ya sea pública o a través de administración. También se protege la entrada a rutas que intentan crear fotos. El guardia anterior de R2 sigue bloqueando escrituras/borrados por defecto.
4. Desactiva los envíos y activaciones que dependan de un proveedor externo de correo con cuotas susceptibles de facturarse, sin interrumpir la lectura de catálogo y de páginas que solo utilizan D1.
5. La web pública original se mantiene en GitHub Pages; logos y vídeos originales no pasan a R2. La galería con nuevas fotos **queda temporalmente suspendida** hasta incorporar y validar una alternativa de cuota gratuita no facturable como KV Free, con sus límites y retraso de propagación.
6. Los tests Node usan R2/SQLite completamente falsos con un permiso exclusivo al **objeto de ensayo en memoria**, no una variable de cuenta o petición HTTP. Los tests reales de Free-only comprueban que incluso con las viejas banderas `yes` no se realiza ninguna lectura/escritura R2.

## Cuotas nativas oficiales en **Workers Free**, a 13/11/2026

| Servicio | Cuota Free documentada | Qué pasa al superarla |
| --- | --- | --- |
| Workers | **100.000 peticiones/día**, **10 ms CPU por solicitud** | HTTP 1027 / error al agotar cuota; configurar rutas **fail closed**, nunca fail open |
| D1 | **5 millones de filas leídas/día; 100.000 escritas/día; 5 GB totales** | consultas fallan; no se convierte en uso de pago estando en Workers Free |
| KV | **100.000 lecturas/día, 1.000 escrituras/día, 1 GB almacenado** | rechaza operaciones de la cuota correspondiente; **KV no está conectado aún** |
| R2 | **10 GB-mes, 1 M Class A, 10 M Class B al mes incluidos** | **puede cobrar exceso de almacenamiento y operaciones** si hay suscripción facturable; se bloquea desde el candidato |

Fuentes:
- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/d1/platform/pricing/
- https://developers.cloudflare.com/kv/platform/pricing/
- https://developers.cloudflare.com/r2/pricing/
- https://developers.cloudflare.com/billing/manage/budget-alerts/

No prometer que el Worker se mantendrá disponible tras agotarse las cuotas Free: para proteger el presupuesto puede fallar temporalmente.

## Ensayos aprobados sin nube ni credenciales

- Prueba aislada del guardia: `cloudflare/test_free_only_cost_guard.mjs` (R2 lecturas/escrituras, email, ausencia de flag, flags antiguas, D1 libre).
- Prueba integrada: `cloudflare/test_admin_console.mjs`, usando el mismo candidato y R2 con método espía que lanzaría error si se toca; **cero llamadas a R2** con Free-only.
- CI: https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43358166429

## Obligatorio antes de publicar fase 6

- Verificar en la cuenta Cloudflare real **Workers Free** y **D1/KV Free**. **No usar plan Paid, ni cualquier producto facturable o con renovación automática.**
- Revisar **Billing → Subscriptions / Billable Usage** y comprobar que no haya pagos automáticos ni un R2 activo que facture solo por estar almacenando objetos. Si hay datos en R2, respaldar y restaurar antes de intentar retirarlos. No eliminar el bucket con datos reales como atajo.
- No enlazar R2 en el Worker final, ni su URL pública, ni rutas externas de acceso; configurar y probar `COST_POLICY=free-only` y el rechazo de todas las lecturas y escrituras.
- Workers Routes con **fail closed** cuando alcance el máximo gratuito (evita bypass a endpoints privados).
- Valorar KV Free para fotos sin asumir disponibilidad inmediata; nunca KV para puntos, QR, permisos o sesiones.
- Una alternativa al correo externo debe tener límites **gratuitos duros**, si se necesitan emails. La reducción temporal de emails no equivale a resolver la recuperación de contraseñas.
- Copias reales, restauración aislada, conciliación de socios/puntos/visitas, control de CPU, prueba de rollback y autorización expresa reciente.
- `phase6_readiness.py` exige ahora evidencia privada de los controles anteriores: sin esas verificaciones **NO da el visto bueno**.

## Advertencia

**Ningún script de aplicación puede garantizar 0 € en toda la cuenta Cloudflare** si hay otros Workers, suscripciones, buckets, renovaciones o cargos fuera de su control. Un presupuesto/alerta por 0 USD tampoco suspende el servicio. Solo una comprobación completa de suscripciones y recursos, con servicios no facturables o cuotas estrictas, permite alcanzar la política deseada. Este trabajo permanece en laboratorio hasta cumplirla.

## Estado de suscripción indicado por el propietario (13/11/2026)

El propietario informa que **ya canceló la suscripción de Cloudflare R2**, pero que la vigencia de esa suscripción termina **el 10/12/2026**. Es una declaración del propietario, **no una confirmación desde la API de facturación**, cuyo acceso había devuelto 403. No presentar la cuenta como verificada sin cargos hasta comprobar en Facturación que la suscripción figura como cancelada, que no haya renovación automática ni otros productos facturables y que no existan importes pendientes de facturar por uso anterior.

El bucket R2 de Bellaquitas ya se eliminó con todos sus objetos el 13/11/2026; **no hay que volver a crear uno**. Antes y alrededor del 10/12/2026, revisar el estado de la suscripción y cualquier factura pendiente. Esa fecha por sí sola no constituye una autorización para cambiar planes, cobrar, desplegar ni modificar la web oficial.

## Confirmación visual de suscripciones — 13/11/2026

El propietario compartió una captura de **Cloudflare → Facturación → Suscripciones**, sin subirla al repositorio. En ella aparecen literalmente:

- **Workers Free — Activo**.
- **R2 Paid — «Caduca el Dec 10, 2026»**.

Esto aporta comprobación visual de que **Workers** está en Free y de que **R2 Paid** tiene fecha de caducidad **10/12/2026**; coincide con la cancelación que el propietario indicó previamente. **No hay constancia en esa imagen del importe de facturas o del consumo anterior**, porque las pestañas «Uso facturable» y «Facturas» no están abiertas. Tampoco confirma si otros servicios pueden facturar. No confundir R2 Paid todavía vigente con un bucket activo: el único bucket R2 de Bellaquitas fue eliminado y verificado como ausente.

**Sin modificar** la suscripción, la web, la configuración o la cuenta; solo se ha registrado la evidencia visual sin datos de pago ni capturas.
