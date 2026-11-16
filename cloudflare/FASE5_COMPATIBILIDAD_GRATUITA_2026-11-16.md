# Bellaquitas Fest — compatibilidad con los límites gratuitos (16/11/2026)

**Verificación real Cloudflare + documentación oficial actualizada a octubre/noviembre 2026. Sin contratación de servicios nuevos.**

## Recursos utilizados

- Cloudflare D1: **6 bases en la cuenta** (límite Workers Free: **10 bases**).
- Suma aproximada de los tamaños que declara API D1: **1.560.576 bytes** (≈ **1,49 MiB**) en las seis bases; muy por debajo de los límites actuales. La restauración aislada del origen ocupa ~315 KB. La API no informa de un número fiable de tablas en listado, pero se verificó el esquema por SQL.
- Free D1: **500 MB como tamaño máximo por base**, 5 GB totales por cuenta; uso gratuito diario **5 millones de filas leídas** y **100.000 filas escritas**. Estos límites son por cuenta, no por cada base.
- Workers Free: **100.000 solicitudes diarias**, con reinicio a medianoche UTC. Si se supera, el sistema puede devolver error HTTP/Cloudflare 1027; no es un servidor que quede suspendido por no recibir tráfico.
- Workers Static Assets: las solicitudes que se resuelven directamente como activos estáticos son gratuitas e ilimitadas; si una ruta invoca código Worker (por ejemplo `run_worker_first`), sí puede contar hacia el límite de 100.000 peticiones diarias.\n- Correo transaccional Resend Free: 3.000 correos/mes, 100/día y hasta tres dominios en el plan gratuito. No activar Pro ni sobreconsumo de pago. Cuando se alcanza el límite sin pago por uso, se detiene el envío, lo cual afecta recuperación de contraseñas pero evita cargos.\n- Media pública: los cinco MP4 y logos originales están en **Workers Static Assets**; 20 recursos verificados y respuesta Range 206. El MP4 más grande ocupa 25.437.525 bytes ≈ **24,26 MiB**, dentro del máximo de archivo estático de 25 MiB. No se usa R2.
- `bellaquitas-api-staging`: 17 bindings, cinco secretos, **cero R2**. `STAGING_MUTATIONS=disabled`, `ALLOW_NEW_ACCOUNTS=no`.

## Riesgos y comportamiento en planes gratuitos

- Las limitaciones **no demuestran** que la web mantendrá disponibilidad indefinida ante cualquier volumen. Deben monitorizarse solicitudes diarias, lecturas y escrituras D1, tamaño de recursos y uso de la cuenta.
- No hacer una suposición de cuotas mensuales garantizadas si la cuenta cambia de plan. No activar planes de pago ni servicios con facturación.
- La galería futura no debe permitir subidas ilimitadas de imágenes o vídeos a Static Assets. El panel de edición de medios necesita un flujo de publicación estática con validación; hoy las subidas directas siguen bloqueadas en staging.
- Las contraseñas deben almacenarse como hashes en D1; no convertir los CSV o copias de chats en claves de autenticar.
- Estimar consumo real por evento (login, consulta de puntos, QR, panel) antes del corte de producción y vigilar cuota del día de lanzamiento.

## Fuentes oficiales

- [D1 Pricing](https://developers.cloudflare.com/d1/platform/pricing/)
- [D1 Limits](https://developers.cloudflare.com/d1/platform/limits/)
- [Workers Limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Workers Static Assets — billing and limitations](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)\n- [Resend pricing](https://resend.com/pricing/)

**Conclusión:** El despliegue de prueba y el backup aislado observados caben en los límites del plan gratuito. **No** se autoriza el dominio de producción solo por cumplir esos límites; siguen pendientes accesos de dos administradores, backup integral, clave privada, pruebas reales y QA visual.

## Ensayo real de derivación de contraseñas (Worker Free, sin secretos)

- 16/11/2026 a las 10:04 UTC: Worker temporal `bellaquitas-crypto-bench-qa-20261116` con WebCrypto PBKDF2 encadenado, **6 fases de 100.000 iteraciones SHA-256** y contraseña enteramente ficticia; sin DB, usuarios, tokens ni cookies.
- GitHub Actions [ejecución de ensayo](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43845399767): **SUCCESS**; tres solicitudes `HTTP 200` con `ok:true` y `phases:6`, todas completadas. Adicionalmente 70 verificaciones HTTP de staging correctas en el mismo job.
- `elapsedMs:0` es la hora reportada por `Date.now()` dentro de Worker y **no debe interpretarse como 0 ms de CPU real**. Lo demostrado es que el runtime finalizó las seis etapas sin devolver errores; no sustituye prueba de carga en concurrencia ni login de usuarios reales.
- Se retirará el Worker temporal y las llamadas recurrentes una vez documentado el resultado, conservando las pruebas de contraseña sintética que ejecuta `test-admin-email-link.mjs`.
