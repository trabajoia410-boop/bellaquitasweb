# Bellaquitas Fest — restauración aislada del origen (16-11-2026)

## Fuente verificada
Se inspeccionaron ocho exportaciones CSV de la base original: 12 tablas públicas (81 columnas), seis usuarios, seis perfiles y seis identidades Google. Los seis IDs de usuario coinciden en las tres exportaciones. Se compararon los registros de origen con la base existente `bellaquitas-staging` **campo por campo**, incluidos JSON y vínculos de proveedor; no hubo diferencias.

## Restauración
- Base D1 aislada en jurisdicción EU: `bellaquitas-origen-recuperacion-20261116`, ID `2642aff7-11da-4dc6-b359-9bc9417eda31`.
- Se copiaron desde staging **solo los seis perfiles originales** (excluyendo el séptimo perfil de pruebas), los seis enlaces de Google y los 14 registros públicos de las 12 tablas.
- La restauración aislada coincide **campo por campo** con esos registros verificados, incluidas las seis tablas vacías.
- Dos administradores, un usuario puerta y tres socios; 1.999.998 puntos actuales y 1.999.998 históricos; cero visitas.
- Estructura de aplicación clonada: 22 tablas, 17 índices, cinco triggers; una tabla adicional, vacía, para mapeo legado de correos.
- Verificación SQL sin referencias huérfanas: identidad, actividad y cambios de socios, todos con resultado cero.
- La API D1 rechazó `PRAGMA integrity_check` remoto (`SQLITE_AUTH`), por lo que se usaron verificaciones SQL de correspondencia, conteos y claves foráneas por joins. Una restauración SQLite **local** sí pasó `integrity_check` y `foreign_key_check`.

## Respaldo fuera del repositorio
- Se generó un archivo offline cifrado AES-256-GCM con ocho CSV, un manifiesto de hashes SHA-256, restauración SQLite y script SQL local.
- **Nunca** subir al repositorio los CSV personales, el archivo descifrado, las claves ni las cuentas del usuario.
- SHA-256 del archivo cifrado: `57b6e0f513fbe76bdc502afe95420fb79d806eae21ba727d525014d00a6ecfcb`.

## Pendiente antes de producción
1. Verificar por separado credenciales reales y sesión persistente de ambos administradores. Los CSV **no contienen contraseñas** y no autorizan dar por migradas las claves.
2. Conservar mapeo de correos originales en el backup offline: **no** se importó a la D1 aislada; solo seis enlaces Google.
3. Verificar videos/imágenes: los CSV no contienen los archivos multimedia binarios.
4. Validar compatibilidad visual ES/FR, iPhone, QR real y funcionamiento del panel.
5. Reconciliar cambios posteriores a la fecha de exportación y revisar la copia de seguridad y su custodia fuera del chat.
6. No cambiar `main`, producción, DNS ni `bellaquitas.fr` hasta superar los gates.

D1 Free soporta diez bases por cuenta, según documentación de Cloudflare actualizada en octubre 2026. Con esta nueva base existen seis D1 en la cuenta. La infraestructura permanece dentro de los límites de número de bases, sin garantías ante límites diarios futuros. No se empleó R2 ni se modificó Supabase.