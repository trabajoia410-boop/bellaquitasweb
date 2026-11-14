# Copia cifrada y restauración local de Bellaquitas Fest desde Cloudflare D1

**14/11/2026 · solo Cloudflare + GitHub · Windows · fase 5 (prepublicación)**

Este procedimiento **no consulta ni utiliza Supabase**. El origen es exclusivamente la copia D1 `bellaquitas-staging`, ya existente en Cloudflare. La web pública permanece intacta. El archivo cifrado es PRIVADO, contiene datos reales de socios y **jamás debe subirse a GitHub ni enviarse por chat**.

## Qué está preparado

- `backup_d1_solo.py`: exporta **solo** Cloudflare D1 staging con `wrangler d1 export --remote`, configura siempre el ID correcto y confirma 6 vinculaciones Google y 2 administradores.
- Comprueba los recuentos de perfiles, saldos de puntos, puntos históricos, visitas, eventos, premios, canjes y huellas SHA-256 de cada perfil. Falla si faltan tablas/identidades o el SQL es inválido.
- GPG AES256 cifra el resultado **en el equipo del propietario**, sin publicar claves.
- `--verify` comprueba SHA-256, roles, cuentas y saldos tras descifrar en temporal local.
- `--restore-local` restaura en un archivo **SQLite NUEVO** y vuelve a comparar los totales y las huellas. **No crea ni actualiza bases Cloudflare**.
- `wrangler.backup.toml` fija la única base permitida: `bellaquitas-staging` (`c7ada9c9-d397-4e22-b5b8-3fbd8d13e550`), jurisdicción UE, sin R2 ni rutas web.

## Preparación en Windows

1. Abre PowerShell en una carpeta local privada y clona/descarga únicamente la rama de prueba `auditoria/fase5-2026-11-11` del repositorio Bellaquitas Fest. No editar `main`.
2. Instala **Python 3.11+**, Node.js y **Wrangler**, además de GnuPG gratuito (`gpg`). Comprueba que `python`, `wrangler` y `gpg` estén disponibles en tu terminal.
3. Prepara una carpeta privada fuera de `bellaquitasweb`, Git, Dropbox, Google Drive y OneDrive, preferiblemente en una unidad cifrada. Configura `BELLAQUITAS_BACKUP_DIR` con esa ruta **solo en tu equipo**.
4. Crea un token Cloudflare con permisos mínimos para **leer/exportar D1**, limitado a tu cuenta, e introdúcelo de forma segura en la variable local `CLOUDFLARE_API_TOKEN`; **no lo escribas en este chat, GitHub, un fichero de código o una captura**. Revócalo después de hacer el respaldo.

### Comprobación segura SIN conexión, antes de introducir credenciales

```powershell
python cloudflare/backup_d1_solo.py --check
python cloudflare/backup_d1_solo.py --self-test
```

### Exportación auténtica — solo cuando tengas el equipo y el token preparados

```powershell
python cloudflare/backup_d1_solo.py --run
```

El script exige escribir `COPIA_D1_LOCAL` en la consola, exporta la base de prueba y solicita la contraseña de cifrado **a GPG local**. Al terminar guarda un archivo `bellaquitas-d1-AAAAMMDDTHHMMSSZ.tar.gz.gpg` y su `.sha256` en el directorio privado. **Sin ese archivo, no hay copia real completada.**

Para validarlo (sustituye la ruta de ejemplo por la de tu equipo):

```powershell
python cloudflare/backup_d1_solo.py --verify "D:\PrivadoBellaquitas\bellaquitas-d1-ARCHIVO.tar.gz.gpg"
```

Copia el archivo **cifrado** a otro soporte privado y verifica de nuevo antes de desconectar servicios.

### Restauración auténtica local — sin Cloudflare remoto

```powershell
python cloudflare/backup_d1_solo.py --restore-local "D:\PrivadoBellaquitas\bellaquitas-d1-ARCHIVO.tar.gz.gpg" "D:\PrivadoBellaquitas\restauracion-nueva.sqlite"
```

El destino `.sqlite` **no debe existir**. El programa solicita `RESTAURAR_SOLO_LOCAL`, crea la DB local, calcula huellas y confirma si coinciden perfiles, Google y puntos. Esta base SQLite local contiene datos confidenciales: mantenla en la unidad cifrada y elimínala de forma segura al concluir las comprobaciones.

**Esta prueba local NO instala la nueva API ni modifica producción**. Antes del corte queda completar las migraciones de esquema D1, probar Google con cuentas auténticas, adaptar la web pública, transferir medios fuera del almacenamiento anterior y configurar dominio/rutas de forma reversible.

## Resultado ya comprobado, únicamente con datos inventados

- [Prueba local de backup D1 sin proveedores externos](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43559502335).
- [SSO Google OAuth + D1, panel sin segundo login](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43559062444).
- [Candado de publicación D1-only](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43559754391).

**No envíes ningún archivo SQL, SQLite, GPG, clave, token ni captura de credenciales por chat.** Basta confirmar en palabras que el script ha terminado y que la restauración local ha dado OK. El dueño debe autorizar expresamente cualquier cambio posterior a la web oficial.
