# Bellaquitas Fest — fase 6: comprobación consolidada y puertas de cierre

Fecha: 19/11/2026. Último estado comprobado directamente por conectores GitHub, Cloudflare, proveedor de origen (solo lectura), Resend y Biblioteca de documentos.

**ESTADO FORMAL: NO PUBLICAR, NO DELEGAR DNS, NO FUSIONAR EL PR #3, NO APROBAR COSTES.** Se mantienen las obligaciones originales: 0 €; 7 cuentas, 2 administradores y 1.999.998 puntos; vídeos/QR/web intactos; no usar el proveedor antiguo como alojamiento final; no repetir Google ni Resend.

## Evidencias comprobadas

1. **GitHub**: `trabajoia410-boop/bellaquitasweb`, visibilidad **public**, rama `migracion/fase5-segura-20261114`, PR #3 **draft=true**, sin fusionar. Antes de este documento, el commit `342e5b1d6dc1080987e42173be366ceba3c00dc6` tuvo los **3 suites de GitHub Actions en success**: QA migración, Cloudflare safe QA y prepublicación/seguridad con WebKit y Chrome. Los ejecutores son estándar `ubuntu-latest`.
2. **Cloudflare**: zona `bellaquitas.fr` sigue `pending` y `Free Website`. Los Workers `bellaquitas-api-staging` y `bellaquitas-api-preproduccion` siguen en versiones previas del 18/11: la optimización de la API en la rama GitHub no está desplegada ni medida. El Worker `bellaquitas-media-qa` se actualizó el 19/11 a versión `9589f76c-b33c-440d-9547-ad6aa5032bcd`.
3. **CPU real**: la versión nueva de MEDIA mostró 40 solicitudes exitosas, CPU P99 de **2,042 ms** y cero errores en la muestra; la versión anterior, 2.368 solicitudes y CPU P99 **222,455 ms**. **Muestra insuficiente** para certificar CPU máxima bajo 10 ms, particularmente Safari Range al final del MP4. La API staging tiene P99 histórico muy por encima de 10 ms y no recibió aún la optimización del repo. No marcar `cpu10msVerified`.
4. **D1 y fuente histórica**: verificación directa repetida el 19/11: **12 tablas** originales, **14 de 14 registros** iguales y **6 de 6 identidades Google** coincidentes contra D1 destino, cero registros originales ausentes. D1 destino preserva el perfil extra email; totales comprobados previamente **7 perfiles, 2 admins, 1.999.998 puntos, 0 visitas**. Se preservan sesiones únicamente según política migratoria, no se importan cookies antiguas.
5. **Respaldo cifrado**: el archivo de Biblioteca `BELLAQUITAS_D1_COPIA_CIFRADA_2026-11-18.bqbk` pudo leerse como JSON; se verificó con implementación SHA-256 autocontrolada el hash de sus **6.536 bytes cifrados**, igual a `65ea99d27f4f8132758d5a80cdffb6649c0405bdcdbd123ca490e0438bebce8f` incluido en el fichero. Algoritmos declarados AES-256-GCM y RSA-OAEP-3072-SHA256. **No se descifró ni exportó material privado**, y la plataforma continúa denegando `files.materialize` para el archivo. La restauración anterior ya fue verificada en fase 5, pero **no hay prueba de custodia de clave fuera de ChatGPT ni recifrado de clave antigua**.
6. **Resend**: consulta directa actual del conector devuelve `bellaquitas.fr` **verified**, `sending=enabled`, región `eu-west-1`, sin recreación de credenciales ni envío de mensajes.
7. **R2 y servicios**: API de Cloudflare devuelve **0 buckets R2**; Workers Free confirmado previamente por capturas del titular, así como facturación visible de R2/D1 a cero en esas capturas. El panel todavía listaba R2 Plan con final de cancelación previsto 10/12/2026. **No existe auditoría autorizada completa de facturación**: API de suscripciones devolvió HTTP 403 por falta de `Billing Read`. Es incorrecto afirmar 0 € de riesgo para todos los productos a futuro sin esa prueba.
8. **DNS y seguridad**: Cloudflare mantiene zona pendiente, 10 DNS preparados según acta previa, sin rutas públicas de Workers ni delegación de nameservers. Preproducción conserva `SITE_MODE=preproduction`, `PUBLISH_APPROVED=no`, `FINAL_ORIGIN_RECONCILED=no`, `BACKUP_KEY_CUSTODIED=no` y política de `FREE_TIER_BILLING_VERIFIED=no`; no se han cambiado desde este informe.
9. **Costes de QA**: repo GitHub `public` + runners estándar `ubuntu-latest`; no se han solicitado runners de pago ni nuevos servicios Cloudflare por esta intervención. En cuenta Cloudflare hay 7 D1 y 8 Workers ya existentes; no se han creado más.

