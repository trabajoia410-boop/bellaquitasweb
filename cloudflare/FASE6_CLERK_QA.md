# Fase 6 — Integración Clerk en modo seguro (20-11-2026)

## Situación confirmada
- Clerk: aplicación **Bellaquitas**, instancia **development**; Google y contraseña habilitados. **0 usuarios** en esa instancia al realizar la revisión.
- Cloudflare Workers de staging y preproducción existentes; los indicadores `CLERK_JWT_ENABLED` y `CLERK_EXCHANGE_ENABLED` permanecen en `no`.
- La base D1 de preproducción contiene **7 perfiles** (uno de prueba o recuperación por conciliar), **2 admins**, **1.999.998 puntos** y **0 visitas**. No alterar saldos durante QA.
- El Worker ya contiene una ruta `GET /v1/auth/clerk/me`, pero necesita la tabla `auth_clerk_links` y una configuración verificada del emisor Clerk. La ruta no debe habilitarse en la web real antes de los ensayos.
- La web actual sigue usando Supabase: `config.js` y `app.js` no han migrado.

## Migración segura
1. Aplicar `migrations/0004-clerk-identity-links.sql` en **D1 QA aislada**; comparar recuentos y saldos antes/después.
2. No crear usuarios a partir del email; vincular `clerk_user_id` al `profile_id` SOLO después de comprobar el identificador Google `sub` ya existente o verificación equivalente sólida en ambos sistemas.
3. Los registros nuevos permanecen `pending`. Pasar a `migration_confirmed` solo con prueba y registro de auditoría, no con un `SELECT` por email.
4. En staging, configurar emisor y origen exactos; activar exclusivamente ruta de lectura `/v1/auth/clerk/me` para pruebas controladas (respuesta 401/403 a tokens no válidos y sin vínculo). El intercambio a sesión y el panel administrador siguen desactivados.
5. Probar sesión y cierre, permisos de socio/puerta/admin, QR, canjes, compatibilidad móvil y ES/FR sin tocar las cuentas de producción. Los admins requieren un segundo control de seguridad.
6. Reconciliar origen y destino con un respaldo restaurable y custodiar la clave antes de decidir el corte.
7. Verificar manualmente la ausencia de un plan facturable y opciones de gastos en Cloudflare y Clerk. El conector OAuth actual devuelve HTTP 403 para datos de facturación: no asumir que el gasto máximo es cero.
8. No fusionar ni desplegar en `main` hasta pasar QA y confirmar presupuesto sin cobros.

## Límites económicos
Workers Free: 100.000 peticiones por día y 10 ms de CPU por invocación; al rebasar el límite de peticiones del plan gratuito, el Worker deja de atender las solicitudes adicionales. Este diseño no garantiza disponibilidad ilimitada sin coste.
Clerk ofrece plan gratuito con límites propios. No se puede asegurar gasto cero sin comprobar el plan efectivo y los métodos de pago.
La comprobación criptográfica de Clerk usa WebCrypto y JWKS, no el cálculo de contraseñas anterior de 136,424 ms, pero **hay que medir CPU en el runtime real** antes de producción.

## Lo que permanece intacto
No modificar `bellaquitas.fr`, DNS, `config.js`, `app.js`, diseño, imágenes, vídeos, datos de socios, puntos, visitas o roles reales durante esta etapa.
