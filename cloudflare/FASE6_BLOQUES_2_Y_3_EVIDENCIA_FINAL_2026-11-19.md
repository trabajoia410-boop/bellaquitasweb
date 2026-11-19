# Bellaquitas Fest — Fase 6, bloques 2 y 3: auditoría real y límites de cierre

**Fecha:** 19 de noviembre de 2026. **Ámbito:** solo rama `migracion/fase5-segura-20261114`, PR #3 borrador, Cloudflare Free, sin cambios de DNS, `main`, usuarios, puntos ni visitas.

## Bloque 2: seguridad y respaldo

### Completado y verificado

- Nueva copia `BELLAQUITAS_D1_COPIA_CIFRADA_2026-11-18.bqbk` con AES-256-GCM y encapsulación RSA-3072. Guardada en la Biblioteca del propietario. Restauración SQL/SQLite aislada: **22 tablas, 44 objetos**, 7 perfiles, 2 administradores, **1.999.998 puntos**, 0 visitas, integridad SQLite OK, integridad referencial sin errores.
- Custodia fuera del chat de la clave RSA del respaldo del 18 de noviembre **confirmada por el propietario anteriormente**. No pedirle de nuevo la clave ni publicarla.
- Respaldo histórico `BELLAQUITAS_RESPALDO_CIFRADO_2026-11-16.bqbk` y archivo de clave antigua localizados en Biblioteca. `files__materialize` devuelve `This Project file does not have an authorized raw-byte materialization path` para los **dos** archivos. No se ha descifrado ni re-cifrado el respaldo REAL.
- La antigua herramienta `BELLAQUITAS_REENVOLVER_RESPALDO_ANTIGUO_SIN_INSTALAR.html` únicamente cifraba **juntos** el archivo original y su clave antigua. Esa medida **no rota criptográficamente la clave del respaldo original**.
- Nueva herramienta `cloudflare/ROTACION_AUTENTICA_RESPALDO_ANTIGUO_OFFLINE.html`: sin conexiones (CSP `connect-src 'none'`), acepta el respaldo antiguo y su clave desde archivos locales, comprueba SHA-256 original `57b6e0f513fbe76bdc502afe95420fb79d806eae21ba727d525014d00a6ecfcb`, descifra AES-GCM nativo v1, valida gzip+SQL+longitud+SHA-256 de texto claro, genera clave AES-256 nueva e IV nuevo, vuelve a cifrar el SQL comprimido y **verifica descifrado/restauración con la clave nueva** antes de ofrecer dos archivos independientes. Nunca modifica el original.
- `cloudflare/test-rotate-legacy-offline.mjs` crea un respaldo **sintético** con formato AES-GCM v1, lo rota en un motor JavaScript aislado y comprueba que la nueva clave recupera el mismo SQL, que no contiene la vieja clave y que se rechazan archivos alterados, clave falsa, formato no permitido y digest original no coincidente. Añadido al CI `.github/workflows/bellaquitas-phase5-preflight.yml`, **prueba de seguridad aprobada** el 19/11/2026.
- Si el respaldo real utiliza otro formato, la herramienta **falla cerrado**. La prueba sintética no equivale a haber rotado el archivo real. Una copia antigua ya distribuida junto a la clave expuesta no puede revocarse retroactivamente.

**Estado bloque 2:** respaldo independiente **COMPLETO**, rotación del respaldo histórico **NO VERIFICADA** porque el sistema no autoriza el acceso binario al archivo viejo ni a su clave. No borrar originales ni marcar el gate `originalEncryptedBackupRotated`.

## Bloque 3: presupuesto gratuito y CPU

### Inventario real leído de Cloudflare

| Recurso | Evidencia a 19/11/2026 |
|---|---|
| Zona | `Free Website` / `pending` |
| Workers | `Workers Free` por captura del propietario, **8 scripts**; sin abrir plan Paid |
| D1 | **7 bases**, suma tamaño archivos **1.867.776 bytes**, dentro de Free (hasta 10 bases / 5 GB por cuenta) |
| R2 | 0 buckets |
| KV | 0 namespaces |
| Queues | 0 colas |
| Vectorize | 0 índices |
| Durable Objects | 0 namespaces |
| Images | 0 imágenes |
| Rutas/dominos Workers personalizados | 0 |
| Workers con dominio `bellaquitas.fr` | 0 |
| Stream | API HTTP 403, sin visibilidad suficiente |
| Dispatch namespaces | API HTTP 403, sin visibilidad suficiente |
| Suscripciones Cloudflare | API `/subscriptions` HTTP 403 |
| Políticas de gasto | API `/billing/spend-policies` HTTP 403 |

