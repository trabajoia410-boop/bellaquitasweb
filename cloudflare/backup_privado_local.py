#!/usr/bin/env python3
"""
Bellaquitas Fest — copia PRIVADA local, nunca desde GitHub Actions.

--check      Revisa herramientas, sin consultar cuentas.
--verify     Verifica un archivo GPG existente de forma local y privada.
--self-test  Prueba verificaciones con datos sintéticos; sin herramientas ni red.
--run        Exporta Supabase (Postgres), D1 staging y R2 a carpeta PRIVADA,
             comprueba integridad local y produce UN archivo cifrado con GPG.
             NO despliega, NO restaura y NO modifica puntos ni visitas reales.

IMPORTANTE: requiere credenciales en variables de entorno DEL PROPIETARIO,
terminal interactiva y una ubicación bajo su control. No ejecutar en CI.
"""
from __future__ import annotations
import hashlib
import json
import os
from pathlib import Path
import shutil
import sqlite3
import subprocess
import sys
import tarfile
import tempfile
from datetime import datetime, timezone

PROJECT = "vlsipvngvxcgnwrhpjgg"
ACCOUNT = "7698bb24db010350ba4b02c36c0fbeb5"
BUCKET = "bellaquitas-media-staging"
DATABASE = "bellaquitas-staging"
TOOLS = ("pg_dump", "pg_restore", "wrangler", "aws", "gpg")
REQUIRED_PG = ("TABLE DATA public profiles", "TABLE DATA public activity",
               "TABLE DATA auth users", "TABLE DATA auth identities",
               "TABLE DATA storage objects")
REQUIRED_D1 = {"profiles", "events", "activity", "auth_email_credentials",
               "auth_sessions", "site_content", "redemptions"}
FILES = ("supabase-full.dump", "cloudflare-d1-staging.sql",
         "r2-inventory.json", "supabase-storage-inventory.json",
         "checksum-manifest.json")

def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for part in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(part)
    return digest.hexdigest()

def verify_pg(listing: str) -> None:
    for item in REQUIRED_PG:
        if item not in listing:
            raise RuntimeError("La copia Postgres no contiene " + item)

def verify_d1(sql: str) -> tuple[int, int, int]:
    """Restauración de ensayo SOLO en SQLite en memoria; no toca D1 remoto."""
    connection = sqlite3.connect(":memory:")
    try:
        connection.executescript(sql)
        names = {row[0] for row in connection.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        )}
        missing = REQUIRED_D1 - names
        if missing:
            raise RuntimeError("Faltan tablas D1: " + ", ".join(sorted(missing)))
        count, points, visits = connection.execute(
            "SELECT COUNT(*), COALESCE(SUM(points),0), COALESCE(SUM(visits),0) FROM profiles"
        ).fetchone()
        if count < 6 or points < 0 or visits < 0:
            raise RuntimeError("Recuento inválido de perfiles o fidelidad")
        return int(count), int(points), int(visits)
    finally:
        connection.close()

def verify_bucket(inventory: dict, directory: Path, minimum: int, label: str) -> int:
    if inventory.get("IsTruncated") is True:
        raise RuntimeError("Inventario truncado de "+label+": requiere paginación")
    objects = inventory.get("Contents", [])
    if len(objects) < minimum:
        raise RuntimeError("Inventario "+label+" incompleto; faltan objetos")
    for item in objects:
        key = str(item["Key"])
        if key.startswith("/") or ".." in Path(key).parts:
            raise RuntimeError("Ruta no permitida en "+label)
        file = directory / key
        if not file.is_file() or file.stat().st_size != int(item["Size"]):
            raise RuntimeError("Archivo ausente o distinto en "+label)
    return len(objects)

def verify_r2(inventory: dict, directory: Path) -> int:
    return verify_bucket(inventory, directory, 20, "Cloudflare R2")

def verify_supabase_storage(inventory: dict, directory: Path) -> int:
    return verify_bucket(inventory, directory, 3, "Supabase Storage")

def verify_backup(pg_listing: str, d1_sql: str,
                  r2_inventory: dict, r2_path: Path,
                  storage_inventory: dict, storage_path: Path):
    verify_pg(pg_listing)
    counts = verify_d1(d1_sql)
    r2_objects = verify_r2(r2_inventory, r2_path)
    storage_objects = verify_supabase_storage(storage_inventory, storage_path)
    return {"d1_profiles": counts[0], "d1_points": counts[1],
            "d1_visits": counts[2], "r2_objects": r2_objects,
            "supabase_storage_objects": storage_objects}

