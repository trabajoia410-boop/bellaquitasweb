#!/usr/bin/env python3
"""Bellaquitas Fest — impedir cambios accidentales en la web pública.

Se compara el árbol de la rama de auditoría con la web original de main.
Solo se autoriza la diferencia en app.js previamente revisada para crear
enlaces del panel separado. Ningún archivo/asset de la página cambia.

Requiere git checkout con historial completo (CI: fetch-depth: 0).
No accede a DNS, Cloudflare, Supabase, usuarios, ni servicios externos.
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

# Commit original que sigue desplegado en GitHub Pages / bellaquitas.fr.
BASE_MAIN="aafb4de85a204cdb79b281815df5819417e7d9c6"
# SHA-1 de GitHub de app.js revisado, cuya única diferencia funcional
# separa las rutas de administración en otra pestaña y no cambia diseño.
EXPECTED_APP_AUDIT="55a540907c9d126bdfd0122d7ce68a41a0b28402"
EXPECTED_APP_MAIN="b162f4b7f3983e9e4f360848bcf2583b4269bdb5"
EXPECTED_VIDEOS=5

def git(*args: str) -> str:
    p=subprocess.run(["git",*args],check=True,text=True,capture_output=True)
    return p.stdout.strip()

def tracked_files(rev: str) -> dict[str,str]:
    # -z devuelve rutas UTF-8 literales (sin core.quotePath), necesario
    # para «móvil.mp4» y nombres con acentos o espacios.
    listing=subprocess.run(
        ["git","ls-tree","-r","-z",rev],
        capture_output=True,check=True
    ).stdout.decode("utf-8")
    result={}
    for record in listing.split("\0"):
        if not record:
            continue
        metadata,filename=record.split("\t",1)
        mode,typ,sha=metadata.split()
        if typ!="blob" or filename.startswith((".github/","cloudflare/")):
            continue
        result[filename]=sha
    return result

def check() -> None:
    # Si el commit base faltase, prohibir éxito aparente con otro origen.
    git("cat-file","-e",BASE_MAIN+"^{commit}")
    base=tracked_files(BASE_MAIN)
    current=tracked_files("HEAD")
    if "app.js" not in base or "app.js" not in current:
        raise RuntimeError("Falta el JavaScript original o de auditoría")
    if base["app.js"]!=EXPECTED_APP_MAIN or current["app.js"]!=EXPECTED_APP_AUDIT:
        raise RuntimeError(
            "app.js fue cambiado después de revisar la separación del panel. "
            "Revisar el diff e introducir explícitamente un nuevo baseline seguro"
        )
    orig=set(base)-{"app.js"}
    proposed=set(current)-{"app.js"}
    removed=sorted(orig-proposed)
    added=sorted(proposed-orig)
    modified=sorted(p for p in orig & proposed if base[p]!=current[p])
    if removed or added or modified:
        raise RuntimeError(
            "La rama de pruebas modifica el aspecto/activos originales. "
            "Ficheros eliminados: "+repr(removed)+
            "; nuevos: "+repr(added)+
            "; distintos: "+repr(modified)
        )
    assets=[p for p in orig if p.startswith("assets/")]
    videos=[p for p in assets if p.lower().endswith(".mp4")]
    if len(assets)!=19 or len(videos)!=EXPECTED_VIDEOS:
        raise RuntimeError("Inventario de archivos original inesperado")
    for essential in ("index.html","styles.css","config.js","locale-fr.js"):
        if essential not in orig:
            raise RuntimeError("Falta archivo original imprescindible: "+essential)
    # No aprobar una rama equivocada ni la propia producción por error.
    # GitHub Actions checkout puede dejar HEAD detached aunque el evento
    # sea un push a auditoría. GITHUB_REF_NAME refleja la rama del evento.
    import os
    ref=os.environ.get("GITHUB_REF_NAME") or git("branch","--show-current")
    if ref!="auditoria/fase5-2026-11-11":
        raise RuntimeError("Solo es válido para la rama de auditoría, no main")
    # Único workflow con permiso write en el proyecto: importador de logo
    # antiguo. No puede ejecutarse ni por push ni manualmente en auditoría.
    importer=Path(".github/workflows/import-bellaquitas-logo.yml").read_text(
        encoding="utf-8"
    )
    if ("    branches:\n      - main\n" not in importer or
        "if: github.ref == 'refs/heads/main'" not in importer):
        raise RuntimeError(
            "El importador write podría modificar assets de la rama de auditoría"
        )
    for workflow in Path(".github/workflows").glob("qa-*.yml"):
        code=workflow.read_text(encoding="utf-8")
        if "contents: write" in code or "git push" in code:
            raise RuntimeError("QA no puede escribir o publicar: "+str(workflow))
    print("OK: auditoría sin workflows QA que escriban; importador solo main.")
    print("OK: diseño/HTML/estilos/traducciones intactos.")
    print("OK: 19 recursos originales idénticos, incluidos 5 vídeos MP4.")
    print("OK: app.js coincide con el cambio SSO explícitamente revisado.")
    print("OK: no se han creado, borrado ni modificado archivos de la web.")
    print("Ninguna escritura ni servicio de pago; producción sin cambios.")

if __name__=="__main__":
    try:
        check()
    except Exception as exc:
        print("BLOQUEADO: "+str(exc)[:1000],file=sys.stderr)
        sys.exit(1)
