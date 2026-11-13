# Bellaquitas Fest — fase 5: implementación y comprobaciones del 13/11/2026

**Estado:** Fase 5 de 6 en curso. **No publicado, no autorizado para corte.** Todas las modificaciones de código se guardan en la rama de auditoría `auditoria/fase5-2026-11-11`, no en `main`. La web oficial sigue sirviéndose desde GitHub Pages con Supabase Auth. Sin cambio de DNS, Worker desplegado ni puntos/visitas reales.

## 1. Panel independiente con sesión real — preparado, pero NO activado

**Estado observado:** `app.js` oficial utiliza Supabase JS 2.118.0, con persistencia nativa de sesión `getSession()` y autenticación Google/correo. El panel candidato esperaba solo una cookie D1 Cloudflare, por lo que no existía un acceso real entre ambos.

**Cambios en laboratorio:**
- `qa-candidates/supabase-admin-bridge.js` comprueba la sesión de Supabase contra `/auth/v1/user` y el rol *actual* mediante `/rest/v1/profiles` con RLS. No confía en el rol del cliente, email, campos editables ni un JWT sin validar.
- `qa-candidates/admin-console-routes.js` exige que **el mismo ID sea administrador en Supabase Y en D1**, valida origen y emite cookies HttpOnly Secure temporales que no requieren otra contraseña. Por cada llamada posterior verifica otra vez el bearer de Supabase y el rol actual (además de las cookies). Logout del panel elimina la sesión administrativa sin cerrar la web pública.
- `qa-candidates/admin-console-browser.js` usa el **cliente Supabase del mismo origen** y su sesión nativa; no crea otra clave de almacenamiento ni guarda contraseñas. El HTML incluye `/config.js` como la web pública. Se añadió la ruta protegida `/administracion/api/supabase-bridge`.
- Por defecto NO se habilita; requiere `ADMIN_SSO_ENABLED=yes`, `ADMIN_SUPABASE_BRIDGE=yes`, el host Supabase oficial y una clave **pública**, no `service_role`.

**Pruebas con Auth/RLS simulados (sin una cuenta real):**
- https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43380772106
- https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43380007361
- https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43381023344

**Pendiente:** verificar en entorno seguro con las **dos cuentas administradoras existentes**, login Google/email, renovación y cierre de sesión reales, que miembro/puerta no entran y caída del rol revoca acceso. Exigir mismo origen `bellaquitas.fr` durante el futuro corte autorizado; no se ha desplegado ni probado con bearer privado real.

## 2. Medios sin R2 y diseño original intacto — verificado en staging

- R2 retirado por petición del propietario: **0 buckets, 0 objetos**. No recrearlo.
- Comprobación D1 EU de `site_content.page_settings` y `site_drafts.settings`: antes conservaban prefijo `/v1/assets/logos/` de R2; se actualizaron **una fila en cada tabla de staging** para volver a los tres logotipos públicos originales de Supabase Storage. Verificación después: **0** referencias antiguas.
- Revisión adicional de columnas `events.image_url`, `rewards.image_url`, `moments_photos.storage_path`, `site_content` y `site_drafts`: **0 registros** con referencias al bucket eliminado o al antiguo endpoint de logotipos. El registro histórico `media_migration_log` conserva sus tres filas como evidencia de la migración anterior; no apunta el diseño a R2.
- Migración idempotente documentada en `migrations/0008-restore-original-logo-urls.sql`.
- En el futuro Worker candidato, `qa-candidates/static-media-fallback.js` resuelve **únicamente los 5 MP4 originales** y las imágenes conocidas mediante redirección 307 a los archivos exactos de GitHub Pages; **no lee R2 ni recodifica los MP4**. Los scripts JS originales/QR permanecen servidos desde la instantánea. Test: https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43380874606.
- El Worker remoto de staging anterior **todavía existe con el código viejo**, por lo que sus rutas de MP4 eliminados fallan cerrado (503). Esto está comprobado en https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43381084529. **No equivale a la entrega funcional del vídeo nuevo por Cloudflare**, que solo se comprobará después de una publicación explícitamente autorizada.
- Comprobación GitHub audit frente a `main`: **19/19 blobs de assets idénticos**, `index.html`, `styles.css`, `locale-fr.js` idénticos (1/1 cada uno); `app.js` de auditoría incorpora los enlaces al nuevo panel, sin cambio en `main`.

## 3. Conciliación de usuarios, puntos y roles — comprobación real y lectura solamente

Se compararon **por ID** los campos `role`, `member_code`, `points`, `lifetime_points` y `visits` de todos los perfiles reales, sin incluir datos personales en este registro:

| Métrica | Supabase oficial | D1 de pruebas |
| --- | --- | --- |
| Perfiles reales coincidentes | 6 | 6 |
| Filas totales | 6 | 7 (incluye 1 fixture ficticio) |
| Administradores existentes | 2 | 2 |
| Puntos totales | 1.999.998 | 1.999.998 |
| Visitas totales | 0 | 0 |
| Discrepancias en 5 campos | 0 | 0 |