def test_archive_integrity() -> None:
    """Verificación de un TAR de ensayo y detección de manipulación y pérdidas."""
    with tempfile.TemporaryDirectory() as tmp:
        base = Path(tmp)
        values = {name:b"ejemplo-"+name.encode("utf8") for name in (
            "supabase-full.dump","cloudflare-d1-staging.sql",
            "r2-inventory.json","supabase-storage-inventory.json")}
        values["r2/imagen.png"] = b"foto inventada"
        values["supabase-storage/logo.png"] = b"logo ficticio"
        good = {k:hashlib.sha256(v).hexdigest() for k,v in values.items()}
        manifest = {k:good[k] for k in FILES if k!="checksum-manifest.json"}
        manifest["r2"]={"imagen.png":good["r2/imagen.png"]}
        manifest["supabase-storage"]={"logo.png":good["supabase-storage/logo.png"]}
        values["checksum-manifest.json"]=json.dumps(manifest).encode("utf8")
        import io
        def pack(target,modified):
            with tarfile.open(target,"w:gz") as tar:
                for name,data in modified.items():
                    info=tarfile.TarInfo(name)
                    info.size=len(data)
                    tar.addfile(info,io.BytesIO(data))
        archive=base/"valid.tar.gz"
        pack(archive,values)
        checks=verify_archive_contents(archive)
        assert checks["files_checked"]==6
        bad=dict(values)
        bad["r2/imagen.png"]=b"foto cambiada"
        pack(base/"corrupt.tar.gz",bad)
        try:
            verify_archive_contents(base/"corrupt.tar.gz")
            raise AssertionError("Se aceptó un archivo modificado")
        except RuntimeError:
            pass
        incomplete=dict(values)
        del incomplete["supabase-storage/logo.png"]
        pack(base/"missing.tar.gz",incomplete)
        try:
            verify_archive_contents(base/"missing.tar.gz")
            raise AssertionError("Se aceptó un archivo sin objetos")
        except RuntimeError:
            pass

def synthetic_self_test() -> None:
    with tempfile.TemporaryDirectory() as d:
        temp = Path(d)
        target = temp / "r2"
        target.mkdir()
        (target / "sample.txt").write_text("ficticio", encoding="utf8")
        contents = [{"Key": "sample.txt", "Size": 8}]
        contents += [{"Key": "file" + str(i), "Size": 0} for i in range(19)]
        for i in range(19):
            (target / ("file" + str(i))).touch()
        listing = "\n".join(REQUIRED_PG)
        schema = "\n".join("CREATE TABLE " + name + (
            "(id TEXT,points INTEGER DEFAULT 0,visits INTEGER DEFAULT 0);"
            if name == "profiles" else "(id TEXT);"
        ) for name in sorted(REQUIRED_D1))
        schema += "\n" + "\n".join(
            "INSERT INTO profiles(id,points,visits) VALUES ('fake"
            + str(i) + "',10,1);" for i in range(6))
        storage = temp / "supabase-storage"
        storage.mkdir()
        storage_items = [{"Key":"logo"+str(i)+".png","Size":3} for i in range(3)]
        for item in storage_items:
            (storage / item["Key"]).write_bytes(b"ABC")
        result = verify_backup(listing, schema,
            {"Contents": contents}, target, {"Contents": storage_items}, storage)
        assert result == {"d1_profiles":6,"d1_points":60,"d1_visits":6,
                          "r2_objects":20,"supabase_storage_objects":3}
        try:
            verify_supabase_storage({"Contents":storage_items[:-1]},storage)
            raise AssertionError("No se detectaron archivos Supabase faltantes")
        except RuntimeError:
            pass
        # Mal inventario: detectar discrepancia sin escribir nada en remoto.
        bad = {"Contents": contents[:-1]}
        try:
            verify_r2(bad,target)
            raise AssertionError("No se detectó inventario incompleto")
        except RuntimeError:
            pass
        try:
            verify_pg("TABLE DATA public profiles")
            raise AssertionError("No se detectaron datos auth ausentes")
        except RuntimeError:
            pass
    test_archive_integrity()
    print("OK: respaldo local y SHA-256 de archivos validados con datos sintéticos, sin acceso remoto.")

