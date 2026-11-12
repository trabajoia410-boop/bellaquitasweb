# Bellaquitas Fest — Viabilidad de fotografías en Cloudflare KV Free
**12/11/2026 · Fase 5 de 6 · CANDIDATO DE LABORATORIO, SIN DESPLEGAR**

El objetivo sigue siendo **cero pagos, cero cargos automáticos y mismo diseño público**. Esta alternativa NO está conectada a la página, no sustituye R2 ni autoriza el corte del backend.

## Comprobaciones en la cuenta conectada (solo lectura)

- Cloudflare Workers KV: **0 namespaces** existentes en la cuenta. No se ha creado ninguna.
- Facturación, suscripciones y políticas de gasto: consultas **403 (permiso insuficiente)**. No podemos certificar desde esta conexión que la cuenta esté en el plan Free, ni que no existan cargos por otros servicios. No modificar la cuenta ni contratar.
- GitHub: el adaptador y las pruebas son archivos de la rama `auditoria/fase5-2026-11-11`; `main` y el Worker remoto permanecen independientes de estos cambios.
- No se ha accedido a fotos, sesiones ni cuentas reales; las imágenes de las pruebas son completamente inventadas.

## Límites del plan Workers KV Free verificados en la documentación de Cloudflare

| Concepto | Franquicia gratuita (límite, no objetivo) |
|---|---|
| Lecturas de claves | **100.000/día** |
| Escrituras de claves | **1.000/día** |
| Eliminaciones | **1.000/día** |
| Operaciones de listado | **1.000/día** |
| Datos almacenados | **1 GB** |
| Valor individual | **25 MiB** (el candidato restringe fotos a 8 MiB) |

Según la documentación de Workers Free, al superar una cuota diaria **la operación correspondiente falla** en lugar de generar uso pagado. Esto no constituye una protección universal para toda la cuenta, ni verifica automáticamente su modalidad de facturación. Las cuotas están compartidas por los consumidores pertinentes y pueden provocar que alguna fotografía temporalmente no se cargue.

Fuente: https://developers.cloudflare.com/kv/platform/pricing/ y https://developers.cloudflare.com/kv/platform/limits/

## Limitación de consistencia que bloquea el uso definitivo

**KV es eventualmente consistente**. Una fotografía añadida o borrada puede seguir sin estar actualizada en otras ubicaciones durante **hasta unos 60 segundos o el tiempo de caché aplicado**; el candidato usa `cacheTtl:30` (mínimo documentado en 2026), pero no promete visibilidad inmediata global. **No usar KV para QR, puntos, visitas, sesiones, autorización ni cualquier dato que requiera lectura inmediata.**

Para Momentos, antes de habilitarlo hace falta:

1. Mantener D1 como autoridad de álbumes, identificadores, permisos, publicaciones y revocaciones. El público solo solicita fotos tras verificar la autorización/publicación actual en D1; no exponer URLs directas del namespace.
2. Probar en el Worker real la latencia, la lectura tras subida desde diferentes regiones, las fotos ocultas y el acceso inmediatamente después de borrar publicaciones. El `GET` público debe evitar caché compartida para contenidos privados o revocados.
3. Definir un estado `pendiente de propagación` para fotos nuevas, y no prometer a usuarios que serán visibles instantáneamente. No publicar automáticamente porque un `put()` devuelva éxito.
4. Asegurar que una eliminación en D1 impida el acceso público **antes** de iniciar la eliminación de bytes en KV, con reintentos seguros y registro de objetos huérfanos. El borrado físico no es instantáneo en todo el mundo.
5. Evitar la escritura de datos personales o sensibles sin revisar privacidad y retención; determinar límites reales de subidas, espacio total y cuotas. Control de origen, tamaño y permisos en el servidor.

## Código desarrollado (solo QA)

- `cloudflare/qa-candidates/kv-media-adapter.js`: interfaz `get/put/delete` simulable, **solo lectura por defecto**, rutas limitadas, máximo 8 MiB, MIME exacto, firmas binarias JPEG/PNG/WebP comprobadas al **escribir y leer**, y rechazo del contenido corrupto. Comprobar una firma no sustituye un decodificador/escáner de imágenes.
- `cloudflare/test_kv_media_adapter.mjs`: pruebas de firmas válidas, falsas y truncadas, bytes idénticos, permisos, cuotas agotadas, metadatos falsificados y rutas maliciosas, exclusivamente con `FakeKV` en memoria.
- `.github/workflows/qa-kv-media-free.yml`: prueba Node 22 sin llamadas de red, credenciales ni Cloudflare real.
- Ejecución aprobada: https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43294647153

No existe todavía una integración en el Worker candidato. El código **no** crea un namespace, ni modifica imágenes, ni migra los logos existentes. Sigue bloqueado `R2_MUTATIONS_APPROVED` por defecto y se deberá diseñar un permiso KV separado antes de usarlo. No activar ambas escrituras accidentalmente.

## Decisión para fase 6

**No listo.** KV puede servir como alternativa de imágenes dinámicas en el plan gratuito pero primero deben verificarse, con autorización del propietario, el plan de facturación, la privacidad, la propagación global y el comportamiento tras borrar. La autenticación correo/contraseña en Workers Free y las copias restaurables siguen pendientes por separado.

Los vídeos originales y el aspecto de `bellaquitas.fr` deben continuar exactamente como hoy. Conservar GitHub Pages para los vídeos evita añadir consumo KV/R2 para MP4.
