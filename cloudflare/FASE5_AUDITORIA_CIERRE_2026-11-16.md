# Bellaquitas Fest — auditoría y avance intensivo de Fase 5 (16/11/2026)

## Resultado verificable

**Fase 5 NO terminada.** Se avanzó sustancialmente sin modificar `main`, DNS, `bellaquitas.fr`, puntos o visitas.

### Datos y recuperación

- Se inspeccionaron ocho CSV exportados por el responsable desde el origen real, sin subirlos a GitHub.
- Comprobación de IDs de las seis cuentas, seis perfiles y seis identidades Google, incluyendo 2 roles admin.
- 12 tablas públicas con 14 registros; estado en origen y staging comparado campo por campo.
- Una copia cifrada autenticada AES256-GCM se generó y se verificó localmente; ZIP de recuperación incluye 13 entradas. **La clave se distribuyó como archivo en el chat: todavía no se ha rotado de forma privada.**
- Restauración Cloudflare D1 EU independiente `bellaquitas-origen-recuperacion-20261116` con exactamente 6 perfiles, 6 Google, 14 registros públicos, 1.999.998 puntos actuales/históricos, 0 visitas, 22 tablas de aplicación, 17 índices y 5 triggers, todas las relaciones comprobadas sin huérfanos.
- La copia CSV es de **datos core**, no es un `pg_dump` íntegro de `auth`, no contiene contraseñas ni binarios de vídeo. El gate de backup completo sigue `false`.
- La séptima cuenta que existe solo en staging se mantiene intacta. No se duplica al restaurar los 6 perfiles originales.

### Infraestructura Cloudflare

- Worker `bellaquitas-api-staging`: **17 bindings, 5 secretos, 0 bindings R2**, medios por `bellaquitas-media-qa`, binding D1 `DB`.
- `STAGING_MUTATIONS=disabled`, `ALLOW_NEW_ACCOUNTS=no`, `EMAIL_REGISTRATION_ENABLED=no`; sin mutaciones de socios.
- D1 staging: 7 perfiles / 2 administradores / 1.999.998 puntos / 0 visitas. D1 restore original: 6 perfiles / 2 administradores / mismos puntos y visitas.

### Pruebas automáticas nuevas y su ejecución

- Creado `cloudflare/test-stage-http-phase5.mjs`: **70 aserciones HTTP reales** en staging, incluidos:
  - API pública, lectura de D1 y estado de eventos/ventajas;
  - panel /administracion/ y selector ES/FR;
  - cabeceras `no-store`, CSP con nonce, anti-clickjacking, `noindex`;
  - bloqueo de rutas de datos privados y de cinco POST sin sesión;
  - los cinco MP4 originales en Static Assets, cada uno con bytes inicial y final (HTTP 206 exacto).
- CI en `.github/workflows/bellaquitas-phase5-preflight.yml`:
  - revisión de secretos/respaldos privados;
  - fusión de cuentas con puntos y roles ficticios;
  - flujo de dos administradores sintéticos por email/contraseña;
  - auditor de exportaciones origen;
  - prueba anti-publicación `test-release-gates.mjs`.
- [CI fase 5 — 70 HTTP + QA offline SUCCESS](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43842331536).
- [CI migración sin despliegue SUCCESS](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43842331361).
- [CI de seguridad migración SUCCESS](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43842331347).

### Compatibilidad visual

- Capturas de QA desde GitHub Actions: escritorio Chromium ES/FR (1440×900), Pixel 7 Chromium ES/FR (1082×2202), iPhone 13 WebKit ES/FR (1170×1992); se revisaron internamente.
- Cabecera con logotipo, selector idioma y hamburguesa visibles en las capturas. Los frames de vídeo/animación difieren entre capturas: no es un test válido de paridad píxel a píxel; en WebKit la imagen de fondo se aprecia borrosa en la captura, pero sin prueba física no atribuimos causa ni aseguramos solución.
- Safari real iPhone queda pospuesto a fase 6 por decisión anterior del responsable; el test visual simulado **no sustituye** esa prueba.

### Gestión segura de lanzamiento

- `cloudflare/release-gates-2026-11-15.json` actualizado a 16/11 con verificación origen y CI (10/16 superados, 6 pendientes).
- Creado `cloudflare/test-release-gates.mjs`: rechaza habilitar producción mientras haya controles pendientes y exige autorización final expresa.
- Creado `cloudflare/PLAN_PUBLICACION_REVERSIBLE_2026-11-16.md`: copia puntual, reconciliación de delta, despliegue, DNS y plan de reversión separado del rollback de datos.
- Herramienta offline de rotación AES-GCM del formato `BQBK1` generada para el responsable; **no** se ejecuta de forma remota ni se crea una nueva clave dentro de ChatGPT.

## Seis controles aún abiertos, con motivo

1. `realHttp206AndIosAndroidPlayback`: las 10 respuestas 206 y Android confirmado sí; iPhone físico diferido.
2. `bothRealAdminLoginsVerified`: staging tiene dos perfiles admin pero sesión de un solo perfil y **cero** credenciales email de administradores creadas; el responsable confirma pruebas manuales previas sin evidencia técnica de dos inicios Cloudflare.
3. `productionDatabaseBackupConfirmed`: origen **core** restaurado; falta copia integral/autenticación completa si se exige un respaldo PostgreSQL integral.
4. `exposedBackupKeyRotatedOutOfChat`: clave del respaldo original figura en archivo del chat; renovación exclusivamente local pendiente.
5. `realDeviceQrDoorTest`: pruebas sintéticas, UI y validación manual informada positiva; falta evidencia técnica de acceso real por backend definitivo en dominio final.
6. `finalEsFrMobileVisualParity`: ES/FR panel, mirror y WebKit/Chromium simulados correctos; falta revisión exhaustiva del contenido dinámico en móvil y prueba física iPhone.

### Estado de producción

**`productionChangesAuthorized=false`**, PR #3 en borrador, sin combinar con `main` ni cambiar DNS. No se debe afirmar que Fase 5 está completa ni prometer cambio de dominio hasta superar las verificaciones estrictas.

### Limitaciones de auditoría

Las pruebas HTTP y las consultas D1 se ejecutaron realmente. El flujo de dos administradores en CI usa cuentas sintéticas; no se conocen ni prueban contraseñas reales. Se ha contrastado el backup core con CSV originales y restauración D1 aislada; no se ha podido acceder a un `pg_dump` integral del proveedor origen.