def backup_dir() -> Path:
    location = Path(os.environ.get(
        "BELLAQUITAS_PRIVATE_BACKUP_DIR",
        str(Path.home() / "Bellaquitas-Respaldos-Privados")
    )).expanduser().resolve()
    repo = Path(__file__).resolve().parent.parent
    if location == repo or repo in location.parents or location in (
        Path("/tmp"), Path("/var/tmp"), Path("/")
    ):
        raise RuntimeError("Carpeta no permitida: usar directorio privado fuera de GitHub")
    location.mkdir(parents=True,exist_ok=True,mode=0o700)
    location.chmod(0o700)
    return location

def validate_environment() -> None:
    if os.environ.get("CI") or os.environ.get("GITHUB_ACTIONS"):
        raise RuntimeError("Prohibido hacer backups reales en GitHub Actions")
    missing = [k for k in (
        "PGHOST","PGPORT","PGUSER","PGPASSWORD","PGDATABASE",
        "CLOUDFLARE_API_TOKEN","CLOUDFLARE_ACCOUNT_ID",
        "AWS_ACCESS_KEY_ID","AWS_SECRET_ACCESS_KEY",
        "SUPABASE_S3_ACCESS_KEY_ID","SUPABASE_S3_SECRET_ACCESS_KEY"
    ) if not os.environ.get(k)]
    if missing:
        raise RuntimeError("Faltan variables PRIVADAS: " + ", ".join(missing))
    if os.environ["CLOUDFLARE_ACCOUNT_ID"] != ACCOUNT:
        raise RuntimeError("Cuenta Cloudflare diferente a Bellaquitas Fest")
    if os.environ["PGUSER"] not in ("postgres","postgres."+PROJECT):
        raise RuntimeError("El usuario Postgres no corresponde al proyecto Bellaquitas")
    if os.environ["PGDATABASE"] != "postgres":
        raise RuntimeError("Nombre de base Postgres no esperado")
    host = os.environ["PGHOST"]
    if host != "db."+PROJECT+".supabase.co" and not host.endswith(".pooler.supabase.com"):
        raise RuntimeError("Host de Supabase no esperado")
    if not sys.stdin.isatty():
        raise RuntimeError("Se requiere terminal interactiva: nunca ejecutar en CI")

def run(command: list[str], *, env=None, stdout=None):
    # No imprimir comandos: pueden incluir rutas privadas o configuraciones locales.
    subprocess.run(command,check=True,env=env,stdout=stdout)

def verify_archive_contents(archive: Path) -> dict:
    """Comprueba SHA-256 de TODOS los ficheros sin extraerlos a disco."""
    with tarfile.open(archive,"r:gz") as tar:
        entries=tar.getmembers()
        if any(not (entry.isfile() or entry.isdir()) for entry in entries):
            raise RuntimeError("El archivo contiene enlaces simbólicos u otros tipos no permitidos")
        members = [x for x in entries if x.isfile()]
        actual = {x.name for x in members}
        if len(actual) != len(members):
            raise RuntimeError("El archivo contiene nombres duplicados")
        if not set(FILES).issubset(actual):
            raise RuntimeError("El archivo cifrado no contiene todas sus fuentes")
        manifest_file = tar.extractfile("checksum-manifest.json")
        if manifest_file is None:
            raise RuntimeError("Falta el manifiesto de integridad")
        manifest = json.load(manifest_file)
        expected = {"checksum-manifest.json"} | set(FILES)
        checks = {}
        for name in ("supabase-full.dump","cloudflare-d1-staging.sql",
                     "r2-inventory.json","supabase-storage-inventory.json"):
            checks[name] = manifest.get(name)
            if not isinstance(checks[name],str) or len(checks[name]) != 64:
                raise RuntimeError("Manifiesto sin SHA-256 de "+name)
        for section in ("r2","supabase-storage"):
            data = manifest.get(section)
            if not isinstance(data,dict):
                raise RuntimeError("Manifiesto sin sección "+section)
            for relative,digest in data.items():
                if (not isinstance(relative,str) or not relative or
                    relative.startswith("/") or ".." in Path(relative).parts or
                    not isinstance(digest,str) or len(digest)!=64):
                    raise RuntimeError("Manifiesto contiene ruta o hash incorrecto")
                name = section+"/"+relative
                if name in checks:
                    raise RuntimeError("Manifiesto con duplicados")
                checks[name] = digest
                expected.add(name)
        if actual != expected:
            raise RuntimeError("Archivo con datos extra o faltantes")
        for name,digest in checks.items():
            file = tar.extractfile(name)
            if file is None:
                raise RuntimeError("No se puede leer "+name)
            result = hashlib.sha256()
            for chunk in iter(lambda:file.read(1024*1024),b""):
                result.update(chunk)
            if result.hexdigest() != digest:
                raise RuntimeError("Corrupción o hash incorrecto en "+name)
        return {"objects_r2":len(manifest["r2"]),
                "objects_supabase":len(manifest["supabase-storage"]),
                "files_checked":len(checks)}