La séptima cuenta es una **fixture aislada con cero puntos y visitas**, debe retirarse/excluirse en la futura conciliación final, no ahora. No se escribieron puntos/visitas en producción ni en D1 real durante la comprobación.

## 4. Copia privada y restauración — programa corregido, **BACKUP REAL PENDIENTE**

- `backup_privado_local.py` ya no pide R2 ni credenciales S3 de Cloudflare; está preparado para exportar **Supabase PostgreSQL completo (Auth incluido), D1 staging y archivos originales Supabase Storage** exclusivamente en un **equipo privado**, cifrar GPG AES256, calcular SHA-256, comprobar tablas/ficheros y restaurar D1 en SQLite in-memory.
- Protección: nunca ejecutar `--run` en GitHub Actions, requiere terminal interactivo, credenciales privadas en el equipo del propietario (no por chat), archivo cifrado fuera de GitHub y hashes para detectar alteraciones. Test de cifrado y corrupción con datos inventados:
  https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43380978724
- PostgreSQL restore **solo sintético** (18 tablas) pasó:
  https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43380479393
- **NO se ha creado una copia REAL cifrada y privada de Supabase**, ni restaurado una exportación REAL de PostgreSQL en un entorno aislado. No hay acceso seguro a las credenciales locales necesarias desde este conector. Las pruebas de D1 y datos agregados no sustituyen una copia. **La fase 6 queda bloqueada.**

## 5. Compatibilidad con cuota Free y seguridad

- Captura real del propietario: `Workers Free` **activo**; `R2 Paid` **cancelado**, caduca **10/12/2026**, coste observado/proyectado 0 USD y 0 facturas a fecha 13/11/2026. No constituye garantía absoluta de futuras facturas/uso no consolidado.
- Cloudflare documentación: Workers Free máximo **100.000 solicitudes/día**, **10 ms CPU por ejecución** y error 1027 al agotarse; imprescindible **fail closed** para rutas críticas. D1 Free bloquea consultas cuando se supera la cuota y no cobra el exceso en Workers Free. KV Free limita lecturas/escrituras, pero tiene **0 namespaces** en la cuenta ahora. No se requiere KV para las funcionalidades ya preparadas, y el futuro sistema de fotografías necesita estudio separado.
- Metadatos D1 reales: `bellaquitas-staging`, jurisdicción **UE**, 20 tablas, `file_size = 270.336 bytes` (aprox. 264 KiB), muy por debajo del límite de tamaño gratis. Esto no prueba aún CPU o cuota de uso diario con tráfico real.
- El modo candidato `COST_POLICY=free-only` bloquea por defecto los bindings `MEDIA` (R2) y la API de correo externo facturable, y **503** si falta la política. Las imágenes dinámicas nuevas permanecen desactivadas para no contratar almacenamiento. QA:
  https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43380874606
- Regresión completa de fase 5 (sin mutaciones) pasada:
  https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43381084501
- Candado de preparación `phase6_readiness.py` exige nuevas evidencias de **sesión Supabase real, control de rol denegado, mismo origen y revocación del logout**, además de respaldos/restore, coste cero y autorización expresa; ensayo aprobado:
  https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43381795527

## Bloqueos para completar fase 5 / autorizar fase 6

1. **NO desplegar**, incluso a una ruta que sirva socios, hasta comprobar puente real de identidad, expiración, logout, dual role, navegación y alcance exacto de `bellaquitas.fr`, conservando el frontend intacto. Los tests de identidad actuales son ficticios.
2. Crear **backup real cifrado** en dispositivo privado con herramientas compatibles y credenciales que jamás se suben al repositorio ni al chat. Restaurar **backup real** de Postgres en servidor aislado y verificar datos; preparar también rollback de D1/Storage.
3. Antes de publicar, comprobar Workers Free sin cargos automáticos, rutas **fail closed** y CPU/auth/almacenamiento en plan gratuito; no reactivar R2 ni correo facturable. La prueba sintética no autoriza contratos ni upgrades.
4. Repetir conciliación real después del respaldo, excluir fixture D1 (sin alterar perfiles existentes), verificar ES/FR, vídeos sin degradación, responsive iPhone/Samsung y QR. Las pruebas físicas iPhone/Samsung siguen acordadas **inmediatamente tras la publicación** de acuerdo con el propietario, con plan de reversión.
5. Requiere **autorización expresa nueva** del propietario para el corte final, tras comprobar todo lo anterior. No hay permiso para modificar `main`, el Worker remoto productivo ni DNS.

**Conclusión:** 5 frentes avanzados, buena paridad de datos y tests automatizados; **fase 5 sigue en curso**. No confundir implementación de candidato con funcionamiento en cuentas reales/publicación, ni copias sintéticas con respaldo real.
