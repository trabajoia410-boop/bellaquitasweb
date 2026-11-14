#!/usr/bin/env python3
"""
Bellaquitas Fest — restauración PRIVADA, local, sin conexiones a producción.

--check: comprueba configuración (no abre copia ni conecta al servidor)
--run /ruta/privada/archivo.tar.gz.gpg: restaura en una DB LOCAL
preexistente, VACÍA y con nombre bellaquitas_restore_*, sin crear ni borrar DB.

Debe ejecutarse exclusivamente en el equipo del propietario, fuera de CI,
con PostgreSQL local y usuario dedicado NO privilegiado. El archivo GPG
se descifra temporalmente EN ESE EQUIPO. NUNCA enviarlo a GitHub/ChatGPT.
La copia incluye Auth y Storage; algunos objetos Supabase necesitan
extensiones/roles específicos, por lo que la restauración puede fallar
sin un entorno aislado compatible. El script falla cerrado en ese caso.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile

from backup_privado_local import (
    SOURCE_METRICS_SQL, source_profile_fingerprint, validate_metrics,
    verify_archive_contents, verify_pg, verify_postgres_versions
)

DB_PATTERN=re.compile(r"^bellaquitas_restore_[a-z0-9_]{4,36}$")
LOCAL_HOSTS={"127.0.0.1","localhost","::1"}
SAFE_USER="bellaquitas_restore"

def local_target(env: dict,require_tty: bool=True) -> str:
    """Rechazar servidores/destinos reales y conexiones ambiguas, sin red."""
    if env.get("CI") or env.get("GITHUB_ACTIONS"):
        raise RuntimeError("Restauración REAL prohibida en GitHub Actions")
    if env.get("BELLAQUITAS_RESTORE_LOCAL_ONLY")!="yes":
        raise RuntimeError("Restauración bloqueada: requiere confirmación local")
    if env.get("PGHOST") not in LOCAL_HOSTS or env.get("PGPORT")!="5432":
        raise RuntimeError("Solo PostgreSQL de localhost:5432")
    # El programa no puede detectar túneles SSH ni redirecciones de red:
    # el usuario debe comprobar que localhost es un PostgreSQL propio.
    if env.get("PGUSER")!=SAFE_USER or not env.get("PGPASSWORD"):
        raise RuntimeError("Utilizar el usuario local exclusivo bellaquitas_restore")
    if env.get("PGSSLMODE") not in (None,"disable"):
        raise RuntimeError("Modo SSL inesperado; no enviar credenciales a otro host")
    database=env.get("PGDATABASE","")
    if not DB_PATTERN.fullmatch(database):
        raise RuntimeError("Destino debe ser una DB local bellaquitas_restore_*")
    if env.get("PGSERVICE") or env.get("PGSERVICEFILE") or env.get("PGHOSTADDR"):
        raise RuntimeError("No usar perfiles, hostaddr ni servicios PostgreSQL ocultos")
    if require_tty and not sys.stdin.isatty():
        raise RuntimeError("Solo restauración presencial con terminal interactivo")
    return database

def sql(query: str,env: dict) -> str:
    result=subprocess.run([
        "psql","-X","--no-psqlrc","--no-align","--tuples-only",
        "--set=ON_ERROR_STOP=1","--command",query
    ],env=env,check=True,capture_output=True,text=True)
    return result.stdout.strip()

def require_empty_target(env: dict) -> None:
    """No cargar una copia sobre una BD con objetos de usuario existentes."""
    query="""
SELECT COUNT(*) FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname NOT IN ('pg_catalog','information_schema')
  AND n.nspname NOT LIKE 'pg_toast%'
  AND c.relkind IN ('r','p','f','m');
