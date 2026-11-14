# Bellaquitas Fest — retirada efectiva del R2 de staging
**13 de noviembre de 2026 · Solicitada explícitamente por el propietario para evitar cargos de Cloudflare**

## Resultado comprobado en Cloudflare (API de la cuenta)

- Cuenta: Bellaquitas Fest (ID de cuenta no incluido en este informe público).
- Bucket que existía: `bellaquitas-media-staging`, creado el 10/11/2026.
- Inventario inicial: **20 objetos, 56.785.619 bytes (~54,2 MiB)**.
- **17 objetos `site-original/*` eliminados** después de corroborar sus nombres, tamaños y hashes `gitSha1` con los blobs que siguen en `main/assets/` del repositorio GitHub oficial. Había cinco MP4, logos y otros activos originales.
- **3 objetos `logos/*` eliminados** después de comprobar que sus tres originales existen aún como registros de `storage.objects` en el bucket original **`bellaquitas-media` de Supabase**, con el mismo tamaño (904.603, 130.096 y 904.603 bytes). Se conservaron los hashes SHA-256 que habían sido registrados al hacer la copia a R2. No se borraron originales de Supabase.
- La lista de objetos R2 se volvió a leer y devolvió **0**.
- El bucket **`bellaquitas-media-staging` se eliminó satisfactoriamente** mediante API.
- La lista final de buckets R2 de la jurisdicción predeterminada devolvió **0 buckets**.
- No se creó ningún archivo R2 nuevo. **No se borraron fotos, vídeos ni datos de producción en GitHub, Supabase, D1 ni dominio.**

## Importante: efectos colaterales en staging

La API Worker `bellaquitas-api-staging` todavía existe y su código desplegado tenía un binding `MEDIA` hacia el bucket ya eliminado. Algunas rutas de lectura de logos, medios y la URL del contenido/catálogos de **D1 staging** todavía apuntan a R2: estas vistas de ensayo pueden quedar rotas hasta la reconexión a originales de GitHub/Supabase o al futuro sistema Free. **No se ha actualizado ni desplegado ese Worker**, y el sitio oficial de GitHub Pages no depende de este bucket.

El candidato `cloudflare/qa-candidates/free-only-cost-policy.js` restringe R2 (lectura y escritura) pero aún no está desplegado. El próximo despliegue de la API deberá **retirar el binding R2** y no intentar recrear el bucket. El proyecto no debe dar por completado el corte hasta validar esta dependencia.

## Protección financiera y límites

La eliminación impide que el **bucket y sus 56,8 MB de almacenamiento** continúen generando almacenamiento R2. **No equivale a cancelar cualquier posible suscripción de Cloudflare ni a reembolsar uso previo.** Las comprobaciones de facturación/subscripciones desde el conector habían devuelto **403**, por lo que no se puede prometer que el coste total de la cuenta sea 0 €. Revisar manualmente las suscripciones/servicios facturables y las modalidades de pago; las alertas de presupuesto no son un límite duro.

El plan gratuito de Workers/D1/KV sigue siendo el objetivo. La futura galería Moments necesita **una alternativa de almacenamiento no facturable con cuotas estrictas**, ensayada antes de habilitar subidas. Los originales estáticos deben continuar en GitHub Pages.

## Copias privadas y fase 6

El programa `cloudflare/phase6_readiness.py` fue adaptado: ahora acepta **`backup.r2_mode = "removed"`** cuando se aporten **evidencias auténticas** de ausencia de bucket/objetos y disponibilidad de originales de fuera de R2. El ensayo con datos falsos de la compuerta ha pasado:
https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43377360937

El script histórico `cloudflare/backup_privado_local.py --run` exige aún inventario R2 de 20 objetos y hay que adaptarlo para la siguiente copia real; **no se ha realizado restauración real de PostgreSQL/D1/Storage ni verificado una copia cifrada integral**. El respaldo de las bases y de Supabase Storage sigue siendo requisito previo a publicar. La fase 6 sigue bloqueada y no hay autorización para un corte.

**Resultado efectivo:** 20 archivos R2 eliminados, bucket eliminado y 0 buckets R2 predeterminados en Cloudflare. Los originales siguen en sus ubicaciones verificadas, pero cualquier copia R2 de staging ya no existe.