- El propietario aportó **capturas anteriores** Workers Free (0 €/mes), D1/R2 $0 y R2 cancelación programada al 10/12/2026. Aceptadas; **no volver a pedir las mismas capturas**.
- La auditoría de cuenta no puede demostrar ausencia de suscripciones de otros productos ni cierre administrativo de R2 mientras Billing/Subscriptions permanezcan sin permiso. Por ello `phase6ZeroSpend.billingAuditComplete=false` y `otherPaidProductsAbsentVerified=false`.
- En consulta de telemetría previa del 19/11, **26.662** invocaciones observadas, por debajo de 100.000 Workers Free/día; no representa factura completa ni garantiza picos futuros.
- Cloudflare Static Assets sin ejecutar Worker se sirve sin cargos por solicitud; si `run_worker_first` se activa, esas solicitudes sí pasan por Worker. Los cinco MP4 requieren HTTP 206 para iOS: no modificar su ruta sin ensayar byte-ranges desde inicio, centro y final y cabeceras. Referencias: https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/ y https://developers.cloudflare.com/workers/platform/limits/ .
- En el modelo Workers Free, Cloudflare termina peticiones al superar límites de recursos en vez de ofrecer una autorización para pagar más; los servicios facturables independientes exigen auditoría específica.

### Hallazgo técnico crítico de CPU: prueba real y limpieza

1. Se ejecutó **una sola invocación sintética** del esquema real `pbkdf2-chain6-sha256-v1` en un Worker temporal sin bindings ni D1, 6 fases consecutivas de 100.000 iteraciones de WebCrypto SHA-256 (600.000 total). Contraseña y sal de test, no se utilizó ningún usuario.
2. GitHub Actions `44544536646` job `135631451750` comprobó respuesta **HTTP 200**, hash exacto coincidente con vector sintético; no hubo errores de lógica ni escrituras.
3. Cloudflare GraphQL `workersInvocationsAdaptive` filtrado por nombre de Worker temporal `bellaquitas-kdf-synthetic-once-20261119` y versión `5e50ff70-f057-4fb8-9bcb-24942ee03cdc`: `sum.requests=1`, estado `success`, `max.cpuTime=136424` microsegundos = **136,424 ms CPU**, frente al **límite Workers Free 10 ms**. **El HTTP 200 no certifica compatibilidad**.
4. Se deshabilitó su subdominio y se **eliminó el Worker temporal**, confirmando posteriormente HTTP 404 y 8 Workers finales. También se eliminó el workflow temporal del repo.
5. Política `cloudflare/release-policy.mjs` reforzada: `cpu10msVerified` exige ahora `phase6CpuSafety.realPasswordKdfFreeCompatible === true`, además del máximo/P99/errores y pruebas 206. Archivo de gates lo mantiene **false**, y `FREE_TIER_CPU_VERIFIED=no` sigue en el Worker privado. CI incluye prueba que fuerza todos los otros gates simulados a `true` y confirma que este `false` bloquea la publicación.
6. **No reducir PBKDF2, usar SHA-256 rápido, falsificar 10 ms, activar plan Paid ni habilitar login real**. Puede explorarse autenticación por enlace de un solo uso con Resend Free, pero sería un cambio de funcionalidad que requiere diseño, prueba y aprobación; todavía **NO implementado**.

**Estado bloque 3:** límites y recursos observables auditados y plan Workers Free acreditado, pero **NO CERRADO** por auditoría de facturación incompleta y **KDF > 10 ms CPU** en prueba real. El código falla cerrado. No es posible afirmar coste futuro 0 € para toda la cuenta con permisos actuales.

## Criterio de cierre y no repetir tareas ya hechas

- El trabajo técnico verificable está incorporado al PR #3; seguirán **bloqueados** DNS, merge, Worker público, credenciales y mutaciones hasta pasar los controles obligatorios.
- **Para cerrar bloque 2:** ejecutar el recifrado real sobre los archivos antiguos en un entorno privado con autorización de lectura y verificar el nuevo archivo; no basta con las pruebas sintéticas.
- **Para cerrar bloque 3:** resolver algoritmo/arquitectura de contraseña que cumpla la CPU real y conservar función acordada, y obtener evidencia efectiva de facturación completa sin cobros de otros productos. La API actual devuelve 403 y no se inventará una certificación.
- Este informe **no declara** ni el bloque 2 ni el bloque 3 finalizados. Pruebas manuales de iPhone, QR y admin permanecen diferidas hasta después de publicación, sin renunciar a integridad y seguridad previas.

**Sin cambios en usuarios, puntos, visitas, DNS, `main`, secretos reales ni planes de pago.**
