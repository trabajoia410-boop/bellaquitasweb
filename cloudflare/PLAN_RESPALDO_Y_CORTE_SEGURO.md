# Bellaquitas Fest — plan seguro de respaldo, pruebas y cambio de backend

## Regla de presupuesto cero — requisito del propietario (11 noviembre 2026)

**Prioridad absoluta:** Bellaquitas Fest no debe necesitar cuotas de hosting, servidor, base de datos, email ni almacenamiento, ni actualizarse a planes de pago ni cobrar automáticamente por superar una franquicia. El coste de renovación del dominio `bellaquitas.fr`, ya comprado en Hostinger, es una excepción inevitable de conservar un dominio propio y debe comunicarse antes de su renovación.

**Política de despliegue:**
1. **Prohibido activar Workers Paid, Resend Pro, Supabase Pro o complementos de pago**, así como cualquier cambio de plan o servicio con cargos por consumo, sin decisión expresa del propietario.
2. Mantener GitHub Pages Free, Cloudflare Workers Free, D1 Free, Resend Free y Google OAuth sin compras adicionales; solo emplear funcionalidades verdaderamente gratuitas.
3. **R2 no es gratuito sin límite:** ofrece una franquicia gratuita mensual en clase Standard, pero puede generar facturas si se excede; por tanto no afirmar «R2 = 0€ garantizados». Antes del corte verificar la facturación, límites y la posibilidad de bloquear cargos o usar almacenamiento alternativo con bloqueo duro al exceder la cuota.
4. Queues existe en Workers Free con 10.000 operaciones/día, pero **NO se creará una cola ni se aceptará como necesaria** hasta revisar límites y garantizar ausencia de cargos. La opción `waitUntil` tiene el riesgo de pérdida de correos que requiere solución sin cuota.
5. **Problema técnico crítico para el plan Free:** Workers Free limita a **10 ms de CPU por invocación** (octubre de 2026); el login por correo actual calcula seis etapas PBKDF2 de 100.000 iteraciones y puede superar el límite, especialmente si se añade el cálculo ficticio de protección ante enumeración. **No suponer que las pruebas Node representan el rendimiento de Workers Free en producción**. Medir sobre un Worker de prueba separado y sin datos reales antes de considerar viable el corte. Si no cabe en el límite, rediseñar autenticación usando servicios gratuitos que funcionen sin exceder cuotas; nunca «solucionar» pagando.
6. Resend Free tiene un máximo publicado de **100 correos/día y 3.000/mes** (noviembre de 2026). El sistema debe gestionar ese tope y avisar de la indisponibilidad; no recomendar suscripción ni activar cobro por excedentes.
7. Trabajar bajo la hipótesis **sin costes mensuales** hasta verificar con el propietario los planes reales y si existen servicios con cobro automático. El conector de Cloudflare devolvió **403** al intentar consultar suscripciones y políticas de gasto: **NO se verificó la facturación actual**.
8. Nunca almacenar claves bancarias ni datos de pago en GitHub ni añadir una tarjeta de crédito para validar una prueba.

**Fuentes oficiales verificadas:** https://developers.cloudflare.com/workers/platform/pricing/ ; https://developers.cloudflare.com/workers/platform/limits/ ; https://developers.cloudflare.com/r2/pricing/ ; https://developers.cloudflare.com/queues/platform/pricing/ ; https://resend.com/pricing .

---


**Preparado:** 11 de noviembre de 2026. **Estado: PLAN, SIN EJECUTAR CAMBIO DE PRODUCCIÓN.**

## Copia privada preparada y auditoría de esquema (11/11/2026)

Se ha preparado `cloudflare/backup_privado_local.py`, que **solo se ejecutará con confirmación explícita desde un equipo del propietario y con credenciales privadas**. No usa GitHub Actions para exportar datos, no añade compras y no hace ninguna escritura de producción.

- `--check`: verifica herramientas, sin conectarse.
- `--self-test`: valida restauración SQL sintética y detección de objetos incompletos, sin conexión.
- `--run`: exporta a una carpeta privada fuera de Git, verifica y cifra con GPG cuatro fuentes:
  1. **Postgres Supabase** completo, exigiendo presencia de datos `public`, `auth.users`, `auth.identities` y metadatos de `storage.objects`.
  2. **D1 staging**, comprobando que el SQL se restaura en SQLite de memoria y contiene las tablas y saldos esperados.
  3. **Cloudflare R2**, incluyendo todos sus objetos y verificación de tamaños (actualmente, 20).
  4. **Supabase Storage**, que todavía alberga 3 objetos binarios en `bellaquitas-media`. Los objetos **NO quedan guardados en un dump SQL**. Se requiere acceso S3 del proyecto configurado localmente; no registrar claves en GitHub.
