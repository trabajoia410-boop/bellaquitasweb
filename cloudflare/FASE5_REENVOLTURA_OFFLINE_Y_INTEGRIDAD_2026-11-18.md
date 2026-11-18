# Bellaquitas Fest — protección offline del respaldo original y control de identidad (18/11/2026)

## Situación encontrada realmente en la Biblioteca
Se han localizado dos archivos persistentes del 16/11/2026:
- `BELLAQUITAS_RESPALDO_CIFRADO_2026-11-16.bqbk` (22.659 bytes), SHA-256 conocido `57b6e0f513fbe76bdc502afe95420fb79d806eae21ba727d525014d00a6ecfcb`.
- `CLAVE_RECUPERACION_BELLAQUITAS_2026-11-16.txt` (180 bytes), clave antigua que en una conversación anterior quedó expuesta.

**No se materializaron**: al solicitar una copia de ambos al entorno de trabajo, el gestor de archivos devolvió `This Project file does not have an authorized raw-byte materialization path`. No se expuso, copió ni imprimió la antigua clave. No marcar la recodificación del respaldo original como terminada.

## Herramienta local creada y comprobada sin PowerShell
Archivo descargable entregado al propietario: `BELLAQUITAS_REENVOLVER_RESPALDO_ANTIGUO_SIN_INSTALAR.html`; además se guardó una versión en su Biblioteca privada. Contiene únicamente código cliente, no contraseñas ni datos reales.

Funciona mediante WebCrypto local, sin CDNs ni peticiones externas; su CSP incluye `connect-src 'none'`. El propietario puede cargar desde su ordenador ambos archivos originales, comprobar **antes de cifrar** que la huella SHA-256 coincide con el respaldo legítimo y generar dos archivos nuevos:
1. Respaldo reenvuelto que contiene original + clave antigua *solo bajo AES-256-GCM nuevo*.
2. Clave de 256 bits aleatoria nueva, guardada en otro archivo. No está incluida en el nuevo respaldo.

La propia herramienta realiza descifrado inmediato y compara los bytes recuperados; también permite, en caso de emergencia, recuperar los archivos heredados del nuevo contenedor. Se validó con Node WebCrypto y datos ficticios: cifrado-descifrado exacto, clave incorrecta rechazada, archivo alterado rechazado, huella del original incorrecta rechazada; 0 llamadas de red.

**Advertencia fundamental:** esto es una *reenvoltura*; no revoca criptográficamente copias antiguas de la clave o del respaldo que ya hayan sido divulgadas. Es necesario eliminar del uso las copias antiguas de los dispositivos del propietario *solo tras verificar y almacenar* la nueva copia y su nueva clave en lugares distintos. Hasta entonces, `exposedBackupKeyRotatedOutOfChat` queda **false**.

## Segundo control independiente: cuentas, privilegios y saldos
Tres D1 consultadas exclusivamente con SELECT (origen restaurado, staging, preproducción):

| Comprobación | Origen recuperado | Staging | Preproducción |
|---|---:|---:|---:|
| Perfiles | 6 | 7 | 7 |
| Administradores | 2 | 2 | 2 |
| Usuarios puerta | 1 | 1 | 1 |
| Socios | 3 | 4 | 4 |
| Google vinculados | 6 | 6 | 6 |
| Email vinculado | 0 | 1 | 1 |
| Email verificado | 0 | 1 | 1 |
| Credenciales email admin | 0 | 0 | 0 |
| Saldos negativos o lifetime menor que saldo | 0 | 0 | 0 |
| Códigos de socio duplicados | 0 | 0 | 0 |
| Identidades sin perfil | 0 | 0 | 0 |
| Credenciales email sin perfil | 0 | 0 | 0 |
| Proveedor-subject duplicado | 0 | 0 | 0 |
| Violaciones FK | 0 | 0 | 0 |

Puntos actuales e históricos en todas: **1.999.998**; visitas: **0**. Esto verifica la integridad *interna* de los tres destinos, no cambios posteriores a los ocho CSV en el proveedor original.

Los dos administradores requieren vincularse de forma segura por Google/recuperación antes de usar correo y contraseña propios; no inventar contraseñas ni cambiar perfiles reales.

## Lo que continúa impidiendo publicar
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` y `RESEND_API_KEY` ausentes del Worker definitivo; en staging hay secretos cifrados sin API de lectura del valor. No crear credenciales Resend mediante el conector si obliga a exhibirlas en el chat.
- La rotación del respaldo original debe ejecutarse localmente cuando el propietario tenga los dos archivos en su ordenador y la clave nueva quede guardada fuera del chat. La nueva copia D1 cifrada/restaurada ya existe, pero no sustituye la copia de identidad nativa del proveedor original.
- La conciliación de actividad del proveedor original posterior al export continúa sin prueba actual; Cloudflare D1 idénticas no garantizan que no haya nuevos socios.
- La zona Cloudflare continúa `pending` sin nameservers activos ni Worker público.
- Pruebas físicas admin/QR/iPhone/ES-FR conforme a decisión del propietario *tras publicar*, pero bloqueos de seguridad previos no se aplazan.

**No usar PowerShell. No publicar, no cambiar main ni Hostinger, no sobrescribir cuentas o puntos.**
