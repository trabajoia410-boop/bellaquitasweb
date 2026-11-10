# Bellaquitas Fest — migración desde Supabase a Cloudflare

Estado de 10 noviembre 2026. **Supabase y GitHub Pages son producción**.
Cloudflare es un entorno aislado de pruebas; no cambiar el dominio hasta
que la migración esté completamente validada.

## Terminado

- [x] Cuenta Cloudflare conectada mediante complemento ChatGPT.
- [x] D1 `bellaquitas-staging` creado con jurisdicción `eu`.
- [x] 12 tablas creadas y esquema versionado en `migrations/0001-schema.sql`.
- [x] R2 `bellaquitas-media-staging` creado en Europa occidental.
- [x] Bucket R2 sin dominio público r2.dev y sin custom domain.
- [x] API Worker `bellaquitas-api-staging` conectada con DB y MEDIA,
      desplegada al 100 % de tráfico según API de Cloudflare.
- [x] Solo operaciones GET públicas y de galería publicada; toda escritura
      bloqueada. Sin rutas de socios, puntos, visitas ni administración.
- [x] Snapshot de datos públicos desde Supabase: 1 evento, 1 site_content,
      0 premios/promociones/galerías. No se leyeron ni alteraron puntos durante
      este proceso.
- [x] Script de pruebas de lectura `test-staging-api.mjs` creado (no ejecutado
      en remoto: sin resolución de workers.dev desde el entorno actual).

## Pendiente antes de migrar producción

- [ ] Probar HTTP /health, /v1/site, /v1/events, etc. contra el Worker.
- [ ] Implementar autenticación robusta en Cloudflare Workers (p. ej.
      Better Auth con D1), Google OAuth y correo/contraseña.
- [ ] Almacenar secretos OAuth y de sesión **solo** en Cloudflare Secrets,
      nunca en GitHub ni en la web cliente.
- [ ] Configurar un servicio de correo transaccional para verificación
      y recuperación de contraseñas.
- [ ] Migrar las identidades y sus vinculaciones evitando duplicados,
      con nuevas sesiones al cambiar de proveedor; probar las 6 cuentas.
- [ ] Migrar datos de miembros sin modificar registros de producción,
      conservar `id`, `member_code`, puntos y visitas.
- [ ] Migrar las 3 imágenes existentes de Supabase Storage (logos) a R2,
      comprobar hash/tamaño y actualizar las URL solo cuando existan.
- [ ] Implementar transacciones atómicas para el registro de visitas,
      puntos, recompensas y control de puerta con autorización en servidor.
- [ ] Validar todas las rutas de admin, puerta y socio con pruebas
      adversariales y permisos estrictos.
- [ ] Verificar inicio de sesión persistente, Google, restablecimiento,
      QR en móvil y doble escaneo; solo datos de prueba.
- [ ] Exportar y verificar respaldo antes del corte; actualizar frontend,
      DNS y callback OAuth con posibilidad de volver a Supabase.
- [ ] Monitorizar incidentes y verificar igualdad de recuentos post corte;
      no borrar Supabase ni darlo de baja sin aprobación.

**Nota:** Cloudflare D1 no proporciona por sí solo login de Google o
correo/contraseña, por lo que el backend no debe cambiarse hasta disponer
de un proveedor de identidad y una implementación revisada.
