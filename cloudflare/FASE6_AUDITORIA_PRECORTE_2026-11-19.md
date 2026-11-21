# Bellaquitas Fest — fase 6/6: auditoría real de precorte (19/11/2026)

**Resultado:** NO APTO PARA CAMBIO DE DNS NI PUBLICACIÓN. Esta acta registra verificaciones **solo lectura** realizadas durante el inicio de fase 6, retomando el cierre técnico de fase 5; no ejecuta migración, escritura en D1, despliegue público, fusión ni cambio de nameservers.

## Referencia y continuidad obligatoria

- Conversación de referencia: «Continuar migración web 5» y conversaciones anteriores del proyecto.
- Rama: `migracion/fase5-segura-20261114`; PR #3 **draft**, abierto y sin fusionar con `main`.
- Antes de pedir configuraciones nuevas, verificar la existencia de `PROVIDER_BROKER`, Google, Resend y medios ya desplegados.
- No utilizar Supabase como alojamiento definitivo, ni R2; no solicitar PowerShell; mantener planes gratuitos y medios/diseño sin alterar.

## Evidencia verificada el 19/11, mediante conectores reales

### GitHub
- PR #3 abierto, `draft=true`, `merged=false`, head observado antes de esta acta: `847e9e3a27cc4c550740c6fac15ceb0829a6440c`.
- 166 rutas modificadas en el PR (antes de esta acta).
- Tres GitHub Actions asociadas al commit previo finalizadas en `success`: runs `44426958375` (QA migración), `44426958258` (Cloudflare safe QA), `44426958219` (fase 5 prepublicación).

### Cloudflare y datos D1 — solo lectura
- Cuenta Cloudflare conectada y zona `bellaquitas.fr` presente, plan de zona `Free Website`, estado `pending`.
- Delegación requerida según zona: `donald.ns.cloudflare.com` y `tricia.ns.cloudflare.com`. Los NS originales reportados por la zona: `cosmos.dns-parking.com` y `nova.dns-parking.com`. **No se ha modificado la delegación.**
- DNS en zona pendiente: **10 registros: 4 A, 2 CNAME (www y autenticación correo), 1 MX, 3 TXT**. Los 4 A y el CNAME www apuntan a GitHub Pages; ninguno está proxied. No publicar valores TXT de verificación.
- 0 rutas de Worker asociadas a la zona, 0 Workers Domains; preproducción con `workers.dev` y previews desactivados.
- Worker `bellaquitas-api-preproduccion`: D1 aislada `bellaquitas-produccion-preparada-20261116`, `ASSETS`, `PROVIDER_BROKER` hacia `bellaquitas-api-staging` y HMAC `PROVIDER_BROKER_KEY` presente. Tiene `SITE_MODE=preproduction`, `PUBLISH_APPROVED=no`, `FINAL_ORIGIN_RECONCILED=no`, `BACKUP_KEY_CUSTODIED=no`.
- Worker `bellaquitas-api-staging`: secretos `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`, `PROVIDER_BROKER_KEY` todavía presentes, sin extraer su valor. **No generar otros ni borrar este Worker**.
- `bellaquitas-media-qa`: `ASSETS` presente, sin binding R2.
- Ambas D1 (staging y destino), interrogadas directamente: **7 perfiles, 2 admins, 1.999.998 puntos actuales y vitalicios, 0 visitas, 0 violaciones FK**.
- Se compararon de nuevo **15 tablas** completas fila a fila (orden independiente): `profiles`, `auth_identity_links`, `auth_email_credentials`, `auth_admin_email_links`, `activity`, `admin_member_changes`, `events`, `site_content`, `site_drafts`, `community_suggestions`, `moments_albums`, `moments_photos`, `promos`, `redemptions`, `rewards`. **15/15 idénticas**. Se omitió imprimir información personal y hashes de contraseñas.
- Destino conserva 0 sesiones normales/admin; staging registra 3 sesiones normales y 1 admin. Esto es deliberado: no importar sesiones efímeras ni presuponer continuidad de login entre backends.

