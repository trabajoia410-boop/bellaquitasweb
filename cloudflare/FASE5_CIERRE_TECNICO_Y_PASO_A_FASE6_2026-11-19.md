# Bellaquitas Fest — cierre de entrega TÉCNICA de fase 5 y traspaso seguro a fase 6

**Fecha de comprobación:** 19 de noviembre de 2026.  
**Estado que sí se puede certificar:** preparación técnica de fase 5 **ENTREGADA**; sin necesidad de volver a crear Google OAuth, Resend, medios o base D1.  
**Estado que NO se puede certificar:** **aprobación para publicar**. Los controles de respaldo legado, delta del origen, custodia externa y pruebas reales continúan pendientes y no deben aprobarse por aproximación.

## 1. Qué está realmente terminado

**Arquitectura y código:** GitHub PR [#3](https://github.com/trabajoia410-boop/bellaquitasweb/pull/3), rama `migracion/fase5-segura-20261114`, **borrador, sin fusionar**. Worker privado de Cloudflare `bellaquitas-api-preproduccion`, D1 UE `3d65c23d-4d03-4988-9d7f-23d4f95cbc3c`, Static Assets originales, edición, eventos y panel separado `/administracion/`, base ES/FR, vídeo Android/iPhone probado en navegadores emulados, QR y controles probados sintéticamente. Ningún medio dependiente del R2 eliminado.

**Google y Resend no se reconfiguran:** los secretos `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY` ya están en `bellaquitas-api-staging`. El Worker de destino tiene una conexión interna Cloudflare Service Binding `PROVIDER_BROKER` que reutiliza el proveedor, protegida con secreto HMAC aleatorio generado en Cloudflare, conservado en ambos Workers y nunca mostrado en chat. Se probaron peticiones firmadas y rechazo de accesos externos; las **credenciales no se duplicaron ni se divulgaron**. No se debe borrar el Worker antiguo que las custodia.

**Integridad de D1 confirmada el 19/11, solo lectura:** 16/16 tablas de perfiles, identidad Google/correo y contenido tienen **filas idénticas** staging ↔ preproducción (23 filas en tablas revisadas); 44/44 objetos esquema iguales y 0 violaciones de claves foráneas. Los seis perfiles de la restauración de origen siguen contenidos en la D1 nueva. Destino: **7 perfiles, 2 administradores, 1.999.998 puntos y 0 visitas**. Las tablas operativas (sesiones y logs de despliegue) no necesitan copiarse.

**Copia independiente cifrada/restaurada:** existe `BELLAQUITAS_D1_COPIA_CIFRADA_2026-11-18.bqbk` (SHA-256 `c4f3e2003329336015d949a3a45f3bf29b7f9c03b5124d358707000be7c4b456`), cifrada AES-256-GCM con clave RSA-3072 separada. **Restaurada de nuevo el 19/11** en SQLite `:memory:`: 22 tablas, 44 objetos, 7 perfiles, 2 admins, 1.999.998 puntos, 0 visitas, `integrity_check=ok`, FK 0. Sin modificar bases reales. El **paquete de recuperación cifrado** `BELLAQUITAS_FASE5_RESPALDO_SEGURO_2026-11-19.zip` fue preparado en el chat con recuperador HTML y manual, **sin clave privada incluida**. La clave PEM se entrega por separado y requiere custodia fuera de ChatGPT.

**Seguridad técnica:** `productionAccessGate` impide publicar si falta `SITE_MODE=production`, `PUBLISH_APPROVED=yes`, `FINAL_ORIGIN_RECONCILED=yes`, `BACKUP_KEY_CUSTODIED=yes`, servicios/Turnstile y proveedores reales. Los hosts finales no pueden mostrar staging si se conectan accidentalmente, CORS queda restringido a origen canónico y la consola exige autenticación. Zona Cloudflare todavía `pending`, Worker `workers.dev` y vistas previas deshabilitadas, sin rutas públicas, sin cambios en Hostinger o `main`.

## 2. Tres requisitos que no se pueden certificar automáticamente

1. **Delta externo del proveedor previo.** La copia de los ocho CSV del 16/11 no demuestra qué sucedió después. Cloudflare staging y destino idénticos NO sustituyen una exportación reciente del origen, un congelamiento probado de escrituras o una reconciliación documental. La instrucción del propietario es no usar Supabase; por tanto no se ha accedido a ese proveedor ni se han atribuido falsamente nuevas cuentas.
2. **Custodia privada y copia antigua.** El respaldo AES del 16/11 y su clave antigua están localizados en Biblioteca, pero el sistema deniega materializar sus bytes originales. Se creó y probó una herramienta de **reenvoltura offline**; no se ejecutó sobre la copia real, y no puede revocar copias ya expuestas. **La clave RSA nueva todavía no consta guardada por el propietario fuera de ChatGPT**. La nueva D1 no es copia nativa de todos los registros de autenticación del antiguo proveedor.
3. **Prueba de sesión Google y correo Resend en origen definitivo.** Service Binding con HMAC, código y despliegue verificados, pero sin poder usar el dominio mientras esté en GitHub Pages y la zona Cloudflare `pending`, aún no se acredita el callback real Google en `https://bellaquitas.fr/v1/auth/google/callback` ni una entrega Resend enviada por el Worker nuevo. Esta comprobación es una puerta de **fase 6** (cambio DNS controlado + test antes de activar rutas públicas); no requiere crear otra cuenta.

Las pruebas físicas del QR, móvil iPhone y los administradores reales quedaron aplazadas **por decisión del propietario** a después de publicar. No deberían interpretarse como pruebas completadas.

## 3. Traspaso operativo a fase 6 (no publicar aún)

- **Paquete de entrega técnica de fase 5:** repositorio, Workers y D1 privados, medios exactos, prueba de restauración y paquete ZIP cifrado separado de su clave.
- **Entrada de fase 6:** autenticar y custodiar fuera de ChatGPT el nuevo respaldo, recuperar o rotar de forma segura el legado cuando se disponga de sus bytes, y certificar delta del proveedor de origen sin usar ese proveedor salvo que la instrucción cambie.
- **DNS, etapa A:** solo tras gates de datos, backup, proveedor y autorización, delegar nameservers conservando todos los A/CNAME/MX/TXT actuales y comprobando que GitHub Pages sigue disponible.
- **DNS, etapa B:** una vez zona Cloudflare `active`, validar Google real, Resend real, Turnstile, cookies, puntos y acceso admin; activar rutas del Worker **solo cuando** los bloqueos de publicación hayan quedado superados. Mantener ruta de reversión y web previa disponible.

**Las puertas `cloudflare/release-gates-2026-11-15.json` permanecen íntegras:** 10/16 controles aprobados y 6 pendientes (4 pruebas personales diferidas, 2 de respaldo). El cierre técnico no equivale a aprobar los controles de publicación. En particular `productionChangesAuthorized=false` y `finalSignoff.explicitProductionAuthorization=false` deben permanecer así; no declarar que se cambió el dominio o que se revocó la clave antigua.

## 4. Instrucción de continuidad

No volver a pedir al propietario crear Google OAuth, Resend, subir medios originales o instalar PowerShell. No fusionar PR #3 ni eliminar el Worker de staging con las credenciales. Completar los requisitos realmente pendientes **una sola vez**, sin reiterar tareas ya resueltas ni falsificar evidencias.
