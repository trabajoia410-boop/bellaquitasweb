# Bellaquitas Fest — preproducción D1 creada y primera importación verificada
Fecha: 16 de noviembre de 2026

## Operación real realizada
Se creó en Cloudflare Free una base D1 separada de staging y de restauración, con jurisdicción **eu**:

- **Base nueva:** `bellaquitas-produccion-preparada-20261116`
- **ID:** `3d65c23d-4d03-4988-9d7f-23d4f95cbc3c`
- **Esquema:** 22 tablas, 17 índices, 5 triggers, idénticos al esquema de `bellaquitas-staging`. No se ha adjuntado ningún Worker ni dominio.
- **Primera carga:** 23 filas reales y verificadas, copiadas desde la D1 de staging. Previamente se cotejaron **campo por campo** los seis perfiles originales, sus seis identidades Google y todas las tablas de contenido del origen restaurado `bellaquitas-origen-recuperacion-20261116`.
- **Séptimo perfil:** conservado con identidad email y credencial verificada de staging. No se presupone que sea ficticio.
- **Resultado:** siete perfiles, dos administradores, seis identidades Google y una identidad email con su credencial verificada; 1.999.998 puntos actuales y 1.999.998 puntos históricos, cero visitas. Un evento, dos actividades, tres cambios administrativos, contenido y borrador de web preservados.
- **Integridad:** 14 tablas incluidas comparadas fila a fila con staging: **14/14 idénticas**; esquema total **44/44 objetos idénticos**; `PRAGMA foreign_key_check`: **cero errores**.
- **No trasladadas a la nueva base:** sesiones de login y administración, tokens de email, estados OAuth caducables, rate limits, auditorías de staging ni el antiguo registro de migración de medios R2. Las cinco definiciones de triggers se restauraron y se contrastaron con staging tras la carga inicial.
- **Origen intacto:** no se alteraron usuarios, puntos, visitas ni registros de `bellaquitas-staging`, `bellaquitas-origen-recuperacion-20261116`, el proveedor original o `bellaquitas.fr`.

## Lo que significa y lo que NO significa
**Se ha migrado una fotografía inicial** a una D1 nueva, por primera vez destinada exclusivamente al futuro entorno de producción. Esta fotografía **no demuestra que el proveedor anterior no haya recibido nuevos registros desde los CSV**. No equivale a una migración definitiva ni reemplaza el respaldo privado original ni un volcado integral de credenciales.

No se ha reactivado R2 ni Supabase para hosting. No se crearon cuentas de pago.

## Configuración preparada en GitHub
- `cloudflare/wrangler-api-preproduccion.jsonc` describe un Worker **sin rutas**, `workers_dev:false`, D1 independiente, sin R2 y con altas/mutaciones/login por email cerrados. **Es un archivo preparado, no un despliegue del Worker.**
- `cloudflare/test-preproduction-config.mjs` lo valida automáticamente en CI, junto con la política de publicación.
- `cloudflare/release-gates-2026-11-15.json` deja `realUsersImported:true` para la fotografía inicial, pero `finalAccountReconciliationCompleted:false`, `productionWorkerConfigured:false` y `authRoutePreflightPassed:false` hasta disponer de evidencia final.
- `cloudflare/release-policy.mjs` exige las tres condiciones finales y la autenticación técnica verificada para permitir el cambio de DNS. Que haya usuarios copiados NO autoriza publicar automáticamente.

## Pendientes realmente necesarios antes de cortar
1. Conciliar los **cambios ocurridos en el sistema original desde la exportación**; no inventar un delta ni sobrescribir puntos divergentes.
2. Acreditar custodia privada del respaldo cifrado completo y rotación de clave antigua. Los ocho CSV y clave de recuperación fueron generados el 16/11; no pedirlos otra vez ni presentarlos como inexistentes.
3. Configurar Worker definitivo, media directa y OAuth/correo para el dominio, con credenciales en secretos de Cloudflare y sin enviar claves por chat.
4. Validar las rutas de identidad y edición con cuentas sintéticas. Los dos inicios de sesión **reales** se comprobarán después de publicar, por decisión del propietario.
5. Tener zona DNS activa en Cloudflare y un plan de recuperación; no cambiar los nameservers de Hostinger hasta preparar los servicios.

## Comprobaciones personales posteriores a publicar
Inicio real de ambos administradores, QR/control de puerta, vídeo en iPhone/Samsung y revisión visual ES/FR. No repetirlas ahora ni declararlas aprobadas sin haberlas realizado.

**Seguridad:** `bellaquitas.fr`, GitHub `main`, el DNS del registrador, puntos y visitas de las bases previas permanecen sin cambios. La PR #3 continúa en borrador.