## Trabajo técnico de este tramo

- Reconciliación reciente fuente original vs D1 con consultas exclusivamente SELECT.
- Verificación criptográfica independiente del contenido cifrado presente en Biblioteca, sin extraer clave ni descifrar datos.
- Revisión real de estado de GitHub/Cloudflare, incluyendo el estado de los despliegues y suites de test.
- Verificación de Resend, R2 y políticas de gastos sin crear servicios ni generar correo.
- Actualización de `release-gates-2026-11-15.json` para registrar que la integridad del ciphertext está verificada, conservando `privateRecoveryKeyStoredOfflineByOwnerVerified=false`.

## Puertas que todavía bloquean el cierre de fase 6

A. **Custodia fuera de ChatGPT** de la clave de recuperación y rotación de la clave antigua compartida previamente: es una condición material de seguridad, no certificable por lectura de Biblioteca. No publicar con `BACKUP_KEY_CUSTODIED=no`. No copiar secretos a GitHub, ChatGPT ni correo.
B. **Verificación de gasto cero integral**: comprobar el plan Workers Free ya conocido y ausencia de suscripciones de pago efectivas en el panel de facturación, incluido R2 cancelado. El conector carece de permiso para leer facturación; mantener `billingAuditComplete=false`.
C. **CPU y compatibilidad real**: despliegue aislado y seguro del candidato de API staging con los tests de WebKit, perfiles de rutas de contraseña PBKDF2 y vídeo Range. Sin superar el límite de 10 ms en las pruebas representativas, no aprobar el gate de CPU. Las comparaciones históricas de QA no sustituyen la prueba del candidato.
D. **Delta definitivo de origen y congelación de escrituras** en el momento del corte. El 14/14 actual no impide cambios posteriores. Mantener reversión preparada y las 7 cuentas.
E. **Cambio de DNS controlado** preservando web y correo; solo después de superar A–D y autorización expresa. Con zona `active`, realizar la prueba de Google OAuth y Resend en dominio canónico **antes de activar rutas finales**. No manipular DNS previamente.
F. QA físico acordado de iPhone, QR/puerta y 2 administradores reales **después de publicar**, sin convertirlo en prerrequisito manual de los controles anteriores.

## Conclusión

**La fase 6 sigue abierta intencionadamente.** Ningún bloqueador se puede dar por resuelto basándose en afirmaciones del asistente o flags sintéticos. Conservar todo el trabajo completo, no rehacer OAuth, Resend, D1, QR o vídeos desde cero; antes de cualquier operación irreversible, verificar el estado actual y respetar el presupuesto 0 €.

## Actualización de validación QA: 19/11/2026

