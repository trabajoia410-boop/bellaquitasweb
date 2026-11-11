# Código desplegado de `bellaquitas-api-staging` — captura de recuperación

**Fecha:** 11 de noviembre de 2026. **Destino:** rama aislada `auditoria/fase5-2026-11-11`.  
**Propósito:** preservar el código de Cloudflare en funcionamiento para evitar regresar accidentalmente a módulos antiguos del repositorio.

## Inventario

- `modules.json`: 15 módulos de código del Worker (objeto JSON `modules`, clave = nombre del archivo JS).
- `mirror-snapshot.js`: fotografía del código HTML, CSS, traducciones y librerías QR usado por el espejo.
- `preview-jsqr-lib.js`: biblioteca de escaneado utilizada por la vista de pruebas.
- **Total: 17 módulos recuperados y verificados como archivos guardados en GitHub.**

Esta copia procede directamente de la descarga del Worker actualmente desplegado, no de los archivos antiguos de `main`.

**No contiene los secretos del Worker**, sus valores de configuración en Cloudflare, los objetos multimedia de R2, ni una copia de la base D1 o Supabase. El código se guarda en un repositorio GitHub **público**: no añadir claves secretas a esta carpeta ni a `config.js`.

## Extraer el código a archivos separados (uso local, no despliega)

```bash
node cloudflare/staging-source-2026-11-11/extract-modules.mjs
```

Crea los archivos bajo `cloudflare/staging-source-2026-11-11/recovered-src/`. Este paso solo escribe archivos locales.

## Recuperación y desplegado: precauciones

1. **NO publicar ni aplicar esta rama a producción automáticamente.**
2. La restauración de un Worker exige comprobar primero los bindings, secretos, rutas, D1, R2 y las versiones de despliegue existentes.
3. No restablecer datos de Supabase o Cloudflare sin respaldo privado y comprobación diferencial de puntos/visitas.
4. Validar las pruebas de `cloudflare/test-staging-api.mjs` y `cloudflare/test-staging-media.mjs` antes de cualquier cambio de tráfico.
5. Mantener `STAGING_MUTATIONS=disabled` hasta disponer de cuentas de ensayo separadas.
