# Recuperar los 3 logos originales de Bellaquitas Fest sin degradarlos

Estado a 15/11/2026: **los tres objetos se han localizado y verificado por metadatos en Supabase Storage**, pero el conector disponible no permite descargar sus bytes. No se ha sustituido ninguna imagen.

Origen: proyecto `vlsipvngvxcgnwrhpjgg`, bucket público `bellaquitas-media`, carpeta `logos/`.

| Archivo original | Bytes esperados | ETag (32 hex) |
| --- | ---: | --- |
| `705cc152-5de2-407a-a880-1e78ca4b30ea.png` | 904603 | `f82bce49eb067393ec892975fc42ca98` |
| `af5b256c-877b-4c9c-8d36-d00854885c4b.jpg` | 130096 | `e20bd134732bae16a651831d901f1f5e` |
| `f4978ae8-1058-43a7-b5cd-ef9b17c11843.png` | 904603 | `f82bce49eb067393ec892975fc42ca98` |

Los dos PNG comparten tamaño y ETag, lo que sugiere contenido igual, pero **no sustituir uno por el otro sin recuperar primero el objeto**. ETag tiene aspecto de MD5; la comprobación local compara el hash MD5 de cada archivo y los bytes esperados. MD5 no es una firma criptográfica moderna, pero es un control de integridad contra errores accidentales y cambios de versión.

## Descarga original sin recomprimir

En el panel de Supabase, abrir el proyecto Bellaquitas Fest, ir a **Storage → bellaquitas-media → logos**, seleccionar cada uno de esos tres objetos y pulsar **Download**. Es la descarga binaria original, no una captura de pantalla ni una conversión.

Documentación oficial: https://supabase.com/docs/guides/storage/management/download-objects

En la rama `migracion/fase5-segura-20261114`, guardar los tres archivos **con exactamente esos nombres** en:

`assets/migrated-logos/`

No subir claves ni contraseñas al repositorio. No borrar nada de Supabase mientras quede pendiente la conciliación final.

## Validación antes de publicación

Desde la raíz del repositorio:

```sh
node cloudflare/build-static-assets.mjs --require-logos
```

- Verifica tamaño, firma PNG/JPEG y hash ETag/MD5.
- Copia vídeos, imágenes y logos conservando sus bytes, sin reescalarlos.
- Si falta uno, **falla y bloquea el lanzamiento**.
- La salida generada `cloudflare/dist-static/` está ignorada por Git; no se sube como código fuente.

Después habrá que publicar los recursos en un Worker QA con `ASSETS` y comprobar **HTTP Range 206 real**, vídeo en Safari iOS y Android y visualización del logotipo, sin modificar el dominio final.

La validación HTTP simulada en CI es buena, pero NO sustituye la prueba real en un Worker con archivos estáticos publicados.
