# Vista administrativa VISUAL aislada (14/11/2026)

Worker: bellaquitas-admin-visual-preview
URL: https://bellaquitas-admin-visual-preview.bellaquitas-fest-410.workers.dev/administracion/

## Descripción

Visualización segura del formulario /administracion/ creado desde admin-console.js. El Worker no tiene bindings de D1, R2, Supabase, correo ni secretos. Nunca concede sesión administrativa.

La pantalla se verificó con Cloudflare Browser Rendering. NO permite iniciar sesión, modificar puntos, gestionar eventos ni acceder a datos personales.

La versión visual no modifica bellaquitas.fr, su DNS ni el Worker staging. No introduce credenciales reales aquí.

## Pendientes

Backups de producción, nueva clave de respaldo, vinculación verificada de correo y contraseña de administradores, Worker completo con assets exactos, pruebas de login real, QR/iPhone/Android, conciliación final y publicación reversible.