def make_archive(work: Path, out: Path) -> None:
    with tarfile.open(work / "payload.tar.gz","w:gz") as tar:
        for name in FILES:
            tar.add(work / name,arcname=name,recursive=False)
        tar.add(work / "r2",arcname="r2")
        tar.add(work / "supabase-storage",arcname="supabase-storage")
    run(["gpg","--quiet","--symmetric","--cipher-algo","AES256",
         "--output",str(out),str(work/"payload.tar.gz")])
    if not out.is_file() or out.stat().st_size == 0:
        raise RuntimeError("No se creó un archivo cifrado")
    # Una comprobación de lectura NO es una restauración final de producción.
    checkpath = work / "decrypted-check.tar.gz"
    run(["gpg","--quiet","--decrypt","--output",str(checkpath),str(out)])
    validation=verify_archive_contents(checkpath)
    if validation["objects_r2"]<20 or validation["objects_supabase"]<3:
        raise RuntimeError("La copia cifrada no incluye todos los objetos esperados")
    checkpath.unlink()
    out.with_suffix(out.suffix + ".sha256").write_text(
        sha256_file(out)+"  "+out.name+"\n",encoding="utf8"
    )

def perform() -> None:
    validate_environment()
    missing=[name for name in TOOLS if shutil.which(name) is None]
    if missing:
        raise RuntimeError("Instalar herramientas gratuitas: "+", ".join(missing))
    location=backup_dir()
    print("ATENCIÓN: las copias de usuarios se mantendrán temporalmente en tu equipo.")
    print("Se cifrarán antes de archivarse. No compartir archivos ni claves.")
    print("D1 puede dejar de responder momentáneamente durante su exportación.")
    if input("Escribe RESPALDAR para continuar: ").strip() != "RESPALDAR":
        print("Cancelado sin acceder a datos.")
        return
    timestamp=datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    output=location / ("bellaquitas-"+timestamp+".tar.gz.gpg")
    if output.exists():
        raise RuntimeError("No se sobrescriben copias antiguas")
    work=Path(tempfile.mkdtemp(dir=location,prefix=".provisional-"))
    try:
        pg_env=dict(os.environ,PGSSLMODE="require")
        print("[1/5] Exportando base Postgres completa (incluyendo Auth)...")
        run(["pg_dump","--format=custom","--no-owner","--no-privileges",
             "--file",str(work/"supabase-full.dump")],env=pg_env)
        with (work/"pg-objects.txt").open("w",encoding="utf8") as listing:
            run(["pg_restore","--list",str(work/"supabase-full.dump")],stdout=listing)

        print("[2/5] Exportando D1 staging (sin modificarla)...")
        run(["wrangler","d1","export",DATABASE,"--remote","--output",
             str(work/"cloudflare-d1-staging.sql"),"--skip-confirmation"])

        print("[3/5] Descargando archivos de Cloudflare R2 sin eliminarlos...")
        r2dir=work/"r2"
        r2dir.mkdir()
        endpoint="https://"+ACCOUNT+".r2.cloudflarestorage.com"
        run(["aws","--endpoint-url",endpoint,"s3","sync",
             "s3://"+BUCKET,str(r2dir),"--no-progress","--only-show-errors"])
        with (work/"r2-inventory.json").open("w",encoding="utf8") as listing:
            run(["aws","--endpoint-url",endpoint,"s3api","list-objects-v2",
                 "--bucket",BUCKET,"--output","json"],stdout=listing)

        print("[4/5] Descargando también los objetos originales de Supabase Storage...")
        storage_dir=work/"supabase-storage"
        storage_dir.mkdir()
        supa_env=dict(os.environ,
          AWS_ACCESS_KEY_ID=os.environ["SUPABASE_S3_ACCESS_KEY_ID"],
          AWS_SECRET_ACCESS_KEY=os.environ["SUPABASE_S3_SECRET_ACCESS_KEY"],
          AWS_DEFAULT_REGION="eu-west-3")
        supa_endpoint="https://"+PROJECT+".storage.supabase.co/storage/v1/s3"
        run(["aws","--endpoint-url",supa_endpoint,"--region","eu-west-3",
             "s3","sync","s3://bellaquitas-media",str(storage_dir),
             "--no-progress","--only-show-errors"],env=supa_env)
        with (work/"supabase-storage-inventory.json").open("w",encoding="utf8") as listing:
            run(["aws","--endpoint-url",supa_endpoint,"--region","eu-west-3",
                 "s3api","list-objects-v2","--bucket","bellaquitas-media",
                 "--output","json"],env=supa_env,stdout=listing)

        print("[5/5] Restauración D1 en memoria, comprobación de archivos y cifrado...")
        result=verify_backup((work/"pg-objects.txt").read_text(encoding="utf8"),
             (work/"cloudflare-d1-staging.sql").read_text(encoding="utf8"),
             json.loads((work/"r2-inventory.json").read_text(encoding="utf8")),r2dir,
             json.loads((work/"supabase-storage-inventory.json").read_text(encoding="utf8")),storage_dir)
        manifest={name:sha256_file(work/name) for name in (
            "supabase-full.dump","cloudflare-d1-staging.sql","r2-inventory.json",
            "supabase-storage-inventory.json")}
        manifest["r2"]={str(p.relative_to(r2dir)):sha256_file(p)
                        for p in r2dir.rglob("*") if p.is_file()}
        manifest["supabase-storage"]={
            str(p.relative_to(storage_dir)):sha256_file(p)
            for p in storage_dir.rglob("*") if p.is_file()}
        (work/"checksum-manifest.json").write_text(
            json.dumps(manifest,ensure_ascii=False,indent=2),encoding="utf8")
        make_archive(work,output)
        output.chmod(0o600)
        print("OK: archivo cifrado en directorio privado.")
        print("Control local: D1 tiene",result["d1_profiles"],"perfiles,",
              result["r2_objects"],"objetos R2 y",
              result["supabase_storage_objects"],"objetos Supabase Storage.")
        print("IMPORTANTE: falta prueba de restauración Postgres completa en instancia aislada.")
        print("No se ha cambiado la base original, DNS ni la web pública.")
    except BaseException:
        # No dejar un archivo cifrado parcial marcado por error como respaldo válido.
        output.unlink(missing_ok=True)
        output.with_suffix(output.suffix + ".sha256").unlink(missing_ok=True)
        raise
    finally:
        shutil.rmtree(work,ignore_errors=True)