- **CPU por código de respuesta**: Cloudflare GraphQL `workersInvocationsAdaptive` agrupada por `httpResponseStatus` identifica el principal cuello de botella en **HTTP 206** de staging: 1.082 solicitudes y P99 **280,650 ms**. En contraste, HTTP 200 tuvo 5.220 solicitudes y P99 **5,875 ms**, HTTP 401 tuvo 972 solicitudes y P99 **4,041 ms**. Esto es histórico del Worker de staging aún sin optimizar; **no equivale a demostrar el coste de contraseñas login/reset ni la CPU máxima**.
- **Regresión EOF**: `cloudflare/test-free-cpu-policy.mjs` ahora verifica HTTP 206 también en el último bloque `bytes=25437514-25437524` de un vídeo original de 25.437.525 bytes, asegurando que la API staging utiliza solo `VIDEO_QA_PROXY`, sin recorrer el MP4 directo, sin cookies y sin cabecera de autorización. Es una prueba aislada sintética, no una medida de CPU real.
- **Build de staging**: `.github/workflows/deploy-bellaquitas-api-staging-safe.yml` contiene guardas explícitas para la rama, el Worker existente, D1 **staging** aislada, ausencia de cambios de DNS, preservación de secretos con `keep_vars`, pruebas HTTP y rollback a versión anterior si falla el smoke test. Su primera ejecución detectó que **no existe `CLOUDFLARE_API_TOKEN` / `CF_API_TOKEN` accesible en GitHub Actions y saltó el despliegue**, conservando staging intacto.
- **Empaquetado realmente probado**: la siguiente ejecución de ese flujo aprobó **`npx wrangler@4.160.0 deploy --dry-run --config cloudflare/wrangler-api-staging.jsonc`** incluso sin token privado, por lo que el empaquetado de la API staging pudo verificarse sin publicación ni escrituras D1. El despliegue remoto sigue omitido. **No pedir de nuevo Google/Resend ni confundir la ausencia de token de GitHub Actions con falta de credenciales de proveedores en Cloudflare.**
- Si hay nuevas confirmaciones de CI después de esta actualización, comprobar las suites por SHA; no afirmar success de las que sigan en ejecución.
- Todas las puertas anteriores de claves offline, auditoría integral de facturación, CPU real staging, delta final y DNS **continúan bloqueadas**.


**Precisión de despliegue (verificación API posterior):** el Worker `bellaquitas-api-preproduccion` desplegado mantiene `SITE_MODE=preproduction`, `PUBLISH_APPROVED=no`, `FINAL_ORIGIN_RECONCILED=no` y `BACKUP_KEY_CUSTODIED=no`; la variable `FREE_TIER_BILLING_VERIFIED` **no aparece como binding de texto en la versión desplegada**. Figura como `no` en la configuración del candidato de GitHub. La ausencia de esa variable no se interpreta como aprobación; además, la versión vigente sigue en modo preproducción y la zona continúa sin rutas Worker. No dar por desplegados los cambios de gate de CPU/facturación de la rama.

## 19/11/2026 — auditoría adicional de bloqueos, sin modificar infraestructura

1. **Consultas Cloudflare Billing**: GET de `/accounts/{account_id}/subscriptions`, `/billing/spend-policies`, `/billing/usage` y `/billing/history`: **4× HTTP 403** por la autorización actual. No se ha utilizado ninguna vía de evasión ni inferido un estado de facturación inexistente. El panel sigue siendo necesario para acreditar todas las suscripciones; **no poner `billingAuditComplete=true`**.
2. **Inventario GET de recursos**: 0 buckets R2, 0 espacios KV, 0 Queues, 0 índices Vectorize, 0 espacios Durable Objects. Stream e Images respondieron 403. No se crearon productos de pago ni se eliminaron datos.
3. **Resend `get_usage`**, consulta de solo lectura: dominio `bellaquitas.fr` ya verificado, envío habilitado, correos día **0/100**, mes **3/3000**, contactos **0/1000**, dominios **1/3**. No se envió ningún mensaje ni se modificó el servicio. Cuotas compatibles con uso gratuito, sin certificar facturas/plan contractual.
4. **Fuente nativa de identidad**: SELECT de `auth.users` del sistema original devuelve 6 usuarios, **0 con `encrypted_password`**, 6 emails verificados; `auth.identities` confirma 6 Google. **No hay contraseñas nativas del proveedor antiguo que migrar**. Mantener íntegros 6 enlaces Google y la séptima cuenta email propia de D1. No equivale a garantizar un acceso autenticado sin prueba real.
5. **DNS lista para revisión**: zona pendiente sigue con 10 registros (4 A GitHub Pages; 2 CNAME GitHub Pages y Resend; 1 MX y 3 TXT), sin `proxied` para registros de correo. NS Cloudflare previstos `donald.ns.cloudflare.com` y `tricia.ns.cloudflare.com`; históricos Hostinger `cosmos.dns-parking.com` y `nova.dns-parking.com`. 0 rutas Worker y 0 Workers Domains. **No delegar ni activar ruta**.
6. **Archivos de claves**: existe en Biblioteca un fichero que describe la clave original y la herramienta autónoma HTML de recifrado sin instalación; NO se ha encontrado por el buscador el fichero original `BELLAQUITAS_RESPALDO_CIFRADO_2026-11-16.bqbk` para recifrarlo directamente. La copia nueva `BELLAQUITAS_D1_COPIA_CIFRADA_2026-11-18.bqbk` está disponible para lectura de su contenedor y tiene checksum cifrado verificado, pero no prueba custodia offline de la clave privada. No copiar, leer ni publicar material privado de recuperación.

