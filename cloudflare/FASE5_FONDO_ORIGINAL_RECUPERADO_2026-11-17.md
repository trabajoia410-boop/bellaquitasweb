# Bellaquitas Fest — imagen original recuperada, desplegada y verificada

**Fecha:** 17 de noviembre de 2026. **Rama:** `migracion/fase5-segura-20261114`. **No se ha publicado en `main` ni cambiado el DNS del dominio.**

## Qué faltaba
El CSS original de Bellaquitas Fest usa `assets/62609.jpg` como fondo lateral del vídeo bajo la banda amarilla. El archivo NO estaba en GitHub ni en el inventario congelado de vídeos, aunque el usuario ya lo había aportado anteriormente. No debía ser sustituido por una foto nueva ni recomprimido.

## Recuperación auténtica realizada
- Recuperado el JPG exacto de los archivos históricos de la Library del propietario.
- Dimensiones: **1536 × 864 píxeles**.
- Tamaño: **41.544 bytes**.
- SHA-256: `8132f61e31fe7a6b008e8af307c51a525e7d19c9cfd83e9ac80ff2553c0bca60`.
- Git blob SHA-1: `65a47c0f9284f7baa4eaacc4b48acd1157cdb363`.
- Transferido de forma privada, comparando el SHA original contra el blob creado. Commit de GitHub `2f1a373407669a11848a426d36e248717f8d045d`; verificado posteriormente el árbol Git y tamaño exacto bajo `assets/62609.jpg`.
- El archivo intermedio de transferencia se eliminó de la Library tras verificar su repositorio; nunca se incluyeron claves, CSV ni datos de usuarios en la transferencia.

## Compilación y despliegue
- `cloudflare/visual-extra-media.js` fija la huella SHA-256 y Git de la imagen auténtica.
- `cloudflare/build-static-assets.mjs` la copia al paquete de medios sin alterar sus bytes. Si desaparece o cambia un solo byte, **el build falla** en lugar de publicar un diseño incompleto.
- `cloudflare/audit-visual-assets.mjs` coteja todas las referencias visuales del CSS/HTML con los recursos disponibles. El bloqueo `visualReady` se levantó **solo** tras verificar que el JPG original realmente existía en GitHub.
- Cloudflare `bellaquitas-api-preproduccion` Static Assets: build `6c7e58a8-653d-4b77-8f9a-4ae8c3f4b083` **SUCCESS**, log `Fondo de vídeo ORIGINAL copiado sin cambiar un byte: 62609.jpg`. **El Worker permanece privado**, sin routes, workers.dev ni claves de Google/Resend.
- Staging: se descubrió que su API aún usaba `VIDEO_QA_PROXY` y no tenía el binding `ASSETS` directo. Se añadió `assets:{directory:"./dist-static",binding:"ASSETS",run_worker_first:true}` y se corrigió el Cloudflare Build Trigger para generar ese directorio antes de `wrangler deploy`. El Worker conserva sus secretos Google/Resend y su D1 sin cambios; el Service Binding QA queda como fallback.
- Cloudflare build staging `984774b1-e5fd-451c-94e0-0a66cc32e71e`: **SUCCESS**, Static Assets directo activado, R2 ausente, usuarios/puntos sin cambios.

## Pruebas reales sin alterar cuentas
- GitHub Actions [QA migración, staging real, run 44068177425, intento corregido](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/44068177425): **SUCCESS** después de desplegar ASSETS y actualizar una comprobación heredada que esperaba `storage="not-configured"`.
- GET HTTPS real de `/espejo/assets/62609.jpg`: **200**, bytes idénticos al original `assets/62609.jpg`. No es una foto inventada, reconstruida ni modificada.
- Cinco vídeos originales: **10 solicitudes reales de rango HTTP 206**, bytes iniciales y finales idénticos al repositorio, sin cookies ni R2.
- HTML/CSS, JS, francés, administración separada `/administracion/`, CSP, cierre de sesiones anónimas y POST denegados: verificados.
- `.github/workflows/bellaquitas-phase5-preflight.yml` comprueba ahora también cambios a imágenes, vídeos, CSS, HTML, traducciones ES/FR, sitemap y robots. No podrá cambiarse un recurso visual sin revalidar seguridad y paridad.

## Estado de datos
La D1 de origen aislado conserva **6 perfiles**. Staging y preproducción conservan **7 perfiles**, de ellos dos administradores; **1.999.998 puntos** y **0 visitas**, sin modificaciones. El séptimo usuario legítimo de email verificado sigue preservado.

## Bloqueos aún existentes, no confundir con la imagen ya resuelta
1. Google OAuth y Resend en **el Worker definitivo**: faltan claves nuevas transferidas de forma privada. Los secretos existentes en staging no son exportables en claro. No crear ni publicar nuevos secretos a través del chat.
2. Rotación **privada fuera del chat** de la clave del respaldo original y seguridad de la recuperación. Los ocho CSV, copia cifrada original y restauración **sí se hicieron**; no repetirlos.
3. Conciliar cambios en el proveedor de origen **posteriores** a los CSV.
4. Activación de la zona DNS Cloudflare y corte reversible **solo después** de esos requisitos y autorización deliberada.
5. Pruebas personales de ambas cuentas admin, iPhone, QR físico y revisión final ES/FR **después de publicar**, como pidió el propietario.

**No cambiar `main`, `bellaquitas.fr`, Hostinger, puntos ni visitas reales. No Supabase/R2 como infraestructura final ni servicios de pago.**
