# Bellaquitas Fest — publicación de medios SOLO en Worker QA (15/11/2026)

## Estado

Worker creado y accesible:

`https://bellaquitas-media-qa.bellaquitas-fest-410.workers.dev/health`

- **No contiene archivos MP4 todavía.** Cloudflare API confirma 0 bindings y ninguna vinculación `ASSETS`.
- El Worker no tiene Supabase, D1, R2, Google, email, puntos, visitas ni secretos.
- Es independiente de `bellaquitas.fr` y de los Workers `bellaquitas-api-staging` y `bellaquitas-api-qa`.
- Solo permite `GET`/`HEAD` de nombres de archivos enumerados, contesta `405` a escrituras, y `503` cuando un medio no está desplegado.
- Se mantienen `noindex`, `nosniff` y ausencia de cookies.

## Lo que ya funciona

1. `node cloudflare/build-static-assets.mjs` verifica y copia los 17 archivos originales de Git (5 MP4) sin transcodificarlos.
2. `node cloudflare/deploy-media-qa.mjs` genera el manifest de Static Assets con SHA-256 truncado a 16 bytes (32 hex), tamaño y MIME; es **solo dry-run**, no requiere token ni red.
3. `node cloudflare/test-media-qa-deploy.mjs` comprueba por código que los 17 archivos son íntegros, el modo dry-run no cambia producción y el Worker conserva los rangos/bytes.
4. `node cloudflare/test-media-qa-online.mjs` comprueba el Worker **REAL**: mientras falten assets debe devolver `503`; al instalarse, cambia automáticamente a exigir `HEAD 200` de los cinco MP4 y **HTTP Range 206 real** para principio y final de cada uno, comparando los fragmentos con los bytes originales de Git.
5. `node cloudflare/check-release-gates.mjs --require-release` termina con error hasta que haya pruebas reales y autorización de publicación. `--assert-blocked` verifica el bloqueo en CI.

### Subida real a Cloudflare (QA, no producción)

No se ha ejecutado: GitHub conectado no proporciona el contenido binario de MP4 grandes a través del conector, y no se deben publicar credenciales en el chat ni en la rama.

El comando preparado es:

```sh
# Desde el repositorio descargado en la computadora del propietario,
# donde Git ya proporciona los MP4 originales:
node cloudflare/build-static-assets.mjs
node cloudflare/deploy-media-qa.mjs

# Solo cuando el administrador haya establecido credenciales Cloudflare en su terminal:
# export CLOUDFLARE_ACCOUNT_ID=...  (en Windows usar $env:...)
# export CLOUDFLARE_API_TOKEN=...   (nunca enviar token por chat ni subirlo a Git)
node cloudflare/deploy-media-qa.mjs --deploy

# Verificar que el Worker devuelve 206 y los bytes reales coinciden:
node cloudflare/test-media-qa-online.mjs
```

El proceso `--deploy` utiliza el flujo oficial `assets-upload-session` → `assets/upload?base64=true` → `PUT workers/scripts/bellaquitas-media-qa` y **no acepta cambiar el nombre del Worker** ni el dominio. La autorización de GitHub/Supabase/Google no se utiliza. El token debe ser de mínimos permisos y guardarse solo en el entorno del propietario.

**Cloudflare Workers Static Assets Free:** límite de 25 MiB por archivo y 20.000 archivos por versión. Los 17 ficheros del inventario están dentro de esos límites (el mayor MP4 pesa 25.437.525 bytes, menor que 26.214.400). No se han contratado servicios de pago.

## Falta para dar por bueno el vídeo

- Los 3 logos históricos de Supabase Storage: registrados por tamaño y ETag; **los bytes aún no se han descargado**. Los test QA pueden usar únicamente los 17 recursos Git ya disponibles, pero **la web definitiva NO**.
- Probar la entrega de vídeo *real* con status `206` antes de afirmar compatibilidad iPhone.
- Ensayo físico en iPhone Safari y Samsung/Android; ver el vídeo superior e inferior, encuadres, banda amarilla intacta.
- Confirmar que el origen que finalmente sirve `/espejo/assets/` queda conectado a los `ASSETS`, ya que el nuevo Worker de medios es un destino **independiente** y no hace que el espejo funcional reproduzca vídeos automáticamente.
- Comparar ES/FR, diseño, logs, y verificar que ninguna sesión real ni puntos cambian.

**Importantísimo:** no fusionar PR #3 ni actualizar DNS antes de cumplir `release-gates-2026-11-15.json` y verificar el respaldo de producción. Todos los bloqueos siguen registrados.
