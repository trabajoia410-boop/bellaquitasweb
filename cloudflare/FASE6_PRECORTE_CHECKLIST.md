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
| Integridad | Perfiles reales en origen = perfiles en destino; **la cuenta ficticia de staging debe retirarse/excluirse**; totales de puntos y visitas iguales; **cada perfil coincidente debe conservar su ID, rol, código de socio, puntos disponibles, puntos históricos y visitas**; idioma ES/FR y vídeos intactos |
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

**Conciliación individual adicional (12/11/2026):** consulta de solo lectura de Supabase y D1: 6 perfiles originales coincidieron individualmente en los 6 campos indicados, sin diferencias; en D1 existe 1 perfil extra de staging. Se incorporó la condición obligatoria `reconciliation.profiles_row_parity_verified` al candado de fase 6. El resultado debe repetirse dentro de las 24 horas anteriores al corte definitivo. [Informe agregado sin identificadores personales](./CONCILIACION_PERFILES_2026-11-12.md).

**Auditoría adicional de KV Free (12/11/2026):** el candidato de fotografías se ha endurecido con comprobación de firma binaria y MIME, y ha superado pruebas ficticias de lectura, escritura, borrado y cuota agotada. **La cuenta conectada tiene cero namespaces KV y las consultas de suscripciones/facturación devuelven 403**, por lo que NO se ha acreditado la protección de costes ni se ha activado una alternativa a R2. KV puede tener lecturas temporalmente obsoletas; antes de permitir fotos reales deben verificarse D1 como fuente de permisos, borrado y propagación. Véase [viabilidad de KV Free](./VIABILIDAD_KV_FREE_MOMENTS_2026-11-12.md). La condición `costs.r2_no_uncapped_billing_or_nonbillable_storage_verified` **sigue pendiente** y no puede marcarse por esta prueba aislada.

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

## Revisión de acceso y evidencias privadas — 13/11/2026

- **Evidencias locales más seguras:** `phase6_readiness.py` ahora exige permisos **0600 y propietario actual en POSIX**, rechaza enlaces simbólicos y campos ajenos al esquema aprobado. No guardar ni incluir correos, contraseñas, tokens ni IDs personales. Ensayo sin acceso a usuarios reales: https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43354536720.
- **Ruta gratuita de autenticación investigada, NO habilitada:** validador de ID token OIDC con firma RS256/issuer/audiencia/nonce y vinculación **solo por sujeto verificado** a un `profile_id` admin preexistente, sin usar correo para otorgar privilegios. Pruebas sintéticas: https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43355074775. Véase [informe OIDC](./AUTH_OIDC_ADMIN_FASE5_2026-11-13.md).
- **Sigue bloqueado el corte:** falta seleccionar y autorizar proveedor, implementar el flujo real, demostrar el plan gratuito y los límites de CPU, activar sin duplicación a los administradores existentes y realizar una copia REAL restaurada. No convertir el éxito del prototipo en `authentication.free_cpu_or_external_auth_verified=true`.

## Nuevo requisito del acceso admin — 13/11/2026

**Cambio aprobado para el candidato: entrada SSO sin segunda contraseña**. El administrador primero inicia sesión en la web pública, después el botón de `Panel administrador` abre otra pestaña y comprueba el rol admin en D1. Se requieren dos sesiones vinculadas y ambas válidas, con autorización revisada en cada petición. Un socio no puede acceder.

`cloudflare/phase6_readiness.py` reconoce ahora el método **`authentication.admin_login_method = "sso_existing_account"`**, pero solo cuando se aporten evidencias privadas y verídicas de `admins_with_verified_sso`, `sso_admin_role_verified`, `sso_parent_session_revocation_verified`, `google_and_admin_link_verified`, sesiones/logout y viabilidad gratuita. El modo antiguo de contraseña conserva sus propias comprobaciones como alternativa, no se acepta una casilla como prueba del otro.

**Esto NO autoriza el corte ni prueba acceso real**: falta adaptar la autenticación de la web pública a cookies Worker, aplicar el esquema únicamente tras respaldos verificados, probar SSO en un entorno controlado con cuentas autorizadas y cerrar costes, almacenamiento y plan de reversión. Los ensayos de CI son ficticios.

