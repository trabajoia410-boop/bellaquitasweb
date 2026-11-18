# Bellaquitas Fest — reutilización de Google OAuth y Resend sin volver a crear claves (18/11/2026)

## Problema resuelto en la arquitectura
El propietario configuró correctamente Google OAuth y Resend en **Cloudflare Worker `bellaquitas-api-staging`** el 10/11. Se confirmó mediante la API de Cloudflare y el plugin Resend:
- `GOOGLE_CLIENT_ID` — secret existente en staging.
- `GOOGLE_CLIENT_SECRET` — secret existente en staging.
- `RESEND_API_KEY` — secret existente en staging.
- Resend `bellaquitas.fr` — **verified**, `sending=enabled`, región EU.
- Remitente `no-reply@bellaquitas.fr`, y Google identidades vinculadas (seis) en D1.
La arquitectura inicial intentaba duplicar los mismos secretos al Worker nuevo, aunque Cloudflare **no devuelve los secretos ya guardados**. No hay razón para volver a crear el proyecto Google, comprar servicios, generar otra cuenta Resend o publicar credenciales en el chat.

## Implementación REAL entregada
Se ha añadido `cloudflare/provider-broker.js` y la conexión:
- Worker con credenciales intactas: `bellaquitas-api-staging`.
- Worker objetivo con datos de siete perfiles: `bellaquitas-api-preproduccion`.
- `services.PROVIDER_BROKER` de Cloudflare a `bellaquitas-api-staging`, **privada, sin pasar por Internet**.
- `PROVIDER_BROKER_KEY` nuevo, aleatorio, creado **una vez dentro de la API de Cloudflare y guardado como secreto en ambos Workers, sin volver a mostrar su valor ni volcarlo en GitHub**.
- Firmas HMAC SHA-256 sobre timestamp + cuerpo; una firma caduca en 30 segundos. Sin firma, ruta `/__internal/providers` HTTP **401** y sin CORS, cookies, información sensible o acceso a proveedor.
- Tres operaciones delimitadas: devolver **solo Client ID público**, intercambiar código PKCE con Google con callback **únicamente** `https://bellaquitas.fr/v1/auth/google/callback` devolviendo solo `id_token`, o solicitar envío Resend con remitente fijo verificado, asunto de un flujo Bellaquitas y enlace a origen canónico. **Nunca** se devuelve Google Client Secret, token Resend ni access token de Google.
- `cloudflare/auth-routes.js` y `cloudflare/email-auth-routes.js` seleccionan los secretos propios si existen (staging), y la conexión interna si el Worker objetivo no los tiene. Los perfiles, sesiones y puntos permanecen en **su propia D1**; staging no crea perfiles por esas llamadas.
- `cloudflare/production-auth-readiness.js` reconoce ahora **ambas estrategias**: secretos directos o Service Binding con HMAC. Los requisitos de respaldo, conciliación del origen, Turnstile, aprobación explícita y flags de seguridad **siguen obligatorios**.
- `cloudflare/release-policy.mjs`: separa `providerBindingsReady` (conexión técnica y credenciales existentes) de `authProvidersReady` (requiere además comprobación real de Google y Resend en el dominio final). Así una configuración técnica no se confunde con el resultado final.
- Pruebas `cloudflare/test-provider-broker.mjs`: intercambio firmado sintético, OAuth PKCE/callback restringido, remitente de correo fijo, rechazo de destinatarios/asuntos maliciosos, claves incorrectas y peticiones sin firma. No se envían correos reales ni se usan cuentas de usuarios en pruebas.

## Verificaciones Cloudflare reales
**Ambos despliegues correctos:**
1. Staging build `b57f6cd3-6c65-47a4-ae07-230cbf76a96a` **SUCCESS**. Google Client ID/Secret, Resend API Key y secreto HMAC siguen guardados; D1 staging conserva el identificador `c7ada9c9-d397-4e22-b5b8-3fbd8d13e550`.
2. Preproducción build `783373e2-e35b-4faf-9353-a3f602483e4d` **SUCCESS**. Se consultaron los bindings: `PROVIDER_BROKER` de tipo service apuntando a staging, `PROVIDER_BROKER_KEY` de tipo secreto, `PROVIDER_BROKER_ENABLED=yes`, D1 destino aislada `3d65c23d-4d03-4988-9d7f-23d4f95cbc3c`. No se copiaron `GOOGLE_CLIENT_SECRET` ni `RESEND_API_KEY` al destino.
3. Dominio público no alterado; Worker nuevo con `SITE_MODE=preproduction`, `PUBLISH_APPROVED=no`, `FINAL_ORIGIN_RECONCILED=no`, `BACKUP_KEY_CUSTODIED=no`, URL workers.dev y previews desactivados, **cero rutas/domínios Worker**. No se habilitan sesiones ni altas de usuarios.

## Precauciones honestas
- Configuración del broker y su HMAC comprobados; **una login Google real para `bellaquitas.fr` y un correo Resend real generado por el Worker definitivo aún no se han comprobado**. OAuth requiere que la URL de callback esté autorizada en Google Cloud Console; esto puede verificarse durante un test previo al corte, pero la conexión técnica por sí sola no lo demuestra.
- El Worker staging original **debe permanecer desplegado** porque custodia las claves existentes. No borrar sus secretos ni eliminar su Worker antes de migrar credenciales a un Secrets Store privado si se elige ese cambio futuro.
- El backup D1 nuevo cifrado fue restaurado, pero la rotación del antiguo archivo de 8 CSV y su clave expuesta sigue pendiente. La conciliación del delta posterior a la exportación del origen antiguo tampoco está certificada.
- La publicación solo se realiza tras superar permisos, respaldo, conciliación, proveedor real y autorización explícita. El PR sigue **draft** sin merge; `main` y el DNS de Hostinger intactos.
