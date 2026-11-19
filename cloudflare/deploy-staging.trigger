Bellaquitas Fest — Cloudflare STAGING QA solamente, sin acceso al dominio público.
Activación 2026-11-19, fase 6: validar optimización aislada de CPU/HTTP 206.
Entrada segura: únicamente rama migracion/fase5-segura-20261114 y Worker bellaquitas-api-staging.
Motivo: desplegar el Service Binding VIDEO_QA_PROXY para vídeo MP4 en /espejo/assets/ y evitar escaneo CPU de grandes Byte Range en la API con D1.
Requisitos: test-staging-redeploy-config.mjs, test-no-private-backup-leaks.mjs, check-release-gates.mjs --assert-blocked, build-static-assets --require-logos, wrangler --dry-run.
Sin escrituras de D1, sin rutas a bellaquitas.fr, sin DNS, sin R2, sin activar registro ni edición de puntos. Mantener keep_vars=true y secretos Google/Resend/Turnstile existentes.
Validación postbuild: 5 MP4 originales HTTP 206 inicio y final + bytes exactos, 2 admins sintéticos, OAuth/Broker no expuesto, métricas CPU por versión y sin fallos de recursos.