### Resend
- Conector Resend: dominio `bellaquitas.fr` `verified`, región `eu-west-1`, `sending=enabled`. No se ha creado clave ni enviado correo de prueba.
- La entrega real originada por el Worker definitivo y el callback OAuth Google en dominio final **no se han verificado**. No confundir secretos/Service Binding con una sesión real autenticada.

### Respaldo y origen
- Cierre de fase 5 documenta copia cifrada D1 del 18/11, SHA-256 `c4f3e2003329336015d949a3a45f3bf29b7f9c03b5124d358707000be7c4b456` y restauración anterior correcta. No se ha rehecho ni adulterado ese backup.
- Se ha localizado el archivo cifrado en Biblioteca, pero el intento actual de obtener bytes para verificar SHA ha sido rechazado por la plataforma (no dispone de vía autorizada de materialización). **No presentar esto como nueva verificación física de archivo**.
- NO se ha demostrado custodia autónoma de la clave privada fuera de ChatGPT; clave antigua/expuesta sin rotación y revocación certificadas.
- NO se ha recuperado la delta de altas, roles, puntos, visitas y actividad del **sistema original posterior a los 8 CSV del 16/11**. Que staging y destino sean idénticas **NO** demuestra ausencia de cambios en el origen.
- Sin autorización de uso del sistema anterior, no se ha accedido a él ni se han hecho afirmaciones sobre datos posteriores al 16/11.

## Restricciones y puertas de publicación

El registro `release-gates-2026-11-15.json` tiene **10/16 aprobadas y 6 pendientes**. De ellas, **2 son de protección previa obligatoria** (respaldo auténtico final / antigua clave expuesta), y **4 quedan diferidas** a después de publicar (iPhone/vídeo físico, 2 admins reales, QR/puerta con teléfono, paridad visual física), por orden del propietario.

Además de esos gates enumerados, la política `release-policy.mjs` exige evidencia actual de delta del origen, custodia separada del respaldo, autorización explícita, preflight de rutas y datos, verificación de proveedores canónicos y DNS según etapa. No alterar flags de bloqueo para forzar aprobación.

El plan de dos etapas sigue vigente:
1. **Antes de NS:** conciliar delta externo y conservar cada cuenta/punto/visita, verificar copia completa recuperable y custodia/rotación de clave, validar seguridad de autenticación y preflight sin publicación, mantener replicados A/www y registros de correo. Solo tras certificación y autorización expresa, delegar nameservers conservando GitHub Pages y la posibilidad de volver atrás.
2. **Después de delegación pero antes de servir app definitiva:** comprobar zona `active`, test controlado Google/Resend sobre dominio canónico, HTTPS/Turnstile/cookies y 503 de protección mientras no haya corte. Activar rutas solo con gates estrictos acreditados. Mantener el origen antiguo disponible para vuelta atrás y hacer QA físico acordado tras publicar.

## Límites gratuitos

Cloudflare Workers Free documenta 100.000 invocaciones/día, CPU de 10 ms por petición dinámica y 20.000 archivos Static Assets por versión, máximo 25 MiB por archivo. Las solicitudes a archivos Static Assets directamente servidos son gratuitas; las invocaciones a Worker para vídeo Range 206 consumen la cuota dinámica. D1 Free limita su uso de filas; las cuotas son **compartidas por cuenta**. Se observan 8 Workers y 7 D1. No inferir de esta cuenta de recursos que se ha certificado consumo futuro o la suscripción concreta de cada producto. Analizar el tráfico de eventos reales antes del corte y preferir fallo cerrado en rutas de seguridad.

## Estado final de esta auditoría

**Fase 6 iniciada y auditable; publicación bloqueada de forma intencional.** D1 no modificada, perfiles/puntos intactos, archivos/medios no reescritos, Worker staging con claves conservado, PR no fusionado, DNS/Hostinger sin cambios. No pedir nuevamente configuración de Google/Resend, vídeos ni PowerShell.
