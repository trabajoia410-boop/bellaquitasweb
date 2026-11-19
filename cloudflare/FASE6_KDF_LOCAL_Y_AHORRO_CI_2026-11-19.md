# Bellaquitas Fest — fase 6: PBKDF2 real en Workerd local y reducción de pruebas innecesarias

Fecha: **19/11/2026**. Rama: `migracion/fase5-segura-20261114`. PR #3 permanece borrador. **Sin DNS, Worker público, modificaciones de D1, cuentas, saldos ni instalaciones en el ordenador del propietario.**

## 1. Prueba criptográfica real en motor local Cloudflare Workers

Se creó un arnés de pruebas local que **importa exactamente `passwordHash` de `cloudflare/email-auth-routes.js`**. El único cambio en ese módulo de producción es exportar la función pura para este ensayo; la lógica del hash, la autorización y las rutas no cambian.

- `cloudflare/kdf-workerd-local-only.js`: Worker exclusivamente local, con contraseña y sal sintéticas, restricción de host `127.0.0.1`/`localhost`, POST y cabecera de QA. No sirve rutas `/v1/`, ni tiene D1, proveedores, secretos, assets, rutas DNS o `workers.dev`.
- `cloudflare/wrangler-kdf-local-only.jsonc`: `workers_dev=false`, sin bindings ni dominio; **únicamente** ejecutado con `wrangler dev --local` sobre localhost.
- `cloudflare/test-kdf-workerd-local-only.mjs`: comprueba 404/403/405 para rutas y métodos no autorizados, igualdad exacta con un vector PBKDF2 sintético y que el informe no certifique CPU real.
- Workflow `.github/workflows/bellaquitas-kdf-workerd-local-qa.yml`: sin `CLOUDFLARE_API_TOKEN`; no contiene comando `wrangler deploy`. Caso específico a prueba bajo GitHub Actions, ejecución `44525955475`, job `135566457738`, conclusión **success**.

**Medida observada:**
- 6 fases × 100.000 iteraciones, esquema `pbkdf2-chain6-sha256-v1`.
- **91 ms de tiempo transcurrido dentro del motor Workerd local**.
- **97 ms de tiempo total cliente local**, incluidas las operaciones HTTP locales.
- El hash sintético resultante **coincide** con el vector de referencia, sin contraseñas reales.

**Límite importante:** Workers Free tiene **10 ms de CPU por petición**, mientras que estos 91 ms son **tiempo transcurrido**, no `cpuTime` facturable. No confundir; ni concluir que necesariamente falla ni afirmar que cumple Free. El endpoint `/v1/auth/email/login` real y los caminos de registro/restablecimiento siguen **sin perfil CPU remoto seguro**. Por eso `FREE_TIER_CPU_VERIFIED=no`, `phase6CpuSafety.realPasswordKdfAndVideo206Profiled=false` y demás puertas CPU se conservan cerradas.

**No se ha reducido el trabajo criptográfico (600.000 iteraciones), alterado hashes históricos, ni cambiado el login por contraseña.** Google OAuth se conserva.

## 2. Menos pruebas automáticas innecesarias

Las comprobaciones HTTP de staging, los cinco MP4 y los navegadores son esenciales cuando cambia código o diseño, pero los informes Markdown no cambian el funcionamiento.

Se actualizaron los disparadores de tres workflows:
- `.github/workflows/bellaquitas-phase5-preflight.yml`: excluye `!cloudflare/**/*.md` de push y PR; conserva pruebas para JavaScript, configuraciones, medios y diseño.
- `.github/workflows/cloudflare-migration-qa.yml`: excluye documentación Markdown, conserva la auditoría de permisos y paridad.
- `.github/workflows/qa-cloudflare-migration.yml`: ahora limita los `push` y `pull_request` a código, configuraciones, assets y cambios de workflow, excluyendo los informes `.md` de `cloudflare/`.

El repositorio es **público** según la API GitHub. Reducir ejecuciones redundantes disminuye peticiones a los Workers de staging y trabajo innecesario en CI. No se atribuye ninguna cantidad de ahorro sin observarla.

## 3. Decisión de seguridad y gasto cero

- El hash PBKDF2 actual **no ha demostrado cumplir 10 ms de CPU**; queda bloqueada la publicación por contraseña hasta perfil CPU representativo o alternativa segura validada.
- No sustituir el hash por SHA-256 rápido ni reducir iteraciones para «encajar»: eso debilitaría la defensa frente a contraseñas robadas.
- Si el hash resultase incompatible con Workers Free, una posible alternativa adicional sería **acceso por enlace de correo de un solo uso**, con Turnstile, límites y tokens de corta duración usando Resend Free. **No se ha implementado ni habilitado**, y no sustituye por sí mismo el requisito original de email y contraseña. Cualquier autenticación nueva exige auditoría y pruebas antes del dominio real.
- Mantener Google OAuth, el editor y las sesiones preparados y el Worker de preproducción en `SITE_MODE=preproduction`, `PUBLISH_APPROVED=no`.
- La suscripción Workers Free y los consumos de D1/R2 de las capturas anteriores ya están reconocidos. Falta cerrar facturación completa de otros productos y baja administrativa efectiva R2; no pedir al propietario otra vez las mismas capturas.
- El respaldo D1 nuevo ya fue cifrado y restaurado. No se ha podido recifrar el archivo viejo del 16/11 por falta de acceso a sus bytes originales; no solicitar de nuevo su clave de respaldo nueva.

## 4. Siguientes bloqueos

1. Resolver la viabilidad de autenticación por contraseña dentro del límite de CPU real, sin debilitar seguridad ni contratar un plan.
2. Certificar gasto cero con las evidencias disponibles y sin inventar accesos de facturación.
3. Cerrar rotación del respaldo legado cuando sea técnicamente posible, sin exponer secretos en chats ni repositorios.
4. Reconciliar el delta final del proveedor antiguo, verificar el respaldo final y preparar la delegación DNS y publicación; posponer pruebas manuales físicas hasta después de publicar según instrucciones previas.

**Resultado:** el ensayo aislado se completó y el riesgo de KDF quedó medido de forma reproducible; los Workflows evitan más ejecuciones por informes. **Fase 6 no cerrada; PR #3 sin fusionar.**
