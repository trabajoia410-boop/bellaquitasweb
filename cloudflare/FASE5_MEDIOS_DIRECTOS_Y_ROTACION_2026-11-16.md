# Bellaquitas Fest — retirada del proxy temporal y preparación de rotación de respaldos

**Fecha:** 16/11/2026. **Ámbito:** exclusivamente Cloudflare staging y rama `migracion/fase5-segura-20261114`. **Controles de lanzamiento:** 10/16; producción bloqueada.

## 1. Espejo multimedia: ya no depende de un proxy GitHub

Antes: `bellaquitas-api-staging` servía `/espejo/assets/*` a través del Service Binding `VIDEO_QA_PROXY` conectado con `bellaquitas-media-proxy-qa` (Worker temporal que recuperaba material de GitHub).

Ahora:
- El mismo binding se conecta al Worker **`bellaquitas-media-qa`**, que contiene los 20 recursos originales publicados como **Workers Static Assets**. No hay R2 ni llamadas al antiguo proxy GitHub en esta ruta.
- `cloudflare/web-mirror.js` usa la URL del Worker de medios permanentes para formar la solicitud interna y **no reenvía cookies, Authorization ni identidad** de quienes navegan.
- Se conserva la restricción de staging: `STAGING_MUTATIONS=disabled`, `ALLOW_NEW_ACCOUNTS=no`, host de pruebas exacto; no se permite convertir este espejo en la web de producción por accidente.
- Se mantiene el mismo diseño original, cinco MP4 y tres logos; el Worker original de medios temporales **no se ha borrado**, pero ya no es el servicio vinculado al espejo.
- Cloudflare Workers Builds **SUCCESS** compilación `536ad894-3c35-4529-ae1e-3e8c7c19cf1c`, API staging versión `c5cfe78a-8c20-463f-b3b6-bf5fad0b7b7d`.
- GitHub Actions [prueba real de espejo y Static Assets](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43808936094) **SUCCESS**: HTML/CSS/FR/JS, cinco vídeos originales, **diez respuestas HTTP 206**, principio y final con bytes exactos, tres recursos de marca idénticos, sin cookies ni R2.
- Las 17 configuraciones/bindings originales se conservaron tras el despliegue, incluidos cinco secretos y D1 staging; `ADMIN_EMAIL_LINK_ENABLED=yes` solo habilita el flujo seguro con acceso administrativo real.
- Existe versión anterior `c608e3e6-2157-43dc-8807-0b6944352458` para rollback.

**Esto mejora la independencia del espejo y cumple la parte técnica del vídeo, pero NO certifica reproducción en un iPhone y Android físicos.** `realHttp206AndIosAndroidPlayback` continúa pendiente de esa prueba.

## 2. Rotación local de una copia cifrada: herramienta funcional

Se añadió `--rotate` a `cloudflare/offsite-d1-backup.mjs`:
- Funciona **solo** con el **formato JSON AES-256-GCM v1** propio de `offsite-d1-backup.mjs`, junto con su clave de 32 bytes en archivo Base64.
- Primero autentica y descifra la copia *en memoria*, después recifra con **clave y nonce aleatorios nuevos**, preserva la etiqueta de origen `cloudflare-d1-staging` o `local-sql-unverified` y la huella SHA-256 del SQL, y vuelve a verificar la copia de destino.
- Guarda la copia nueva y su clave en **dos carpetas diferentes, fuera del repositorio**, con creación sin sobrescritura y permisos restrictivos; **nunca escribe SQL en claro en disco** durante la rotación ni borra la copia/clave anteriores.
- En caso de clave incorrecta o bytes alterados, aborta antes de generar un respaldo nuevo. La prueba sintética verifica que la clave antigua no descifra la nueva copia.
- [QA automática del backup](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43808681874) **SUCCESS**, sin datos personales ni tráfico de red.

Ejemplo ilustrativo para Windows (requiere dos carpetas nuevas distintas y los archivos existentes del formato correcto):

```powershell
node cloudflare/offsite-d1-backup.mjs --rotate "D:\Bellaquitas-Respaldos\copia-vieja.enc.json" "E:\Claves-Bellaquitas\clave-vieja.b64" "D:\Bellaquitas-Respaldos\copia-nueva.enc.json" "E:\Claves-Bellaquitas\clave-nueva.b64"
node cloudflare/offsite-d1-backup.mjs --verify "D:\Bellaquitas-Respaldos\copia-nueva.enc.json" "E:\Claves-Bellaquitas\clave-nueva.b64"
```

**No admite el ZIP de respaldo cifrado con clave privada RSA** de otras versiones. Tampoco recupera la copia original de producción ni comprueba su exhaustividad. Si la antigua clave de producción se compartió previamente, sigue pendiente gestionar la copia/clave antiguas y sustituirlas con acceso legítimo al origen. Nunca escribir contraseñas o claves en GitHub ni en ChatGPT.

## 3. Datos protegidos y estado final

Lecturas reales D1 staging y restauración aislada tras el cambio:
- En cada base: 7 perfiles, 2 administradores, 6 identidades Google y 1 identidad email, 1.999.998 puntos, 0 visitas, 0 errores FK.
- Cero sesiones elevadas de administrador verificadas a esta fecha.
- El dominio `bellaquitas.fr`, GitHub `main`, DNS, puntos, visitas y el diseño público **sin cambios**.
- PR #3 aún en borrador; no se autoriza el corte ni se marca ningún control restante como superado.

### Para desbloquear lo que queda
La prueba física en iPhone/Android, la autenticación real de ambas cuentas, una copia auténtica y restaurada del **origen de producción**, la rotación de la clave histórica y la revisión final ES/FR deben completarse con evidencia correspondiente; no pueden sustituirse con simulaciones.
