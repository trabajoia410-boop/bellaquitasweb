# Bellaquitas Fest — Comprobación de preparación para la fase 6

**12/11/2026 · Estado: NO AUTORIZADO EL CORTE DE BACKEND**

La web `bellaquitas.fr` continúa en su sistema oficial. El nuevo panel de administración tipo WordPress, con acceso independiente en otra pestaña, sigue en la rama de auditoría.

## Para qué sirve

`cloudflare/phase6_readiness.py` impide **considerar listo** un corte si falta cualquier evidencia declarada de seguridad o autorización. Es una herramienta de comprobación manual que se integrará como paso previo obligatorio de cualquier futuro procedimiento de despliegue, no un mecanismo que pueda impedir por sí mismo una publicación hecha por otros medios.

**No ejecuta migraciones, no inicia sesión, no consulta cuentas, no lee contraseñas ni realiza operaciones de escritura.**

### Comprobaciones exigidas

| Área | Antes de publicar debe estar confirmado |
|---|---|
| Respaldo | Archivo privado cifrado, hash SHA-256, restauración Postgres **en entorno aislado**, restauración D1 de prueba, verificaciones de archivos Supabase Storage/R2, segunda copia comprobada, menos de 48 horas |
| Integridad | Perfiles reales en origen = perfiles en destino; **la cuenta ficticia de staging debe retirarse/excluirse**; totales de puntos y visitas iguales; idioma ES/FR y vídeos intactos |
| Autenticación | Correo+contraseña y Google probados, admins originales vinculados sin duplicados, sesión/logout correctos, viabilidad de CPU o proveedor externo aprobada **sin cargos automáticos**, comprobada en los últimos 14 días |
| Costes y facturación | Verificar **Workers/D1 Free**, límites de correo, todos los servicios medidos y que **R2 no tenga cargos sin un límite efectivo o se sustituya por almacenamiento no facturable**. Las alertas de presupuesto NO detienen el consumo. |
| Reversión | Procedimiento ensayado, backend anterior disponible, protocolo para evitar pérdidas si se generan escrituras durante una reversión, dominio/DNS preparados y diseño conservado |
| Consentimiento | Autorización **expresa y reciente** del propietario para este corte concreto; no se infiere de «continúa», «hazlo» ni de la aprobación de pruebas |

**Las pruebas físicas de Safari iPhone y Samsung no son requisito previo:** como acordó el propietario, van inmediatamente **después** de la publicación migrada, con cuentas de ensayo seguras y plan de vuelta atrás.

### Modo seguro para comprobar el bloqueo

```bash
python3 cloudflare/phase6_readiness.py --self-test
```

El ensayo usa solamente perfiles, cantidades y fechas inventados. Verifica que no se puede considerar preparado el corte si faltan copias, coinciden mal los perfiles o puntos, el login exige un plan de pago, las contraseñas admin no están listas, falla la reversión o no hay autorización del propietario.

La prueba aprobada en CI: https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43207847292

### Uso en el momento apropiado

Con los respaldos reales ya creados y **restaurados en un entorno aislado**, se documentarán únicamente indicadores NO sensibles (fechas y recuentos agregados), **en un JSON privado fuera del repositorio**. No almacenar emails, hashes, IDs de usuarios, contraseñas, tokens, dumps ni claves en ese archivo ni subirlo a GitHub.

```bash
python3 cloudflare/phase6_readiness.py --check /carpeta-privada/evidencias.json
```

Se exige completar de forma verídica cada apartado: `backup`, `reconciliation`, `authentication`, `costs`, `rollback`, `authorization`. El código de comprobación ofrece los nombres de los campos pendientes.

**Que el programa dé resultado correcto no certifica por sí solo las evidencias, ni autoriza un despliegue sin supervisión.** Todo dato de evidencia requiere revisión humana. No se permite crear un fichero ficticio para esquivar el bloqueo.


### Aviso importante sobre Cloudflare R2