def main():
    mode=sys.argv[1] if len(sys.argv)>1 else "--check"
    if mode=="--self-test":
        synthetic_self_test()
    elif mode=="--check":
        missing=[name for name in TOOLS if shutil.which(name) is None]
        if missing:
            print("No se han iniciado copias. Herramientas locales pendientes:",
                  ", ".join(missing))
        else:
            print("Herramientas disponibles. NO se ha accedido a cuentas ni exportado datos.")
    elif mode=="--verify":
        if len(sys.argv)!=3:
            raise RuntimeError("Uso: --verify /ruta/privada/archivo.tar.gz.gpg")
        if shutil.which("gpg") is None:
            raise RuntimeError("Necesitas GPG para verificar la copia privada")
        encrypted=Path(sys.argv[2]).expanduser().resolve()
        if not encrypted.is_file() or not encrypted.name.endswith(".tar.gz.gpg"):
            raise RuntimeError("No se encontró un respaldo cifrado válido")
        with tempfile.TemporaryDirectory(dir=encrypted.parent,prefix=".bellaquitas-verify-") as folder:
            dest=Path(folder)/"verify.tar.gz"
            run(["gpg","--quiet","--decrypt","--output",str(dest),str(encrypted)])
            details=verify_archive_contents(dest)
            print("OK: respaldo descifrado y SHA-256 verificados:",details["files_checked"],"ficheros")
            print("Objetos verificados: R2",details["objects_r2"],
                "| Supabase Storage",details["objects_supabase"])
            print("Esto NO sustituye una restauración PostgreSQL aislada.")
    elif mode=="--run":
        perform()
    else:
        raise RuntimeError("Uso: --check | --self-test | --run")

if __name__=="__main__":
    try:
        main()
    except Exception as exc:
        print("ERROR de respaldo:",str(exc),file=sys.stderr)
        sys.exit(1)
