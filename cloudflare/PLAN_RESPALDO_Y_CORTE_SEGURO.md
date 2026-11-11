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

## 3. Verificación manual con usuarios de ensayo

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