## 13/11/2026 — Bloqueo expreso de servicios facturables (COSTE CERO)

El propietario exige **0 € y ningún cargo automático** en Cloudflare. El candidato aplica antes de enrutar `COST_POLICY=free-only` y suprime el binding R2 y las credenciales de envío de correo externo en **todas** las rutas; las lecturas y subidas R2 devuelven **423**. Sin la política, el Worker devuelve **503**. Los tests in-memory del guardia y de la integración pasaron: [ver ejecución](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43358166429).

**Condición imprescindible:** el guardia NO bloquea por sí mismo cargos del bucket R2 ya existente (almacenamiento), ni otros recursos/suscripciones de la cuenta, ni un posible plan Workers Paid. El acceso conectado a facturación sigue siendo **403**. La fase 6 no se puede aprobar hasta comprobar de verdad la cuenta y dejar sin acceso los servicios facturables.

El candado exige además `workers_free_plan_verified`, `d1_and_kv_free_plan_verified`, `zero_cost_runtime_guard_verified`, `r2_binding_removed_or_inaccessible`, `no_metered_subscriptions_or_autopay_verified` y `workers_route_fail_closed_verified`. No confundir alertas con límites duros. [Ver la política completa de coste cero](./COSTE_CERO_CLOUDFLARE_2026-11-13.md).

## 13/11/2026 — R2 retirado realmente de Cloudflare

**Actualización que prevalece sobre los párrafos históricos anteriores:** por solicitud directa del propietario se **eliminaron los 20 objetos (56.785.619 bytes) y después el bucket `bellaquitas-media-staging`**. Se verificó que quedaban **0 objetos** antes de borrarlo y que el listado final de R2 tenía **0 buckets**. Los 17 originales de `assets/` siguen verificados contra los blobs SHA-1 de GitHub `main`; los tres logos originales siguen presentes en `storage.objects` de Supabase, con tamaños coincidentes. Ver [acta de retirada real](./RETIRO_REAL_R2_2026-11-13.md).

**No volver a crear R2** ni conectar su binding. El Worker de staging desplegado puede seguir apuntando a rutas R2 que ya no existen: corregir referencias en D1/Worker al implementar el almacenamiento Free, sin alterar la web pública. El archivo `cloudflare/backup_privado_local.py` aún contiene instrucciones históricas de 20 objetos R2 y debe adaptarse antes de ejecutar un backup real.

El candado actualizado acepta la alternativa `backup.r2_mode = "removed"` con `r2_objects = 0`, `r2_bucket_absent_verified = true` y `r2_originals_source_verified = true` **solo después de aportar pruebas verídicas**. Siguen siendo obligatorias las copias privadas cifradas y restauración real de Postgres, D1 y Supabase Storage, la conciliación de perfiles, el control de gastos de toda Cloudflare y la autorización final. No marcar la facturación como verificada porque el conector devolvía **403**.

## 13/11/2026 — Avance comprobado de fase 5, sin autorizar publicación

Consultar el [informe con resultados de autenticación, R2, paridad de perfiles, copias privadas, cuotas gratis y pruebas](./FASE5_AVANCE_REAL_2026-11-13.md).

