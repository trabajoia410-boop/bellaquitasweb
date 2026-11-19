Bellaquitas Fest — Fase 6. Disparador de build exclusivamente PRIVADO.
Fecha: 2026-11-19.
Motivo: actualizar bellaquitas-api-preproduccion con el código auditado de staging tras superar controles offline, HTTP 206 con originales y seguridad de cookies.
Rama autorizada: migracion/fase5-segura-20261114.
Destino único: Worker bellaquitas-api-preproduccion, workers_dev=false, cero rutas de dominio.
Base de datos: D1 independiente 3d65c23d-4d03-4988-9d7f-23d4f95cbc3c. Mantener los 7 perfiles, 2 administradores, 1.999.998 puntos, 0 visitas.
Seguridad: keep_vars=true, SITE_MODE=preproduction, PUBLISH_APPROVED=no, FINAL_ORIGIN_RECONCILED=no, BACKUP_KEY_CUSTODIED=no, FREE_TIER_BILLING_VERIFIED=no.
Google/Resend: Service Binding PROVIDER_BROKER al staging existente sin copiar secretos. Turnstile conservar bindings existentes.
Prohibido: DNS, registrar, public routes, R2, main, privilegios de admin, sesiones, puntuaciones o publicaciones.
Comprobaciones requeridas antes del deploy: test-preproduction-config, test-production-site-route, test-no-private-backup-leaks, check-release-gates --assert-blocked, build-static-assets --require-logos, Wrangler --dry-run.
Control post-deploy: binding D1 correcto, secretos preservados, 0 rutas, 0 exposición workers.dev, cuentas/puntos iguales, CI.

Revisión de defensa en profundidad 19/11/2026: código de preproducción actual incorpora la condición FREE_TIER_CPU_VERIFIED=yes SOLO para producción. El entorno privado mantiene FREE_TIER_CPU_VERIFIED=no y las otras cuatro puertas no; jamás habilitar producción aquí.
CI del último commit de implementación: 3 de 3 flujos SUCCESS. Sin exposición Workers.dev, sin rutas DNS, sin modificaciones D1, sin paid plan.

Revisión Fase 6: corregido reset transaccional D1 después de hash PBKDF2 (token NO se pierde por fallo CPU, D1.batch atómico con rollback, sesiones revocadas solo al confirmar). Datos sintéticos de dos admins: fallo KDF, fallo SQL tras UPDATE y retorno de token único comprobados. Actualizar Worker privado para concordar con staging y mantener workers_dev=false, FREE_TIER_CPU_VERIFIED=no, PUBLISH_APPROVED=no, DNS y D1 sin cambios. Build sólo si se preservan los controles GitHub de migración.
