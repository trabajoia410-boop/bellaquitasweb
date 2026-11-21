# Bellaquitas Fest — despliegue multimedia QA preparado, publicación pendiente de autorización técnica

**Fecha:** 15/11/2026. **Entorno único de publicación previsto:** `bellaquitas-media-qa.bellaquitas-fest-410.workers.dev`. **No se ejecutó un despliegue de medios porque GitHub Actions carece de un secreto Cloudflare válido.** No se ha cambiado `bellaquitas.fr`, GitHub `main`, DNS, usuarios ni puntos.

## 1. Material disponible y verificado

En la rama de migración se dispone de **20 archivos originales (56.785.619 bytes)**:

- **17 originales del repositorio**, incluidos cinco MP4 sin recomprimir ni modificar.
- **3 logos originales de Supabase**, recuperados y verificados contra tamaños, MD5 histórico y SHA-256 completo.
- El generador `cloudflare/build-static-assets.mjs --require-logos` ha pasado y mantiene los nombres de archivos. El ensayo local `cloudflare/deploy-media-qa.mjs` ha identificado **20 archivos, 5 vídeos, 0 logos pendientes**.

El Worker multimedia de QA existe, está aislado, y **sigue sin binding `ASSETS`**. No se requiere ni se volverá a crear un bucket R2.

## 2. Automatización creada y ejecutada

Workflow exclusivo de la rama segura:

`.github/workflows/deploy-bellaquitas-media-qa.yml`

URL: `https://github.com/trabajoia410-boop/bellaquitasweb/actions/workflows/deploy-bellaquitas-media-qa.yml`

Protecciones activas:

1. Solo en `migracion/fase5-segura-20261114`, nunca `main` o producción.
2. Revalida el inventario y los 3 logos originales.
3. Comprueba expresamente que el corte público está **bloqueado**.
4. La única publicación permitida por el script se llama `bellaquitas-media-qa` y **no incorpora D1 ni R2**.
5. Solo intenta subir con `CLOUDFLARE_API_TOKEN` o `CF_API_TOKEN` disponible como **secreto privado de GitHub Actions**, nunca guardado en un commit o en un log.
6. Tras publicar, ejecuta `node cloudflare/test-media-qa-online.mjs --require-assets`; este modo **falla si no existe ASSETS**, en lugar de considerar un HTTP 503 como éxito.
7. La comprobación estricta exige **HTTP 206** en dos fragmentos (principio y final) de cada uno de los cinco MP4, `Content-Range`, tipo `video/mp4`, bytes comparados con Git, y **los tres logos recuperados por HTTP 200 idénticos en contenido**.

Ejecuciones verificadas en los logs reales de GitHub:

- [Intento QA inicial 43755792863](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43755792863): 20 archivos correctos, pero `CLOUDFLARE_API_TOKEN` ausente; verificación HTTP 206 **omitida**.
- [Intento QA reforzado 43756107886](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43756107886): mismo resultado, sin credencial; pasos locales verdes, **sin subir archivos**, verificación real omitida.
- [QA general 43756112730](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43756112730): éxito.
- [QA de Cloudflare 43756112721](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43756112721): éxito.

**No presentar estos resultados como éxito de reproducción física ni de entrega HTTP 206.**

## 3. Única configuración privada para activar la publicación QA

Este paso requiere que el propietario autorizado actúe directamente en su cuenta, sin enviar claves por ChatGPT:

1. En **Cloudflare → Mi perfil / Account API Tokens**, generar un API token **limitado al account de Bellaquitas** y a la capacidad necesaria para editar Worker Scripts/Assets. No utilizar la Global API Key; conservar el token en el administrador de secretos.
2. Abrir GitHub: `trabajoia410-boop/bellaquitasweb → Settings → Secrets and variables → Actions → New repository secret`.
3. Nombre: `CLOUDFLARE_API_TOKEN`. Valor: token privado del paso 1. **No incluirlo en Git, PR, mensajes, archivos descargables ni comentarios.**
4. En **Actions → Bellaquitas multimedia — desplegar únicamente QA → Run workflow**, seleccionar **`migracion/fase5-segura-20261114`**.
5. Considerar el despliegue correcto únicamente si el paso **“Probar HTTP Range 206 real de los cinco MP4 y sus bytes originales”** termina verde. De lo contrario, el control de release sigue bloqueado. No intentar subir medios a producción.

Referencia oficial: https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/ (el deploy en CI requiere token Cloudflare como secreto del repositorio).

**Alternativa si no se quiere guardar un secreto en GitHub:** desde un ordenador de confianza, usar el script ya existente `cloudflare/deploy-media-qa.mjs --deploy` con `CLOUDFLARE_ACCOUNT_ID` y `CLOUDFLARE_API_TOKEN` configurados **solo en la sesión local del terminal**, seguido de `node cloudflare/test-media-qa-online.mjs --require-assets`. No compartir tokens. Se mantiene destino fijo QA.

## 4. Política de lanzamiento

Mientras falte una prueba HTTP real, siguen bloqueados:

- `originalVideosDeployedToMediaQa=false`.
- `realHttp206AndIosAndroidPlayback=false`.

La prueba HTTP 206 **no sustituye** una prueba física de reproducción en Safari/iPhone y Android. Siguen pendientes además copia externa cifrada de producción con clave nueva, accesos reales de las dos cuentas admin, conciliación final de usuarios, QR físico y revisión ES/FR.

**El entorno de preparación administrativa sigue aislado y sus operaciones mutadoras bloqueadas. No se ha cambiado la web pública.**
