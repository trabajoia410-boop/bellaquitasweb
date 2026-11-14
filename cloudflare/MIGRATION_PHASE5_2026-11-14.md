# Bellaquitas Fest — Fase 5, 14 noviembre 2026

**Rama de migración. Producción no modificada. No usar Supabase ni R2 en el nuevo despliegue.**

## 1. Restauración íntegra en Cloudflare D1 (entorno de preparación)
- Origen: bellaquitas-staging; D1 ID c7ada9c9-d397-4e22-b5b8-3fbd8d13e550.
- Restauración EU: bellaquitas-restore-isolated-20261114; D1 ID c24ca79d-0602-47b7-94f1-2cfcbd4d4a40.
- 20 tablas, 13 índices, 5 disparadores, 44 filas de datos.
- SHA-256 de todas las filas de las 20 tablas: idéntico entre origen y copia.
- 7 perfiles, 2 admins, 1 puerta, 4 socios; 1.999.998 puntos, 0 visitas, 2 movimientos y 3 cambios administrativos.
- Integridad de FK: ningún error. El origen permaneció sin modificar.

## 2. Respaldo SQL cifrado (distinto de la restauración)
- Bóveda EU: bellaquitas-encrypted-backups-20261114, D1 ID 3eef555d-7a56-4d42-bca3-e88eb57cb37b.
- Tabla: encrypted_archives. Archivo lógico: staging-full-20261114-01.
- SQL reconstruido a partir del esquema y los registros de staging, en orden apto para restauración.
- GZIP + AES-256-GCM con IV de 12 bytes. SQL original: 30.134 bytes; cifrado: 6.829 bytes.
- SHA-256 del SQL: 1f554b1e37c8d43ba45efae4cf767ef2d5a9936cd0ce5521c662460ab6831ec6.
- Comprobada recuperación de ciphertext persistido y verificación posterior de SHA-256 y longitud.
- La clave NO se ha guardado en Cloudflare ni GitHub. Guárdala fuera de ambos.
- Sigue faltando una copia cifrada descargada fuera de la cuenta Cloudflare, indispensable para recuperación de pérdida de cuenta.

### Exportar ciphertext y descifrarlo
1. Cloudflare > D1 > bellaquitas-encrypted-backups-20261114 > Consola SQL.
2. Consulta de solo lectura:
   SELECT id,algorithm,iv_base64,ciphertext_base64,plaintext_sha256,plaintext_bytes FROM encrypted_archives WHERE id='staging-full-20261114-01';
3. Guardar la fila como JSON local; no incluir la clave en el JSON.
4. Definir localmente la variable BF_BACKUP_KEY usando la clave proporcionada al propietario.
5. Ejecutar Node.js 22: node cloudflare/recover-backup.mjs ARCHIVO_CIFRADO.json SALIDA.sql.
6. Proteger el SQL descifrado o borrarlo después de restaurarlo: contiene registros de usuarios y credenciales derivadas.

## 3. Autenticación de administradores
- Dos administradores asociados a Google y dos sesiones admin activas al consultarlo.
- Ninguno de esos dos perfiles tiene todavía credencial de email/contraseña en D1.
- Panel en /administracion/ dentro del Worker del branch; el espejo abre panel y editor en nueva pestaña.
- La consola comprueba sesión y rol por API; el servidor valida todos los permisos.
- Las sesiones admin emitidas por la rama duran 12 horas; cookies con Secure, HttpOnly, SameSite=Lax y prefijo __Host-.
- El login por correo está preparado, pero **no puede funcionar para las dos cuentas admin existentes** hasta realizar vinculación de correo con verificación. No crear cuentas admin duplicadas.
- No se ha completado login interactivo de las dos cuentas. Falta que cada administrador pruebe el acceso real.

## 4. Editar web, eventos, socios y premios
- Consola independiente creada; edición de portada con vista previa, formularios de eventos, socios y recompensas.
- La edición integral tipo WordPress (clic en todos los elementos, multimedia y cambios estructurales) sigue pendiente.
- Las mutaciones siguen bloqueadas por STAGING_MUTATIONS=disabled (HTTP 423) hasta ensayos aislados.
- Las escrituras de socios requieren rol admin y motivo auditado. Las fotos/subidas/borrados no migrados están bloqueados.

## 5. Sustitución de R2 por Workers Static Assets
- Todo el catálogo del sitio está en GitHub con manifest de tamaño y Git blob SHA-1.
- El mayor MP4 pesa 25.437.525 bytes, menos que el límite de 25 MiB (=26.214.400 bytes).
- Las rutas de medios del espejo usan env.ASSETS en esta rama; ya no llaman a env.MEDIA.
- Subidas y borrados que dependían de R2 quedan desactivados hasta tener una alternativa gratuita verificada.
- Los logos de ID antiguos (3 imágenes) aún necesitan sus archivos originales exactos en assets/migrated-logos; NUNCA inventar equivalencias visuales.
- Staging tiene 0 fotos y 0 álbumes, pero eso no prueba que no existan otros medios fuera de la base.
- Los archivos binarios NO están aún desplegados en Workers Static Assets; las URL solo están preparadas.
- Comprobar reproducción y Range requests en iPhone/Samsung después del despliegue de prueba.

## 6. Bloqueos antes del corte
1. Backup final de producción más delta de usuarios y puntos; no usar Supabase para esta fase.
2. Verificar los dos logins admin reales y, si se desea email/password, vinculación y prueba verificada.
3. Subir sin recomprimir los assets y logos exactos y pasar hash/tamaño/visual/Safari.
4. Pruebas de QR, puntos, puerta, canjes y auditoría con perfiles ficticios sobre copia aislada.
5. Confirmar límites Free (100.000 invocaciones Worker/día, D1 Free: 10 bases, Asset individual: 25 MiB).
6. Reconciliación final y plan reversible; mantener DNS, producción y usuarios sin cambios hasta validar.

**No hacer despliegue ni cambio DNS mientras quede algún bloqueo.**
