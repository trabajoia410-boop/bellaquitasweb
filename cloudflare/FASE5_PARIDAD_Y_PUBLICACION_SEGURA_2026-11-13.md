# Bellaquitas Fest — fase 5: integridad de la web pública y protección de QA

**13 de noviembre de 2026 · Solo rama `auditoria/fase5-2026-11-11` · SIN publicar migración**

## Comprobación real GitHub: web y vídeos idénticos

Se comparó el árbol de los blobs Git originales de **main** en el commit inmutable `aafb4de85a204cdb79b281815df5819417e7d9c6` con la rama de auditoría:

- **19 de 19 archivos de `assets/`** siguen byte a byte iguales (SHA-1 Git).
- **Los 5 MP4 originales** siguen idénticos, sin recodificación, reducción de calidad ni cambios de nombres, incluido `Bellaquitas Fest para móvil.mp4`.
- `index.html`, `styles.css`, `config.js`, `locale-fr.js` y todos los archivos públicos ajenos a `app.js` siguen idénticos y no se han creado ni eliminado ficheros en esas rutas.
- El único archivo público intencionalmente distinto es `app.js`: 13 líneas añadidas/cambiadas y 11 eliminadas/cambiadas para abrir el panel en nueva pestaña, redirigir rutas administrativas antiguas y mantener la cuenta en la web. Versión original Git blob `b162f4b7f3983e9e4f360848bcf2583b4269bdb5`, versión aprobada de auditoría `55a540907c9d126bdfd0122d7ce68a41a0b28402`. **La versión modificada NO está en main**.
- Esta comprobación no equivale a una prueba física de todos los navegadores ni a probar el nuevo panel en el dominio; esas pruebas siguen pendientes de fase 5/6.

## Prueba automática nueva: `verify_immutable_public.py`

El comprobador reconstruye los hashes desde Git (NO descarga ni modifica multimedia), compara todos los archivos públicos del commit main original con la rama de auditoría y rechaza:
- Cualquier vídeo, imagen, logo, archivo de idioma, HTML, CSS, configuración o recurso público añadido, eliminado o modificado.
- Un cambio de `app.js` sin actualizar conscientemente el SHA-1 fijado tras revisión explícita.
- La rama equivocada o falta del commit original.
- Un flujo QA que obtenga `contents: write` o incluya `git push`.
- Un importador histórico con permisos de escritura que pudiera ejecutarse en la rama auditada.

Se corrigió un detalle importante de nombres internacionales: `git ls-tree -z` preserva archivos con caracteres acentuados y espacios, como `móvil.mp4`; sin `-z`, Git puede escapar la ruta y el inventario fallaba falsamente.

**QA aprobada**: https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43510698131

La revisión se ejecuta desde `.github/workflows/qa-immutable-public.yml` con permisos `contents: read`, sin claves ni pagos, y `fetch-depth: 0`. El antiguo workflow de importación del logo fue **restringido únicamente en la rama de auditoría** a `main`, tanto para eventos push como para ejecución del job; **no se modificó su versión del `main` oficial**.

## Candado de fase 6 reforzado

La suite `phase6_readiness.py` exige pruebas verídicas:
- `reconciliation.original_public_files_sha_verified`: hashes originales intactos.
- `reconciliation.admin_ui_diff_explicitly_reviewed`: diferencias de la interfaz revisadas.
- `reconciliation.audit_workflows_no_publish_verified`: QA sin rutas de publicación accidental.

La evidencia sintética solo prueba que el candado rechaza casillas faltantes; nunca se marcarán como verdaderas por el simple hecho de ejecutar tests de laboratorio. La publicación sigue requiriendo backup privado real/restauración, autenticación real, mismos vídeos, permisos, CPU gratuita, reversión preparada y autorización expresa.

**Alcance de esta protección:** CI identifica cambios accidentales y bloquea esa prueba; no constituye por sí solo una protección de rama de GitHub, no prohíbe que un propietario cambie manualmente DNS o ajustes de Pages y no prueba el frontend ya desplegado. **Producción permanece igual**.

**Sin cambios:** `main`, `bellaquitas.fr`, DNS, GitHub Pages, Worker remoto, Supabase oficial, usuarios, puntos, visitas y servicios facturables.
