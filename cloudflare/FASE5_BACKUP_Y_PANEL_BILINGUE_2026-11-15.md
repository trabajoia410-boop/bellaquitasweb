# Bellaquitas Fest — fase 5, recuperación cifrada de staging y panel ES/FR
**Fecha:** 15 de noviembre de 2026. **Ámbito:** Cloudflare de pruebas, GitHub rama de migración y un entorno temporal de recuperación externo a Cloudflare. **Sin escritura sobre puntos, visitas, credenciales o bases de producción.**

## Comprobación íntegra de origen y restauración D1

Se compararon por lectura real las bases D1 `bellaquitas-staging` y `bellaquitas-restore-postadmin-20261115`:
- 22 tablas, 44 objetos del esquema, **44 filas iguales campo por campo**.
- 7 perfiles, 2 administradores, 1.999.998 puntos, 0 visitas en ambas.
- `PRAGMA foreign_key_check`: cero errores en ambas.
- Sin diferencias de esquemas, índices o triggers. La restauración está aislada, sin Worker vinculado.

La prueba de `PRAGMA integrity_check` sobre Cloudflare D1 no se considera realizada si la API lo rechaza; no confundirla con la prueba de SQLite local descrita a continuación.

## Copia lógica cifrada de staging, separada de Cloudflare

La API D1 oficial produjo un enlace de exportación SQL que respondió HTTP 403 al intentar descargar desde el ejecutor conectado. **Por ello NO existe una exportación SQL oficial descargada de D1 por ese mecanismo**.

Se obtuvo una copia lógica mediante consultas `SELECT` autorizadas a la D1 de preparación: definiciones de 44 objetos (`sqlite_master`) y todas las filas de 22 tablas (44 registros), sin mostrar datos personales en el registro de trabajo.

Para cada sección (`schema` y `rows`) se utilizó:
- Compresión `gzip`.
- Una clave aleatoria AES-256-GCM, nonce de 12 bytes y etiqueta AAD ligada al tipo de copia.
- Clave AES envuelta con una **nueva clave pública RSA-3072 OAEP/SHA256**; la clave privada se creó localmente, fuera del repositorio.
- Huella SHA-256 de los bytes descifrados y enlace entre esquema/datos por SHA-256 del esquema.
- Los archivos cifrados y herramienta de recuperación se empaquetaron en un ZIP de ChatGPT; **la clave privada está en otro ZIP, por separado**. Ninguno fue comprometido en GitHub ni Cloudflare y ninguna clave apareció en un commit.

Copia cifrada (nombre de entrega): `bellaquitas-d1-staging-respaldo-cifrado-20261115.zip`.
Clave separada: `bellaquitas-d1-staging-clave-privada-20261115.zip`.

SHA-256 del ZIP de datos: `9426e1cd5d5f782ada65018aebc03ee6472e0fcf2b0c14332420a646872a1504`.
SHA-256 del ZIP de clave: `49f4aec9e35b2808a5f5f693dd198238a343027ca0c07b1107b205a1b70b5bfc`.

Se realizó **descifrado autenticado y restauración en SQLite RAM**, con:
- 22 tablas, 44 objetos, 44 registros, 7 perfiles, 2 administradores.
- 1.999.998 puntos y 0 visitas.
- `PRAGMA integrity_check = ok`; cero errores de claves foráneas.
- No se dejó una copia SQL o SQLite en claro como archivo final.

**Límite crítico:** la copia es de `bellaquitas-staging`, **no** del origen de producción, no incluye medios ni configuración externa y no sustituye una exportación nativa de producción. Es una fotografía puntual: las altas o cambios posteriores exigen una copia nueva. El ZIP alojado temporalmente en la conversación no constituye por sí mismo un respaldo duradero: el propietario debe descargarlo y guardarlo, separando la clave. No marcar `productionDatabaseBackupConfirmed` ni `exposedBackupKeyRotatedOutOfChat` como aprobados.

## Admin ES/FR y vista visual de pruebas

Se incluyó selector ES/FR y traducciones de las etiquetas estáticas, formularios y estados literales de `cloudflare/admin-console.js` (75 entradas); se protegieron nombres, números, campos de formulario y contenido de socios contra cambios por traducción.

La prueba `cloudflare/test-admin-console.mjs` ahora exige la cobertura de todas las etiquetas estáticas y de los avisos en el código administrativo, además de compilar los scripts con `node:vm`. `cloudflare/test-admin-i18n-browser.mjs` prueba Chromium móvil y escritorio de manera completamente simulada, sin hacer POST ni usar credenciales.

Se actualizó **únicamente** el Worker sin bindings `bellaquitas-admin-visual-preview` con el HTML bilingüe desde la rama, manteniendo un aviso de modo demostración, los formularios de credenciales deshabilitados y una API falsa sin acceso. No se desplegó el nuevo código de administración en `bellaquitas-api-staging` ni en el dominio público.

- URL visual: https://bellaquitas-admin-visual-preview.bellaquitas-fest-410.workers.dev/administracion/
- [Prueba HTTP sin autenticación, segunda ejecución correcta](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43768968162)
- [QA general correcta después de añadir cobertura estática de traducciones](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43770519970)

## Situación de lanzamiento

La PR #3 continúa en borrador, `main`, DNS y `bellaquitas.fr` sin cambiar. Siguen pendientes:
1. Copia de seguridad **auténtica de producción**, cifrada fuera de Cloudflare y restaurada, más rotación de clave histórica comprometida.
2. Acceso y reautenticación de **ambas cuentas reales** del administrador.
3. Publicación permanente de los MP4 sin proxy transitorio, pruebas físicas iPhone/Android y lector QR.
4. Conciliación final de todos los perfiles (incluido el socio con credenciales solo en staging) y traducción exhaustiva.
5. Cambio DNS únicamente después del control final de lanzamiento y un rollback demostrado.

**No cambiar a producción basándose en un respaldo de staging.**
