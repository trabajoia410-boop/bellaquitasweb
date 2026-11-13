# Bellaquitas Fest — respaldo y restauración privados (Windows)

**Fase 5 · 13 de noviembre de 2026 · Documento de preparación. Ninguna operación con datos reales ejecutada por ChatGPT.**

## Objetivo

Antes de publicar el panel nuevo, comprobar que podemos recuperar sin pérdidas:
- Perfiles, roles, códigos de socio, puntos disponibles, puntos históricos y visitas.
- Autenticación real de Supabase: usuarios, identidades, sesiones y tokens de refresco.
- Eventos, canjes, ajustes administrativos, contenidos ES/FR y publicaciones.
- Metadatos y **archivos originales** de Supabase Storage.
- La copia aislada de D1 para poder revertir el corte.

**R2 fue eliminado a petición del propietario: no volver a crear ni descargar R2.** Los vídeos y assets fijos originales están en GitHub y se preservan sin recodificar.

## Estado actual

**Programas preparados en rama de auditoría, NO ejecutados sobre los datos reales:**
- `cloudflare/backup_privado_local.py`: exporta Supabase PG, Cloudflare D1 staging y Supabase Storage al **equipo privado**, cifra con GPG AES256, verifica hashes de cada archivo, calcula **9 métricas agregadas PostgreSQL** y una huella SHA-256 por cuenta (id/rol/tarjeta/puntos/visitas) sin publicar sus datos. Compara el estado inicial y final durante la exportación para rechazar cambios detectados.
- `cloudflare/restore_privado_aislado.py`: descifra en el equipo privado, comprueba integridad, restaura en **una DB PostgreSQL local PREEXISTENTE Y VACÍA** y vuelve a calcular 9 métricas **y el SHA-256 por cuenta**, para detectar incluso dos saldos alterados que se compensen en el total.
- `cloudflare/phase6_readiness.py`: no aprobará publicación sin evidencia del respaldo real, restauración aislada, coincidencia de saldos/Auth, inventario completo de Storage y autorización explícita.

No se exportarán datos reales a GitHub, Cloudflare Workers, ChatGPT ni archivos adjuntos. **Nunca facilitar credenciales, contraseñas, archivos .dump o .gpg por este chat.**

## Preparación PRIVADA en Windows

1. Utilizar **un equipo personal controlado por el propietario**, con disco cifrado y suficiente espacio; no usar carpetas sincronizadas de OneDrive, Google Drive, el repositorio Git ni carpetas compartidas para el temporal. Reservar dos ubicaciones privadas para copias cifradas.
2. Instalar herramientas locales compatibles con el servidor: cliente PostgreSQL de **la misma versión mayor** (psql, pg_dump, pg_restore), Python 3, GnuPG, AWS CLI, Node.js y Wrangler. El script comprueba las versiones antes de leer los datos.
3. Configurar **solo en ese equipo** las variables privadas del proyecto Supabase, Cloudflare y Storage. No introducirlas en GitHub Actions, capturas, mensajes, archivos de repo ni en un terminal grabado.
4. Comprobar las herramientas con `python cloudflare/backup_privado_local.py --check`. Cuando la ubicación privada y las credenciales sean válidas, ejecutar en el propio equipo `python cloudflare/backup_privado_local.py --run`. **El programa pide confirmar RESPALDAR** y la frase de cifrado GPG de forma local; guarda `bellaquitas-...tar.gz.gpg` fuera del proyecto.
5. Comprobar el cifrado y todos los SHA-256 sin conectarse a producción: `python cloudflare/backup_privado_local.py --verify "RUTA_PRIVADA\\bellaquitas-...tar.gz.gpg"`. Mantener una **segunda copia cifrada**, en un dispositivo independiente verificado.

**Atención:** el script puede detectar que alguna herramienta/S3 export no está configurado o que el dump PostgreSQL no incluye tablas necesarias. En ese caso **falla y no da por válido el respaldo**. No forzar la aprobación.

## Ensayo de restauración real, en una PostgreSQL LOCAL aislada

