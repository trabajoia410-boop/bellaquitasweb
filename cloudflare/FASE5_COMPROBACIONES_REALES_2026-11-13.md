# Bellaquitas Fest — fase 5, controles REALES de solo lectura

**Fecha:** 13 de noviembre de 2026, después de las pruebas sintéticas.  
**Alcance:** consultas solo lectura a Supabase, Cloudflare API, dominio público y GitHub Actions. **Sin despliegue, sin modificación de DNS, sin actualización de main, sin datos personales descargados, sin contraseñas ni transacciones de puntos.**

## 1. El dominio publicado conserva el aspecto y los medios originales

Prueba automatizada con HTTP GET **en el dominio real** `https://bellaquitas.fr`, sin cookies, autenticación ni escrituras:
- `index.html`, `styles.css`, `config.js`, `locale-fr.js` y `app.js`: hash SHA-256 idéntico al blob del `main` oficial `aafb4de85a204cdb79b281815df5819417e7d9c6` (comprobados desde el CDΝ público).
- Los cinco vídeos MP4 originales, incluido el de móvil, responden **HTTP 206 Content-Range bytes 0-1023**, conservan `Content-Type: video/mp4` y sus primeros 1.024 bytes coinciden con el repositorio original.
- El script `cloudflare/test_public_domain_live_readonly.mjs` no pide usuarios ni cuentas; se ejecutó con `contents: read`.
- [GitHub Actions real aprobado](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43512593004).

**Límite:** leer 1 KiB por vídeo no equivale a verificar reproducción audiovisual en todos los dispositivos ni todos los bytes. La comparación Git completa de 19 assets ya pasó [aquí](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43510698131).

## 2. Supabase sigue gratis y conserva cuentas/medios

Supabase Management (consulta de lectura):
- Organización en plan **Free / tier_free**.
- Proyecto `vlsipvngvxcgnwrhpjgg` **ACTIVE_HEALTHY**, región `eu-west-3`, PostgreSQL **17.11**.
- 6 perfiles de usuario y 6 usuarios Auth, 2 administradores, 6 identidades Auth.
- 3 originales de logos en Storage dentro de `bellaquitas-media`. El hecho de haber eliminado R2 **no** borró los originales de Supabase.
- D1 staging: 7 perfiles, de los cuales 1 es un fixture ficticio de QA, 2 administradores; los puntos disponibles, acumulados y visitas agregados **coinciden** con Supabase original. 0 URLs antiguas R2 en `site_content` y `site_drafts`. No se modificó ninguna tabla en estas comprobaciones.

## 3. Acceso público real: rutas privadas protegidas

Se probó el servicio Supabase real con la clave `anon` **pública** del `config.js` (sin imprimirla); todas las solicitudes fueron HTTP **GET**, sin tokens de socios y sin mutaciones:
- `/rest/v1/profiles`: no expone datos personales de socios.
- `/rest/v1/admin_member_changes`: no expone cambios administrativos.
- `/rest/v1/activity`: no expone historial de visitas/puntos.
- `/rest/v1/redemptions`: no expone canjes.
- `/auth/v1/user`: no devuelve una sesión/identidad privada sin token de usuario.

[GitHub Actions real aprobado](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43512968403).

**Límite:** esto solo prueba la negación anónima, no el SSO auténtico del administrador, ni permisos de socios ya autenticados, ni un pentest.

## 4. Cloudflare API: actual bloqueo real de la migración

Consulta **GET** a la cuenta Cloudflare `7698bb24db010350ba4b02c36c0fbeb5`:
- **0 zonas** Cloudflare para `bellaquitas.fr`. El DNS se mantiene en el hosting actual; no se ha migrado al proxy Cloudflare.
- **0 Workers custom domains** configurados en la cuenta.
- **1 Worker desplegado**: `bellaquitas-api-staging`. Es la versión antigua de staging, NO el candidato SSO nuevo.
- El Worker antiguo conserva binding R2 **`MEDIA`** aunque ya se borró el bucket, y conserva binding de secreto **`RESEND_API_KEY`**. La presencia de un secreto no equivale a un envío/cargo, pero **no cumple el requisito final de retirar dependencias facturables**.
- D1 `bellaquitas-staging` (EU): **20 tablas, 270.336 bytes**.
- La cuenta tiene el subdominio gratuito de Workers `bellaquitas-fest-410`, pero este **no comparte origen de navegador** con `bellaquitas.fr`; no basta para SSO transparente.

**Consecuencia:** la URL `https://bellaquitas.fr/administracion/` aún NO puede ser servida por el Worker nuevo desde ese origen. Implementar esto requiere configurar proxy/rutas Cloudflare para el dominio tras autorización y ensayo de rollback, o un diseño alternativo de frontend admin estático en GitHub Pages con API cross-origin segura que **aún no existe**. El usuario pidió **sin segundo login, no cambiar el diseño y 0 €**, por tanto no desplazar DNS ni activar integraciones con coste por defecto.

El candado `cloudflare/phase6_readiness.py` se ha reforzado para requerir `costs.deployed_worker_r2_binding_absent_verified` y `costs.deployed_worker_bindings_audited` si R2 fue retirado. [Pruebas del candado aprobadas](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43512350717).

## 5. Qué NO ha sido posible hacer sin credenciales privadas

1. **Backup completo cifrado auténtico** de PostgreSQL/Auth y Storage, más su **restauración auténtica** en PostgreSQL 17 local aislado. Las APIs conectadas permiten SQL de lectura, no exportar y restaurar un backup confidencial privado. El programa `backup_privado_local.py` exige credenciales y contraseña GPG **solo en el dispositivo del propietario**, fuera de GitHub y este chat. No hay evidencia de respaldo real.
2. **SSO con los administradores reales**. No se dispone del access token privado de una sesión autenticada en el navegador del propietario y no se debe pedir que lo copie aquí. Las pruebas con cuentas falsas pasan, pero NO prueban el acceso real.
3. **Publicar el panel desde el origen oficial**, medir CPU gratuita real, probar cámara/QR en iPhone/Samsung físicos y desplegar la migración. Además de requisitos faltantes, no hay zona/ruta Cloudflare para ese dominio y **no existe autorización de corte final**.

**Estado honesto:** fase **5 de 6, bloqueada para publicación**. Se han verificado el dominio actual y la seguridad anónima real; la web pública y las cuentas reales no se han alterado y no se han activado recursos de pago. R2 sigue retirado.
