# Bellaquitas Fest — Alternativa sin cargos R2 para medios estáticos

**Fecha:** 12/11/2026 · **Estado:** estudio comprobado, **sin despliegue**.

## Resultado de la auditoría de los archivos originales

La documentación vigente de Cloudflare Workers Static Assets indica que:
- Las peticiones **que se atienden directamente como assets** son gratuitas e ilimitadas, y no hay coste adicional por almacenar estos archivos.
- En Workers Free puede alojarse un máximo de 20.000 archivos por versión y cada uno debe medir **25 MiB o menos**.
- **Caveat importante:** las peticiones con `Range` se responden **HTTP 200 con el archivo completo**, no `206 Partial Content`. La propia documentación advierte que Safari puede necesitar 206 para vídeo. Se puede invocar un Worker con `run_worker_first` para implementar `Range`, pero esas peticiones sí cuentan como Worker y quedan sujetas al límite Free de **10 ms de CPU y 100.000 peticiones por día**.

**Prueba en el repositorio de Bellaquitas Fest, sin recompresión:**

| Control | Resultado |
|---|---:|
| Recursos originales verificados | 17 de 17 |
| Vídeos MP4 originales | 5 de 5 |
| Bytes totales sin modificar | 54.846.317 (52,31 MiB) |
| Recurso de mayor tamaño | 25.437.525 bytes (24,26 MiB) |
| Límite individual de Static Assets Free | 26.214.400 bytes (25 MiB) |
| Archivo que excede el límite | **Ninguno** |
| Hashes del repositorio | 17 de 17 coinciden |

La comprobación usa `cloudflare/audit_static_assets_free.mjs`, abre los recursos del checkout y comprueba tamaño y SHA-1 Git de cada archivo. [GitHub Actions: aprobado](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43208418447).

## Posible arquitectura gratuita a estudiar

- **HTML, CSS, JS, iconos, logotipos y demás medios sin `Range`:** son candidatos directos a Workers Static Assets. De este modo no consumirían operaciones de lectura R2 ni almacenamiento R2.
- **Vídeos con `Range`:** estudiar un manejador Worker capaz de responder `206`, `Content-Range`, `Accept-Ranges` y `416`. Antes de decidir, comprobar en el runtime Free y en WebKit simulado que la CPU y memoria se mantienen bajo cuota, sin recortar ni degradar ninguno de los cinco MP4.
- **Fotografías subidas por el administrador (Moments):** los assets se publican mediante despliegues, no son un almacenamiento dinámico de archivos subidos por usuarios. Hacen falta una estrategia de almacenamiento dinámica y una **barrera real contra cargos** antes del corte. No asumir que los límites o alertas de R2 detienen la facturación.
- **Datos de socios, sesiones y eventos:** siguen en D1 y solo se modifican por APIs con permisos. Static Assets no los sustituye.

## Por qué esta vía aún no está aprobada

1. El soporte real de `206` para Safari/iPhone **NO** está implementado ni probado sobre una versión candidata desplegada con Static Assets.
2. Los vídeos pasados por la API Worker podrían consumir CPU y peticiones: que los ficheros quepan no demuestra que el streaming quepa en Workers Free.
3. La consola separada tiene fotos que se podrán subir o borrar desde administración; Static Assets no resuelve esa subida dinámica.
4. R2 puede cobrar excesos; **las alertas presupuestarias son informativas**, no una barrera.
5. No hay respaldo privado restaurado ni login por contraseña gratuito aprobado.

No se ha modificado `main`, el Worker remoto, el DNS, los recursos originales ni la web pública.

## Fuentes oficiales

- https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/
- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/r2/pricing/
- https://developers.cloudflare.com/billing/manage/budget-alerts/