""".strip()
    count=sql(query,env)
    if not count.isdigit() or int(count)!=0:
        raise RuntimeError("Destino NO vacío: crear otra DB local aislada; no borrar nada")
    # Evitar que el restaurador se ejecute con un usuario PostgreSQL superuser,
    # capaz de modificar otras bases, roles o recursos del servidor local.
    privileges=sql(
        "SELECT (rolsuper OR rolcreatedb OR rolcreaterole)::int "
        "FROM pg_catalog.pg_roles WHERE rolname=current_user",env)
    if privileges!="0":
        raise RuntimeError("Usar un rol PostgreSQL local sin privilegios globales")

def compare_restored(expected: dict,env: dict,expected_profile_sha256: str|None=None) -> None:
    actual=validate_metrics(json.loads(sql(SOURCE_METRICS_SQL,env)))
    if actual!=expected:
        fields=[k for k in expected if actual[k]!=expected[k]]
        # No mostrar datos identificativos ni volcar la base privada.
        raise RuntimeError("Restauración no coincide en "+", ".join(fields))
    if expected_profile_sha256 is not None:
        actual_hash=source_profile_fingerprint(env)
        if actual_hash!=expected_profile_sha256:
            raise RuntimeError(
                "Restauración no coincide en datos individuales de socios "
                "(rol, tarjeta, puntos o visitas)"
            )
    print("OK: perfiles, administradores, puntos, visitas, Auth y Storage coinciden.")
    if expected_profile_sha256 is not None:
        print("OK: SHA-256 por perfiles restaurados coincide sin mostrar datos personales.")
    print("Recuentos verificados:",len(expected),"campos; sin publicar identidades.")

def run_restore(archive: Path,env: dict) -> None:
    database=local_target(env)
    if not archive.name.endswith(".tar.gz.gpg") or not archive.is_file():
        raise RuntimeError("Seleccionar archivo GPG privado existente")
    if archive.is_symlink():
        raise RuntimeError("No aceptar enlaces simbólicos como backup privado")
    if not shutil.which("gpg") or not shutil.which("pg_restore") or not shutil.which("psql"):
        raise RuntimeError("Faltan herramientas locales GPG/PostgreSQL")
    # La base debe EXISTIR pero estar completamente vacía. No CREATE/DROP.
    require_empty_target(env)
    verify_postgres_versions(env)
    if input("Escribe RESTAURAR_EN_LOCAL para continuar: ").strip()!="RESTAURAR_EN_LOCAL":
        print("Cancelado: no se ha restaurado ningún dato.")
        return
    with tempfile.TemporaryDirectory(prefix=".bellaquitas-restore-",dir=archive.parent) as folder:
        work=Path(folder)
        Path(folder).chmod(0o700)
        decrypted=work/"payload.tar.gz"
        # GPG pide la contraseña en el equipo del propietario, no en argumentos.
        subprocess.run([
            "gpg","--quiet","--decrypt","--output",str(decrypted),str(archive)
        ],check=True)
        verify_archive_contents(decrypted)
        dump=work/"supabase-full.dump"
        with tarfile.open(decrypted,"r:gz") as tar:
            manifest=json.load(tar.extractfile("checksum-manifest.json"))
            expected=validate_metrics(manifest.get("postgres_expected"))
            expected_rows=manifest["profile_rows_sha256"]
            entry=tar.extractfile("supabase-full.dump")
            if entry is None:
                raise RuntimeError("Falta la exportación PostgreSQL")
            with dump.open("xb") as output:
                shutil.copyfileobj(entry,output,length=1024*1024)
        dump.chmod(0o600)
        listing=subprocess.run(["pg_restore","--list",str(dump)],check=True,
                               capture_output=True,text=True).stdout
        verify_pg(listing)
        require_empty_target(env)
        # No --clean, --create, --drop ni --if-exists. El destino es un
        # PostgreSQL local aislado preexistente; NUNCA una cuenta Supabase.
        subprocess.run([
            "pg_restore","--exit-on-error","--no-owner","--no-privileges",
            "--dbname",database,str(dump)
        ],env=env,check=True)
        compare_restored(expected,env,expected_rows)
        print("OK: restauración efectuada en entorno LOCAL aislado.")
        print("Los archivos de trabajo se eliminarán al finalizar;")
        print("la BD local de pruebas debe protegerse/borrarse por su propietario.")
        print("Ninguna base real, R2, DNS, web ni usuario de producción modificado.")

def main() -> None:
    if len(sys.argv)==2 and sys.argv[1]=="--check":
        db=local_target(os.environ,require_tty=False)
        print("Configuración local aceptada:",db,
              "| ningún dato descargado, restaurado o modificado.")
    elif len(sys.argv)==3 and sys.argv[1]=="--run":
        raise RuntimeError(
            "Restauración anterior retirada. Utiliza backup_d1_solo.py --restore-local"
        )
        source=Path(sys.argv[2]).expanduser()
        if source.is_symlink():
            raise RuntimeError("No abrir copias enlazadas simbólicamente")
        run_restore(source.resolve(),os.environ)
    else:
        raise RuntimeError("Uso: --check | --run /ruta/privada/archivo.tar.gz.gpg")

if __name__=="__main__":
    try:
        main()
    except Exception as exc:
        print("Restauración BLOQUEADA o fallida:",type(exc).__name__,str(exc)[:260],
              file=sys.stderr)
        sys.exit(1)