**NO SE HAN CERRADO:** factura integral de Cloudflare, clave privada fuera de chat y reenvuelta, despliegue/medición CPU de API staging, congelación/delta del corte, DNS/callback Google y envío real Resend canónico. Dejar los flags bloqueados para evitar publicación insegura.

## Protección DNS/Resend y consumo: comprobación ampliada del 19/11

- Resend devuelve dominio `bellaquitas.fr` como `verified`, `sending=enabled`, `region=eu-west-1`. **Comparación de contenido DNS exacta** Resend `get_domain` vs Cloudflare `GET /dns_records`: 4/4 registros (DKIM TXT, SPF MX prioridad 10, SPF TXT, SPF CNAME) idénticos, sin copiar valor DKIM a GitHub.
- Control del corte: `phase6-dns-fingerprints-20261119.json` conserva solo hashes SHA-256 de las 10 entradas de Cloudflare y nameservers requeridos, `test-phase6-dns-fingerprints.mjs` verifica 4 A, 2 CNAME, 1 MX y 3 TXT y que no se publican contenidos de registros.
- Cloudflare GraphQL `workersInvocationsAdaptive`: **17.311 invocaciones observadas** el 19/11 en 7 grupos de estado/Worker frente a 100.000 diarias de Free; muestra de telemetría, NO medidor de facturación definitivo ni garantía sobre tráfico futuro.
- Resend `get_usage` devuelve 3/3000 correos mensuales, 0/100 del día (cuotas), sin nuevos envíos. No se deduce de aquí la ausencia total de cuotas pagadas.
- El benchmark GitHub Actions con Node WebCrypto sintético de PBKDF2 6×100000 iteraciones dura **107,212 ms wall** en Node 22.23.4 (job 135400295219). No es CPU de Cloudflare Worker; **justifica el perfilado real en Worker** antes de habilitar contraseñas email, sin reducir seguridad ni cambiar credenciales.
- Las suites QA, seguridad y HTTP de fase 6 del commit `d85ce4e7fa47100e8e2d74863fff6698f818a4eb` terminaron correctamente. Los siguientes commits con DNS se auditan por su propio SHA, no heredan automáticamente success.

Sigue bloqueada la certificación integral de facturación (HTTP 403) y la custodia de clave fuera del chat. No cambiar DNS ni afirmar cierre de fase 6.

## Corrección basada en capturas previas — 19/11/2026

El propietario ya entregó las fotografías de Cloudflare en los chats anteriores. **Se aceptan expresamente como evidencias documentales**; la API OAuth devuelve 403 para Billing Read de manera normal. No exigir otro permiso API ni volver a pedir las mismas fotos.

- **Workers Free** confirmado por captura: precio 0 €/mes, cuota gratuita de 100.000 invocaciones diarias; no aparece Workers Paid contratado.
- **D1 y R2** muestran **$0,00** de consumo facturable en las capturas. D1 permanece bajo sus límites gratuitos; API confirma **0 buckets de R2**.
- **Suscripción R2**: la cancelación ya fue solicitada según historial; el panel la muestra activa hasta el **10/12/2026**. Se respeta su plazo, no se reactiva ni se contrata otro producto.
- **Estado contable**: estas imágenes confirman lo visible, pero no prueban ausencia de cualquier cargo futuro o de suscripciones ajenas a lo fotografiado. El gate `otherPaidProductsAbsentVerified=false` y `billingAuditComplete=false` queda conservado solo por ese riesgo pendiente, **NO porque falte Billing Read**.
- La comprobación de ausencia de cargos adicionales puede acreditarse con capturas/panel del titular y comprobación final de R2; **no depende de conseguir Billing Read API**.