- Genera manifiesto de hashes SHA-256 y un contenedor `tar.gz.gpg` protegido por contraseña privada. Necesita una carpeta ubicada en un volumen cifrado para evitar riesgos durante los archivos temporales; después elimina el área provisional.
- **Todavía NO se ha ejecutado `--run` ni se han realizado respaldos reales.** Las pruebas automáticas con archivos ficticios sí están aprobadas: https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43114946070
- Una verificación de formato/listado no sustituye la **restauración completa de PostgreSQL** en una instancia aislada. Sin esa comprobación no se autoriza la fase 6.
- D1 Time Travel en Workers Free dura **7 días** según documentación actual; no reemplaza la copia privada exportada.
- El proyecto Supabase sigue en Free. Al dejar de recibir tráfico después del corte, podría pausarse por inactividad: no asumir que permitirá una reversión instantánea indefinidamente. Mantener un procedimiento de reactivación y archivos restaurables; no pagar para evitar la pausa.

**Avisos de Supabase:** se verificó RLS activado en 12/12 tablas `public`. Siete `SECURITY DEFINER` accesibles a autenticados tienen comprobaciones internas de identidad/rol; ninguno permite `EXECUTE` al rol anónimo. Análisis: `cloudflare/AUDITORIA_PERMISOS_SUPABASE_2026-11-11.md`. No se han modificado esos permisos.

## Próximo paso obligatorio antes del corte

Completar desde un entorno privado del propietario una copia real cifrada y su restauración controlada, verificar que incluye los seis usuarios, sus identidades, los puntos/visitas y los archivos originales, y conciliar de nuevo con D1. **No enviar contraseñas, tokens, hashes ni dumps completos al chat ni a GitHub.**

---

## Límites innegociables
- No cambiar `bellaquitas.fr`, su diseño, DNS, Hosting/GitHub Pages ni el proveedor de autenticación actual durante las pruebas.
- No alterar, reiniciar ni usar puntos, visitas, QR, canjes ni cuentas de los seis usuarios importados de Supabase.
- No subir bases de datos, correos, contraseñas, tokens, credenciales ni respaldos con datos personales a este repositorio GitHub **público**, GitHub Actions ni al chat.
- No cambiar el valor `STAGING_MUTATIONS=disabled` de `bellaquitas-api-staging` para probar modificaciones con perfiles originales.

## Infraestructura comprobada (solo lectura)
- Supabase **Bellaquitas Fest**: proyecto `vlsipvngvxcgnwrhpjgg`, sigue siendo el origen de producción.
- Cloudflare D1: `bellaquitas-staging`, id `c7ada9c9-d397-4e22-b5b8-3fbd8d13e550`, jurisdicción UE.
- Cloudflare R2: `bellaquitas-media-staging`; 3 logos y 17 archivos originales del sitio.
- Worker: `bellaquitas-api-staging`; espejo `https://bellaquitas-api-staging.bellaquitas-fest-410.workers.dev/espejo/`.
- Se conserva un snapshot del código desplegado (17 módulos) en `cloudflare/staging-source-2026-11-11/`.
- A fecha de la comprobación, las 6 cuentas originales coincidían por ID, nombre, rol, código QR, puntos y visitas; 1 cuenta adicional de correo existe solo en staging.

## Orden de fases actualizado — pruebas físicas tras la publicación oficial

**Preferencia explícita del propietario (11/11/2026):** probar iPhone y Samsung físicamente **después** de que la migración ya esté publicada en `bellaquitas.fr`, no en el entorno de staging. El dominio existe y ya sirve la web original; aquí «publicar oficialmente» significa cambiarla al **nuevo backend**.