1. Instalar y comprobar una PostgreSQL **local**, sin túneles SSH ni conexiones a Supabase. El destino debe ser una base **nueva, vacía y preexistente**, con nombre `bellaquitas_restore_...`; jamás la base real `postgres` o `bellaquitas-staging`.
2. Crear un usuario local dedicado `bellaquitas_restore` **sin SUPERUSER, CREATEDB ni CREATEROLE**; debe poder crear objetos en la nueva DB local, y no tener acceso a servicios remotos.
3. Configurar en ese equipo las variables:
   - `BELLAQUITAS_RESTORE_LOCAL_ONLY=yes`.
   - `PGHOST=127.0.0.1`, `PGPORT=5432`, `PGSSLMODE=disable`.
   - `PGUSER=bellaquitas_restore`, `PGDATABASE=bellaquitas_restore_...`, y una contraseña **solo local** en `PGPASSWORD`.
4. Comprobar **sin leer el respaldo ni abrir conexión**: `python cloudflare/restore_privado_aislado.py --check`.
5. Ejecutar **presencialmente** `python cloudflare/restore_privado_aislado.py --run "RUTA_PRIVADA\\bellaquitas-...tar.gz.gpg"`. Exige escribir `RESTAURAR_EN_LOCAL`. No crea ni elimina bases. Rechaza destinos con tablas, usuario privilegiado, nombres inesperados, CI o host remoto.
6. El restaurador comprueba de nuevo los **perfiles, admin, puntos, puntos históricos, visitas, Auth users/identities/sessions y Storage objects**. Una sola diferencia bloquea la validación.
7. El resultado queda exclusivamente en la **base de datos local**, que contiene datos sensibles y debe eliminarse de forma segura **por el propietario**, una vez concluidas las comprobaciones y conservada la evidencia no sensible.

**Limitación real:** algunos dumps del esquema Supabase necesitan roles, extensiones y funciones específicos. Si un PostgreSQL local normal no es compatible, `pg_restore` fallará. Eso NO significa que la copia sea inválida, pero **no cuenta como restauración completada**. Se necesitará un entorno de prueba local de Supabase compatible, separado de producción y sin coste adicional, antes de aprobar fase 6. No conceder permisos de superusuario al restaurador como atajo.

## Evidencia que puede compartirse sin revelar secretos

Únicamente: fecha de respaldo, confirmación de que la restauración local pasó, código de salida, **recuentos agregados** y hash SHA-256 del *archivo cifrado* (no nombres de socios, UUID, emails, tarjetas ni códigos QR); no entregar archivos privados ni capturas con contraseñas. La fase 6 necesita que todas las evidencias correspondan a pruebas reales recientes, no simuladas.

## Tests con datos sintéticos ya aprobados

- [Respaldo cifrado, prohibición de restaurar en producción y cotejo de nueve métricas](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43491332209)
- [Restauración PostgreSQL ficticia (18 tablas, versiones 16 y 17) y detección de un punto alterado](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43491556194)

**No equivalen a una copia ni restauración auténtica.** Por ello, la migración sigue en **fase 5 de 6**, sin cambios de DNS, `main`, saldo/visitas o contratación de planes.


## Protección adicional contra copias inconsistentes

El archivo GPG incorpora las métricas de perfiles/Auth y una huella SHA-256 de **las filas individuales** de `public.profiles`. Durante el respaldo se calculan al inicio y al final; si cambian, el proceso **falla y no entrega una copia aprobada**. Después de restaurar, la huella se vuelve a calcular en el PostgreSQL local y debe coincidir con la original. **Los datos individuales se procesan en memoria local; la huella se guarda dentro del GPG cifrado, no en GitHub.**

**Límite importante:** dos lecturas antes y después no forman una transacción común con `pg_dump`, la exportación de D1 y la descarga de S3. Un cambio que ocurra y luego se revierta entre lecturas podría escapar a la detección. Esto es un refuerzo, **no una garantía de instantánea atómica**. La restauración aislada real, comprobación de integridad y procedimiento de corte sin escrituras conflictivas siguen siendo imprescindibles. Nunca suspender el sitio ni bloquear los puntos reales sin autorización.