- **Nuevo puente SSO a Supabase Auth:** preparado y probado con simulaciones, pero **NO** probado con administradores reales, **NO** desplegado. El candado exige evidencia independiente de `real_supabase_admin_session_tested`, `real_supabase_role_denial_tested`, `real_admin_same_origin_verified` y `real_admin_logout_revocation_tested`; ninguna está acreditada por los tests ficticios.
- **D1 staging:** verificadas seis cuentas reales contra Supabase, 0 diferencias en rol, código, puntos, puntos históricos y visitas; existe **una fixture adicional** con puntos 0, que requiere exclusión al corte. Las URLs de portada y borrador que usaban R2 eliminado volvieron a sus originales públicos de Supabase, sin alteración de socios.
- **Medios:** está preparado en candidato (sin despliegue) el uso de los 5 MP4 y logos originales de GitHub Pages. **El viejo Worker de staging aún devuelve 503** al pedir vídeos que antes servía desde el R2 retirado. No confundir prueba de respuesta segura con prueba de reproducción real desde el Worker nuevo.
- **Respaldo:** script local privado adaptado a `r2_mode=removed`, pruebas sintéticas de GPG y PostgreSQL aprobadas; **NO existe una copia cifrada real y restaurada de la base oficial** demostrada en estas evidencias. Sigue siendo requisito obligatorio.
- **Coste:** captura muestra Workers Free y sin gastos observados; 0 buckets R2. Deben comprobarse consumos/CPU, pagos futuros y ruta fail closed antes de autorizar despliegue. Sin servicios adicionales de pago.

**Queda bloqueada fase 6.** El código permanece en rama de auditoría; ningún test equivale a permiso de cambiar dominio, registros DNS, backend de producción, puntos o usuarios.

## 13/11/2026 — Segunda revisión del SSO (sin despliegue)

Se auditó en modo **solo lectura** la seguridad real de `profiles`, las políticas RLS, las funciones `SECURITY DEFINER` y los avisos Security Advisor de Supabase. El rol `authenticated` no tiene permisos directos para cambiar `profiles`, y las funciones elevadas comprueban `auth.uid()`; se registran avisos de funciones expuestas intencionalmente y protección de contraseña filtrada desactivada para revisión sin pago. [Acta de seguridad](./FASE5_AUDITORIA_SEGURIDAD_2026-11-13.md).

Se eliminó la emisión de cookie pública `__Host-bf_session` en el puente SSO, que podría dar acceso a endpoints D1 fuera del panel; ahora la cookie padre `__Secure-bf_admin_parent` solo se envía en `/administracion`, se revoca al salir aunque Supabase ya no entregue bearer y las rutas D1 privadas/antiguo login están bloqueadas en modo puente. Ver pruebas de identidad y coste cero en el acta.

El candado de publicación exige ahora además: `admin_parent_cookie_scoped_to_panel_verified`, `legacy_d1_private_routes_closed_verified` y `supabase_rls_role_policy_audited`, junto a pruebas con cuentas reales, backup/restore auténtico y autorización. Se mantiene fase 5; **no se ha activado el panel**, ni cambiado producción.

## 13/11/2026 — Cotejo privado de recuperación: controles reforzados (sin corte)

Se añadió un **manifiesto GPG cifrado con nueve métricas agregadas** de la base Supabase original: total de perfiles, administradores, puntos disponibles e históricos, visitas, usuarios Auth, identidades Auth, sesiones Auth y objetos Storage. No se incluye ningún correo, nombre, código o UUID en esas métricas.

El nuevo [restaurador privado de PostgreSQL](./restore_privado_aislado.py) comprueba la integridad GPG, exige base local **vacía** y rol sin superusuario, restaura el archivo sin borrar tablas y compara esas métricas en la base recuperada. Nunca conecta intencionalmente a Supabase real y el modo operativo está prohibido en CI. La protección no puede detectar túneles SSH configurados por el propietario: **no usar túneles hacia bases reales**. Puede necesitar un entorno local compatible con extensiones/roles Supabase; los fallos no se deben saltar concediendo superuser.

En PostgreSQL 16 y 17 **ficticios**, las pruebas automatizadas restauraron 18 tablas y detectaron una diferencia deliberada de 1 punto, sin tocar datos reales. [Pruebas restauración aprobadas](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43491725740), [seguridad del respaldo aprobada](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43491767183).

El candado de fase 6 exige ahora `postgres_profiles_points_auth_match_verified`, `isolated_local_restore_non_superuser_verified` y `storage_inventory_complete_verified`. [Suite del candado aprobada](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43491889337).

[Guía privada de Windows](./GUIA_COPIA_PRIVADA_Y_RESTAURACION_WINDOWS.md). **La copia real y restauración privada REAL siguen pendientes**. No autorizar fase 6 por las pruebas ficticias.