- **Fase 5 — Antes del cambio:** mantener diseño igual al actual, completar pruebas automáticas, seguridad y autenticación crítica, copias privadas verificables, conciliación de datos, coste cero y reversión lista. **No exigir pruebas con dispositivos físicos en esta fase.**
- **Fase 6 — Publicación controlada:** realizar el cambio reversible al backend de Cloudflare **solo cuando los requisitos anteriores estén cumplidos**. No retirar Supabase ni suprimir recursos originales al publicar.
- **Fase 6 — Justo después de publicar:** probar de forma prioritaria en iPhone Safari y Samsung/Android los dos vídeos, hamburguesa, ES/FR, registro e inicio de sesión, sesión persistente, QR y control de puerta. Para QR, puntos y canjes usar cuentas preparadas y procedimientos controlados; no sumar visitas o puntos de socios reales por pruebas.
- **Si falla algo crítico:** revertir a la versión anterior con el plan de recuperación previamente verificado y reconciliar operaciones antes de reactivar escrituras.

**No interpretar este cambio de orden como autorización para activar DNS, editar producción o publicar ahora.**

## 1. Antes de probar operaciones de escritura

1. Crear o reservar un **entorno separado de ensayo** con base y almacenamiento ficticios, sin importar socios reales (ni sus puntos, códigos, hashes, sesiones o emails). Nunca habilitar escrituras en la D1 que conserva copias reales mientras esté mezclada con cuentas de pruebas.
2. Aplicar las migraciones D1 en una base **nueva** y vacía; inventariar también las tablas de correo y sesión que están en el Worker actual y NO aparecen necesariamente en las migraciones `0001–0005` históricas. No completar esta parte a ciegas: comprobar estructura real antes de desplegar.
3. Crear tres identidades ficticias de prueba: `socio`, `puerta` y `admin`. Usar direcciones y códigos no pertenecientes a socios reales, y quitar sus permisos después de las pruebas.
4. Habilitar operaciones únicamente en ese entorno aislado; verificar visitas, canjes, historial, editor, galería y sugerencias. Revertir el entorno ficticio al acabar.
5. **No ejecutar** pruebas destructivas contra `bellaquitas-api-staging` ni `bellaquitas.fr`.

## 2. Backup privado de producción: requisito antes del corte

Estos respaldos **todavía no se han creado/verificado** en esta auditoría. Solo se ha comprobado que D1 Time Travel tiene un punto de restauración; no sustituye una copia externa.

- Preparar una **ubicación privada y cifrada** bajo el control del propietario (no GitHub público, ni chat, ni un enlace compartido).
- Desde el proyecto Supabase correcto, exportar/respaldar Postgres completo (incluidos `public`, `auth` y demás esquemas necesarios; roles/permisos y migraciones según el método soportado por el plan). Confirmar que el archivo puede restaurarse en una instancia de ensayo **sin conectarla al sitio real**. Consultar el panel de Supabase sobre disponibilidad de respaldos antes de asumir que están incluidos en el plan.
- Respaldar también **Supabase Storage**, fotos y los objetos todavía usados por las páginas o eventos, con inventario de rutas, bytes y hash.
- Respaldar por separado D1 de Cloudflare (incluida la cuenta de correo de staging) mediante un método privado y restaurable. La exportación SQL D1 por API **puede bloquear temporalmente consultas mientras se genera**; reservar una ventana controlada y no lanzarla durante servicio activo. Conservar también el bookmark de Time Travel.
- Respaldar R2 privado incluyendo bytes y metadatos (17 archivos originales + 3 logos ya inventariados). No basta con registrar únicamente nombres o hashes.
- Guardar y verificar fuera de GitHub las configuraciones de OAuth, correo y Turnstile **sin exponer los valores secretos**.
- Probar restauración y medir diferencias antes de considerar válido cualquier backup.

## 3. Verificación manual con usuarios de ensayo — fase 6, tras publicación

| Función | iPhone Safari | Samsung/Android | Ordenador | Criterio |
|---|---|---|---|---|
| Google login/logout | Pendiente | Pendiente | Pendiente | Inicia, persiste al recargar y se cierra |
| Correo/verificación/restablecimiento | Pendiente | Pendiente | Pendiente | Enlaces funcionan una sola vez y sesiones antiguas se revocan |
| Menú y traducción ES/FR | Pendiente | Pendiente | Pendiente | Sin textos sin traducir ni menú duplicado |
| Vídeo portada y segundo vídeo | Pendiente | Pendiente | Pendiente | Ambos se ven igual que la web pública, sin bordes ni cortes inesperados |
| QR cámara/puerta | Pendiente | Pendiente | Pendiente | Reconoce QR ficticio y valida una visita sin duplicados |
| Tarjeta, puntos, canjes | Pendiente | Pendiente | Pendiente | Sin afectar datos reales, coherencia y auditoría |
| Editor visual, eventos, galería | Pendiente | Pendiente | Pendiente | Solo admin ficticio puede editar/publicar |
| Sugerencias | Pendiente | Pendiente | Pendiente | Envío y revisión solo con contenido ficticio |
| Responsive/accessibility | Pendiente | Pendiente | Pendiente | Mismo diseño, legible, sin pérdida de controles |