Cloudflare R2 Standard ofrece una franquicia mensual (actualmente **10 GB-mes, 1 millón de operaciones clase A y 10 millones clase B**), pero **no es un servicio de coste fijo cero** si se supera esa franquicia. Las alertas de facturación **solo notifican**; según la documentación de Cloudflare, no detienen ni limitan el consumo. Por eso `costs.r2_no_uncapped_billing_or_nonbillable_storage_verified` debe seguir **falso** hasta disponer de una protección de facturación comprobada o una opción alternativa sin cargos por exceso. No se debe señalar `true` solo porque actualmente haya pocos archivos o por haber configurado una alerta.

Fuentes oficiales:
- https://developers.cloudflare.com/r2/pricing/
- https://developers.cloudflare.com/billing/manage/budget-alerts/

## Estado de hoy

- **Aprobado:** más de 70 comprobaciones automáticas del panel/Google y ensayos con medios y QR; herramienta de copia cifrada preparada y probada con datos sintéticos.
- **Pendiente:** backup **real** completo de Supabase, Auth, Storage, D1 y R2, más restauración Postgres en instancia aislada.
- **Pendiente:** alternativa para correo+contraseña que respete el límite de Workers Free de 10 ms CPU y cero cobros automáticos, sin cambiar roles ni duplicar cuentas. Clerk Hobby es solo candidato de investigación, no conectado.
- **Pendiente:** quitar/excluir definitivamente el perfil ficticio de staging del conjunto final antes de cumplir la igualdad de perfiles, sin tocar perfiles de socios reales.
- **Pendiente:** ensayo documentado de reversión y aprobación explícita para pasar a fase 6.

**No se ha tocado `main`, el DNS, el Worker desplegado, las cuentas, los puntos ni las visitas.**

## Enlaces

- [Plan de respaldo y corte](./PLAN_RESPALDO_Y_CORTE_SEGURO.md)
- [Panel independiente de administración](./PANEL_ADMIN_SEPARADO_FASE5.md)
- [Seguridad del hash de contraseñas](./SEGURIDAD_PASSWORD_WORKERS_FREE_2026-11-12.md)
- [Comparativa de alternativas gratuitas](./ALTERNATIVAS_LOGIN_GRATIS_FASE5.md)


## Prueba adicional del mecanismo de recuperación

**12/11/2026:** completado el ensayo de **`pg_dump` + `pg_restore` en PostgreSQL aislado** con datos inventados y 18 tablas esenciales verificadas (incluidas `auth.users`, `auth.identities`, `auth.sessions` y `storage.objects`). La prueba regresiva rechaza un listado incompleto y utiliza clientes de la versión del servidor. [Ejecución aprobada](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43248681239).

En el Supabase real, la versión comprobada por consulta **solo de lectura** es PostgreSQL **17.11**. Se añadieron bloqueos de cliente distinto de 17: [5 pruebas aprobadas](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43248681515).

**El campo `backup.postgres_restore_tested` debe seguir `false` para el corte real.** Los ensayos de CI utilizan tablas/usuarios/puntos ficticios; **no se ha restaurado un volcado REAL de Supabase** y la comprobación no autoriza el cambio de dominio. [Detalle](./ENSAYO_RESTAURACION_POSTGRES_2026-11-12.md).


### Ensayo adicional con PostgreSQL 17 (12/11/2026)

La prueba de restauración ya se ejecuta **tanto en PostgreSQL 16 como en 17**, con herramientas `pg_dump` y `pg_restore` coincidentes en versión. **Ambas restauraciones han aprobado** la comparación de 18 tablas y la recuperación de sesiones, identidades, eventos, canjes y saldos exclusivamente ficticios. [Ejecución conjunta](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43249197005).

Aunque PostgreSQL 17 corresponde a la versión del Supabase de Bellaquitas, **aún NO hay una restauración real de la base Supabase**. El control `backup.postgres_restore_tested` debe seguir sin marcarse como completado para la producción.
