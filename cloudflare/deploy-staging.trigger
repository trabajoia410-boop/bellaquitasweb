Bellaquitas Fest — Cloudflare STAGING QA solamente, sin acceso al dominio público.
Activación 2026-11-19, fase 6: validar optimización aislada de CPU/HTTP 206.
Entrada segura: únicamente rama migracion/fase5-segura-20261114 y Worker bellaquitas-api-staging.
Motivo: desplegar el Service Binding VIDEO_QA_PROXY para vídeo MP4 en /espejo/assets/ y evitar escaneo CPU de grandes Byte Range en la API con D1.
Requisitos: test-staging-redeploy-config.mjs, test-no-private-backup-leaks.mjs, check-release-gates.mjs --assert-blocked, build-static-assets --require-logos, wrangler --dry-run.
Sin escrituras de D1, sin rutas a bellaquitas.fr, sin DNS, sin R2, sin activar registro ni edición de puntos. Mantener keep_vars=true y secretos Google/Resend/Turnstile existentes.
Validación postbuild: 5 MP4 originales HTTP 206 inicio y final + bytes exactos, 2 admins sintéticos, OAuth/Broker no expuesto, métricas CPU por versión y sin fallos de recursos.

Corrección validada 2026-11-19: caché pública únicamente para MP4 original permitido; cookies eliminadas de la respuesta multimedia. Test sintético de inyección Set-Cookie aprobado antes de publicar esta revisión.
Cambios excluidos: producción, DNS, punto, visitas, cuentas y secretos. Build staging debe mantener la D1 original y el Service Binding VIDEO_QA_PROXY.

Fase 6, corrección de recuperación de contraseñas (19/11): actualizar SOLO staging con reset transaccional D1. El token se conserva si falla PBKDF2 y las tres escrituras (credenciales, revocación de sesiones y consumo del token) se realizan en un único D1.batch. QA sintética con 2 admins: rollback simulado y token de un solo uso, seguridad y HTTP reales aprobados. No crear ni usar credenciales reales. No cambiar DNS, Worker de producción, tokens, puntos, Google ni Resend.

Fase 6 Clerk 20/11/2026: prueba de compatibilidad SOLO STAGING tras introducir rutas Clerk opt-in y sin publicar UI. En el Worker staging se ha comprobado antes del build que NO existen CLERK_JWT_ENABLED, CLERK_EXCHANGE_ENABLED ni CLERK_QA_PREVIEW (default deshabilitado). No importar usuarios ni escribir D1, y mantener intactos Google OAuth, correo, sesiones BF, 2 admins, puntos y vídeos. Rama y Worker exclusivos, sin dominio público, facturación de pago, R2 o nuevas rutas DNS.