Las pruebas automáticas anteriores **no sustituyen** el comportamiento de Safari iOS, reproducción de vídeo en un iPhone real ni interacción física de la cámara.

## 4. Justo antes de un futuro corte autorizado

1. Elegir ventana de bajo tráfico y comunicar intervención; confirmar respaldo cifrado y **restauración probada**.
2. Congelar temporalmente escrituras sobre el sistema origen para obtener un corte coherente (solo cuando se planifique y apruebe expresamente; nunca sin confirmación).
3. Capturar último diferencial de perfiles, IDs de identidad, eventos, puntos, visitas, movimientos, canjes, borradores, contenido y objetos.
4. Importar y reconciliar todo en la base definitiva. Si hay cualquier diferencia, **detener migración**.
5. Configurar sitio y API bajo el **mismo origen** de `bellaquitas.fr`; las cookies `__Host-` seguras no deben depender de terceros en iOS/Safari.
6. Hacer despliegue gradual y reversible, con control de salud, inicio de sesión y accesos; NO retirar Supabase.
7. Verificar acciones reales de socio/puerta/admin con usuarios preparados para el corte; si falla algo, revertir inmediatamente.
8. Mantener Supabase y el despliegue anterior como respaldo hasta superar el periodo de verificación.

## 5. Reversión

**Disparadores:** pérdida de acceso, desajustes en cuentas/puntos/visitas, vídeos ausentes, error de QR, acceso indebido o fallo grave de editor.

- Interrumpir escrituras en el nuevo backend para no generar divergencias.
- Restaurar el tráfico al frontend/backend originales conforme a la configuración documentada y testada en la ventana de corte.
- Recuperar las sesiones/autorizaciones apropiadas; no copiar cookies de terceros ni reutilizar tokens entre sistemas.
- Reconciliar las mutaciones que pudieron ocurrir durante el cambio antes de volver a activar funciones.
- Conservar los logs de errores (sin secretos), realizar análisis y repetir QA antes de un nuevo intento.

## 6. Pruebas automáticas ya verificadas

- 28/28 HTTP de staging: https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/42945687797
- 10/10 QR/puntos/canjes en SQLite ficticia: https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/42992642358
- 10/10 permisos de roles con Worker y DB simulados: https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/42993023814
- 10/10 registro/contraseña/sesiones/correo con Resend y Turnstile simulados: https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/42994647166
- 10/10 Google OAuth con RSA y JWT ficticios: https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/42995088768
- 5 vídeos originales y HTTP Range 206: https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/42946915076

**Nota de seguridad:** el código de correo emplea actualmente un esquema de hash personalizado `pbkdf2-chain6-sha256-v1`, descrito en su propio código como pendiente de revisión independiente. Antes del corte, someterlo a revisión criptográfica y planificar una actualización segura si procede, **sin invalidar contraseñas ya verificadas ni provocar una pérdida de acceso**.

**Estado:** fase 5 en curso. No autoriza el paso a producción.


## Requisito nuevo: acceso privado tipo WordPress para administradores

El nuevo panel se abrirá en otra pestaña del **mismo dominio**, en `/administracion/`, y **pedirá email y contraseña**. El editor ya no se muestra dentro del área normal de socios. El plan para Fase 6 deberá desplegar la ruta de administración y conservar el aspecto de la web pública. Se ha construido y probado sin despliegue mediante `cloudflare/assemble-admin-candidate.mjs`.

**Bloqueo de autenticación previo a la migración:** existen 2 administradores en la D1 de staging, pero ninguno tiene una contraseña de correo verificada. Antes de publicar es imprescindible que cada administrador active su propia contraseña mediante un enlace de verificación seguro, vinculado a su perfil ya existente, sin crear una cuenta adicional. No pedir contraseñas por chat o GitHub y no modificar roles automáticamente. La prueba automatizada usa cuentas exclusivamente ficticias: [51/51 aprobado](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43147872789).

Detalles: `cloudflare/PANEL_ADMIN_SEPARADO_FASE5.md`. Este cambio **no sustituye** el respaldo privado restaurable, la revisión de Workers Free ni el plan de reversión.

---
