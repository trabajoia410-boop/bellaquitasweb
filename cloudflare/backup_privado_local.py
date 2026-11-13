#!/usr/bin/env python3
"""
Bellaquitas Fest — copia PRIVADA local, nunca desde GitHub Actions.

--check      Revisa herramientas, sin consultar cuentas.
--verify     Verifica un archivo GPG existente de forma local y privada.
--self-test  Prueba verificaciones con datos sintéticos; sin herramientas ni red.
--run        Exporta Supabase (Postgres), D1 staging y Storage a carpeta PRIVADA,
             comprueba integridad local y produce UN archivo cifrado con GPG.
             NO despliega, NO restaura y NO modifica puntos ni visitas reales.

IMPORTANTE: requiere credenciales en variables de entorno DEL PROPIETARIO,
terminal interactiva y una ubicación bajo su control. No ejecutar en CI.
"""
from __future__ import annotations
import hashlib
import json
import os
import re
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
# R2 ha sido eliminado: no crear ni consultar buckets antiguos.
DATABASE = "bellaquitas-staging"
TOOLS = ("pg_dump", "pg_restore", "psql", "wrangler", "aws", "gpg")
# Tablas críticas confirmadas en el esquema real de Supabase, 12/11/2026.
# Los datos binarios de Storage se exportan aparte; estas son sus referencias.
REQUIRED_PG = {
    "public": (
        "activity", "admin_member_changes", "community_suggestions", "events",
        "moments_albums", "moments_photos", "profiles", "promos", "redemptions",
        "rewards", "site_content", "site_drafts",
    ),
    "auth": ("users", "identities", "sessions", "refresh_tokens"),
    "storage": ("buckets", "objects"),
}
REQUIRED_D1 = {"profiles", "events", "activity", "auth_email_credentials",
               "auth_sessions", "site_content", "redemptions"}
FILES = ("supabase-full.dump", "cloudflare-d1-staging.sql",
         "supabase-storage-inventory.json", "checksum-manifest.json")

def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for part in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(part)
    return digest.hexdigest()

# Datos AGREGADOS y no identificables para comprobar el resultado de una
# restauración futura. Solo se guardan DENTRO del archivo cifrado GPG.
EXPECTED_METRICS=("profiles","points","lifetime_points","visits",
                  "admins","auth_users","auth_identities",
                  "auth_sessions","storage_objects")
SOURCE_METRICS_SQL="""
SELECT json_build_object(
 'profiles',(SELECT count(*) FROM public.profiles),
 'points',(SELECT coalesce(sum(points),0) FROM public.profiles),
 'lifetime_points',(SELECT coalesce(sum(lifetime_points),0) FROM public.profiles),
 'visits',(SELECT coalesce(sum(visits),0) FROM public.profiles),
 'admins',(SELECT count(*) FROM public.profiles WHERE role='admin'),
 'auth_users',(SELECT count(*) FROM auth.users),
 'auth_identities',(SELECT count(*) FROM auth.identities),
 'auth_sessions',(SELECT count(*) FROM auth.sessions),
 'storage_objects',(SELECT count(*) FROM storage.objects)
)::text
""".strip()

def validate_metrics(values: object) -> dict:
    if not isinstance(values,dict) or set(values)!=set(EXPECTED_METRICS):
        raise RuntimeError("Faltan métricas de integridad PostgreSQL")
    if any(type(values[k]) is not int or values[k]<0 for k in EXPECTED_METRICS):
        raise RuntimeError("Métricas de respaldo inválidas")
    if values["profiles"]<1 or values["admins"]<1 or values["admins"]>values["profiles"]:
        raise RuntimeError("Recuento de administradores/perfiles inválido")
    return values

def source_postgres_metrics(env: dict) -> dict:
    """Consulta agregada SOLO LECTURA, sin extraer emails, IDs ni contraseñas."""
    process=subprocess.run([
        "psql","-X","--no-psqlrc","--no-align","--tuples-only",
        "--set=ON_ERROR_STOP=1","--command",SOURCE_METRICS_SQL
    ],env=env,check=True,capture_output=True,text=True)
    return validate_metrics(json.loads(process.stdout.strip()))

def verify_pg(listing: str) -> None:
    # Parsear nombres exactos del listado de pg_restore para evitar falsos
    # positivos como "public profiles_backup" o "auth users_staging".
    tables=set()
    for line in listing.splitlines():
        match=re.search(
            r"\bTABLE DATA\s+([a-z_][a-z_0-9]*)\s+([a-z_][a-z_0-9]*)\s+",
            line,
        )
        if match:
            tables.add((match.group(1),match.group(2)))
    missing=[
        schema+"."+table
        for schema,names in REQUIRED_PG.items()
        for table in names
        if (schema,table) not in tables
    ]
    if missing:
        raise RuntimeError("Copia PostgreSQL incompleta; faltan datos de tablas: "+", ".join(missing))

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
    """Conciliación estricta: ni duplicados, rutas maliciosas o enlaces locales.

    Un inventario parcial puede parecer correcto si tiene claves repetidas:
    NO basta con comprobar que len(Contents) >= mínimo.
    """
    if not isinstance(inventory,dict) or inventory.get("IsTruncated") is not False:
        # AWS S3 list-objects-v2 devuelve siempre IsTruncated. Rechazar
        # inventarios sintéticos/paginaciones que no certifican fin de lista.
        raise RuntimeError("Inventario no finalizado de "+label+": revisar paginación")
    objects=inventory.get("Contents",[])
    if not isinstance(objects,list) or len(objects)<minimum:
        raise RuntimeError("Inventario "+label+" incompleto; faltan objetos")
    seen=set()
    root=directory.resolve(strict=True)
    for item in objects:
        if not isinstance(item,dict) or not isinstance(item.get("Key"),str):
            raise RuntimeError("Objeto inválido en "+label)
        key=item["Key"]
        part=Path(key)
        if (not key or key in seen or key.startswith("/") or "\\\\" in key or
            "\\x00" in key or any(ord(ch)<32 for ch in key) or
            part.is_absolute() or "." in part.parts or ".." in part.parts):
            raise RuntimeError("Clave duplicada o ruta no permitida en "+label)
        seen.add(key)
        if type(item.get("Size")) is not int or item["Size"]<0:
            raise RuntimeError("Tamaño inválido en "+label)
        target=directory/key
        if (target.is_symlink() or not target.is_file() or
            not target.resolve().is_relative_to(root) or
            target.stat().st_size!=item["Size"]):
            raise RuntimeError("Archivo ausente o distinto en "+label)
    return len(seen)



def verify_supabase_storage(inventory: dict, directory: Path) -> int:
    return verify_bucket(inventory, directory, 3, "Supabase Storage")

def verify_backup(pg_listing: str, d1_sql: str,
                  storage_inventory: dict, storage_path: Path):
    """No se respalda R2: se eliminó el único bucket real."""
    verify_pg(pg_listing)
    counts=verify_d1(d1_sql)
    storage_objects=verify_supabase_storage(storage_inventory,storage_path)
    return {"d1_profiles":counts[0],"d1_points":counts[1],
            "d1_visits":counts[2],"r2_objects":0,
            "supabase_storage_objects":storage_objects}

def test_archive_integrity() -> None:
    """Sin datos reales: archivo correcto, alterado, incompleto y peligroso."""
    import io
    with tempfile.TemporaryDirectory() as tmp:
        base=Path(tmp)
        payload={name:b"ficticio-"+name.encode("utf8") for name in FILES
                 if name!="checksum-manifest.json"}
        payload["supabase-storage/logo.png"]=b"foto sintetica"
        digest={k:hashlib.sha256(v).hexdigest() for k,v in payload.items()}
        manifest={k:digest[k] for k in FILES if k!="checksum-manifest.json"}
        manifest["r2_mode"]="removed"
        manifest["postgres_expected"]={
            "profiles":2,"points":23,"lifetime_points":40,"visits":1,
            "admins":1,"auth_users":2,"auth_identities":2,
            "auth_sessions":1,"storage_objects":1}
        manifest["supabase-storage"]={"logo.png":digest["supabase-storage/logo.png"]}
        payload["checksum-manifest.json"]=json.dumps(manifest).encode("utf8")
        def pack(filename,files,symlink=False):
            with tarfile.open(base/filename,"w:gz") as tar:
                for name,data in files.items():
                    info=tarfile.TarInfo(name)
                    info.size=len(data)
                    tar.addfile(info,io.BytesIO(data))
                if symlink:
                    info=tarfile.TarInfo("un-enlace-peligroso")
                    info.type=tarfile.SYMTYPE
                    info.linkname="../supabase-full.dump"
                    tar.addfile(info)
        pack("correct.tar.gz",payload)
        assert verify_archive_contents(base/"correct.tar.gz")=={
            "objects_r2":0,"objects_supabase":1,"files_checked":4}
        cases=[
            ("corrupt.tar.gz",{**payload,"supabase-storage/logo.png":b"alterado"},False),
            ("missing.tar.gz",{k:v for k,v in payload.items()
                              if k!="supabase-storage/logo.png"},False),
            ("extra.tar.gz",{**payload,"r2/no-autorizado.png":b"no existe"},False),
            ("symlink.tar.gz",payload,True)
        ]
        for name,files,symlink in cases:
            pack(name,files,symlink)
            try:
                verify_archive_contents(base/name)
                raise AssertionError("Se aceptó respaldo inseguro: "+name)
            except RuntimeError:
                pass

def synthetic_self_test() -> None:
    with tempfile.TemporaryDirectory() as d:
        base=Path(d)
        listing="\n".join(
            f"100; 1259 123456 TABLE DATA {sch} {name} qa"
            for sch,names in REQUIRED_PG.items() for name in names)
        schema="\n".join("CREATE TABLE "+name+(
            "(id TEXT,points INTEGER DEFAULT 0,visits INTEGER DEFAULT 0);"
            if name=="profiles" else "(id TEXT);")
            for name in sorted(REQUIRED_D1))
        schema+="\n"+"\n".join(
            "INSERT INTO profiles(id,points,visits) VALUES ('fake"
            +str(i)+"',10,1);" for i in range(6))
        storage=base/"supabase-storage"
        storage.mkdir()
        items=[{"Key":"logo"+str(i)+".png","Size":3} for i in range(3)]
        for x in items:
            (storage/x["Key"]).write_bytes(b"ABC")
        result=verify_backup(listing,schema,{"Contents":items,"IsTruncated":False},storage)
        assert result=={"d1_profiles":6,"d1_points":60,"d1_visits":6,
                        "r2_objects":0,"supabase_storage_objects":3}
        try:
            verify_supabase_storage({"Contents":items[:-1],"IsTruncated":False},storage)
            raise AssertionError("No se detectaron archivos Supabase faltantes")
        except RuntimeError:
            pass
        # No aceptar como backup total tres entradas con solo dos claves
        # únicas; ni un listado que AWS indica como incompleto.
        for bad_inventory in (
            {"Contents":[items[0],items[1],items[0]],"IsTruncated":False},
            {"Contents":items,"IsTruncated":True},
            {"Contents":items},
        ):
            try:
                verify_supabase_storage(bad_inventory,storage)
                raise AssertionError("Se aceptó Storage truncado o duplicado")
            except RuntimeError:
                pass
        try:
            verify_supabase_storage({"Contents":items+[
                {"Key":"../escape.png","Size":3}],"IsTruncated":False},storage)
            raise AssertionError("Se aceptó ruta fuera de carpeta privada")
        except RuntimeError:
            pass
        try:
            verify_pg("TABLE DATA public profiles")
            raise AssertionError("No se detectaron tablas de Auth ausentes")
        except RuntimeError:
            pass
        test_archive_integrity()
    print("OK: backup cifrable con PostgreSQL, D1 y Supabase Storage; R2 retirado; datos ficticios.")

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
    """Comprobar integridad total SIN extraer ningún dato al disco."""
    with tarfile.open(archive,"r:gz") as tar:
        entries=tar.getmembers()
        if any(not (m.isfile() or m.isdir()) for m in entries):
            raise RuntimeError("Archivo contiene un enlace, dispositivo o tipo peligroso")
        members=[m for m in entries if m.isfile()]
        actual={m.name for m in members}
        if len(actual)!=len(members) or not set(FILES).issubset(actual):
            raise RuntimeError("Respaldo incompleto o ficheros duplicados")
        for name in actual:
            path=Path(name)
            if path.is_absolute() or ".." in path.parts:
                raise RuntimeError("Ruta de archivo no permitida")
        file=tar.extractfile("checksum-manifest.json")
        if file is None:
            raise RuntimeError("Falta manifiesto de integridad")
        manifest=json.load(file)
        if manifest.get("r2_mode")!="removed" or "r2" in manifest:
            raise RuntimeError("No se permite almacenar R2 retirado")
        expected=set(FILES)
        checks={}
        for name in FILES:
            if name=="checksum-manifest.json":
                continue
            digest=manifest.get(name)
            if not isinstance(digest,str) or len(digest)!=64:
                raise RuntimeError("Hash inválido para "+name)
            checks[name]=digest
        validate_metrics(manifest.get("postgres_expected"))
        originals=manifest.get("supabase-storage")
        if not isinstance(originals,dict) or not originals:
            raise RuntimeError("No hay originales de Supabase Storage en manifiesto")
        for relative,digest in originals.items():
            if (not isinstance(relative,str) or not relative or
                Path(relative).is_absolute() or ".." in Path(relative).parts
                or not isinstance(digest,str) or len(digest)!=64):
                raise RuntimeError("Ruta o huella no permitida")
            name="supabase-storage/"+relative
            if name in expected:
                raise RuntimeError("Objeto repetido")
            expected.add(name);checks[name]=digest
        if actual!=expected:
            raise RuntimeError("Objetos no declarados o ausentes en respaldo")
        for name,sha in checks.items():
            stream=tar.extractfile(name)
            if stream is None:
                raise RuntimeError("Archivo ilegible "+name)
            actual_sha=hashlib.sha256()
            for chunk in iter(lambda:stream.read(1024*1024),b""):
                actual_sha.update(chunk)
            if actual_sha.hexdigest()!=sha:
                raise RuntimeError("Archivo corrupto o modificado: "+name)
        return {"objects_r2":0,"objects_supabase":len(originals),
                "files_checked":len(checks)}

def verify_postgres_versions(env: dict) -> None:
    """Rechazar herramientas de otro major antes de generar backup privado."""
    tools={}
    for name in ("pg_dump","pg_restore","psql"):
        result=subprocess.run([name,"--version"],capture_output=True,text=True,check=True)
        match=re.search(r"PostgreSQL\)?\s+(\d+)\.",result.stdout)
        if not match:
            raise RuntimeError("No se puede verificar la versión de "+name)
        tools[name]=int(match.group(1))
    result=subprocess.run(["psql","-X","--no-psqlrc","--tuples-only","--no-align",
                           "--set=ON_ERROR_STOP=1","--command","SHOW server_version_num;"],
                          env=env,capture_output=True,text=True,check=True)
    version=result.stdout.strip()
    if not version.isdigit():
        raise RuntimeError("No se puede leer la versión del PostgreSQL de origen")
    server_major=int(version)//10000
    bad=[name for name,major in tools.items() if major!=server_major]
    if bad:
        raise RuntimeError(
            "Incompatibilidad PostgreSQL: el servidor usa versión "+
            str(server_major)+"; instalar cliente de esa misma versión "+
            "(pg_dump, pg_restore y psql). Herramientas distintas: "+", ".join(bad)
        )
    print("OK: pg_dump/pg_restore/psql coinciden con PostgreSQL de origen (major "+str(server_major)+").")

def make_archive(work: Path, out: Path) -> None:
    with tarfile.open(work/"payload.tar.gz","w:gz") as tar:
        for name in FILES:
            tar.add(work/name,arcname=name,recursive=False)
        tar.add(work/"supabase-storage",arcname="supabase-storage")
    # GPG pide clave al propietario por terminal: nunca enviarla al chat.
    run(["gpg","--quiet","--symmetric","--cipher-algo","AES256",
         "--output",str(out),str(work/"payload.tar.gz")])
    if not out.is_file() or out.stat().st_size==0:
        raise RuntimeError("No se ha generado respaldo cifrado")
    checkpath=work/"decrypted-check.tar.gz"
    run(["gpg","--quiet","--decrypt","--output",str(checkpath),str(out)])
    validation=verify_archive_contents(checkpath)
    if validation["objects_r2"]!=0 or validation["objects_supabase"]<3:
        raise RuntimeError("El respaldo no contiene los originales esperados")
    checkpath.unlink()
    out.with_suffix(out.suffix+".sha256").write_text(
        sha256_file(out)+"  "+out.name+"\n",encoding="utf8")

def perform() -> None:
    """Ejecución privada en el EQUIPO del propietario, nunca en GitHub Actions."""
    validate_environment()
    missing=[name for name in TOOLS if shutil.which(name) is None]
    if missing:
        raise RuntimeError("Instalar herramientas gratuitas: "+", ".join(missing))
    location=backup_dir()
    print("ATENCIÓN: respaldo de usuarios en archivo temporal PRIVADO.")
    print("El contenido se cifrará antes de conservarlo; NO subir a GitHub.")
    if input("Escribe RESPALDAR para continuar: ").strip()!="RESPALDAR":
        print("Cancelado sin acceder a datos.")
        return
    timestamp=datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    output=location/("bellaquitas-"+timestamp+".tar.gz.gpg")
    if output.exists():
        raise RuntimeError("No se sobrescriben copias antiguas")
    work=Path(tempfile.mkdtemp(dir=location,prefix=".provisional-"))
    try:
        pg_env=dict(os.environ,PGSSLMODE="require")
        verify_postgres_versions(pg_env)
        print("[1/4] Respaldando PostgreSQL con Auth y Storage (solo lectura)...")
        run(["pg_dump","--format=custom","--no-owner","--no-privileges",
             "--file",str(work/"supabase-full.dump")],env=pg_env)
        with (work/"pg-objects.txt").open("w",encoding="utf8") as listing:
            run(["pg_restore","--list",str(work/"supabase-full.dump")],stdout=listing)
        # Snapshot agregado de integridad. Si cambian perfiles/puntos durante
        # pg_dump, el cotejo del backup futuro fallará cerrado en vez de
        # dar por verificadas cuentas diferentes.
        expected_pg=source_postgres_metrics(pg_env)

        print("[2/4] Exportando D1 staging (sin modificarla)...")
        run(["wrangler","d1","export",DATABASE,"--remote","--output",
             str(work/"cloudflare-d1-staging.sql"),"--skip-confirmation"])

        print("[3/4] Descargando originales de Supabase Storage...")
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

        print("[4/4] Restaurando D1 en memoria, verificando ficheros y cifrando...")
        result=verify_backup((work/"pg-objects.txt").read_text(encoding="utf8"),
            (work/"cloudflare-d1-staging.sql").read_text(encoding="utf8"),
            json.loads((work/"supabase-storage-inventory.json").read_text(encoding="utf8")),
            storage_dir)
        manifest={name:sha256_file(work/name) for name in FILES
                  if name!="checksum-manifest.json"}
        manifest["r2_mode"]="removed"
        manifest["postgres_expected"]=expected_pg
        manifest["supabase-storage"]={
            str(p.relative_to(storage_dir)):sha256_file(p)
            for p in storage_dir.rglob("*") if p.is_file()}
        (work/"checksum-manifest.json").write_text(
            json.dumps(manifest,ensure_ascii=False,indent=2),encoding="utf8")
        make_archive(work,output)
        output.chmod(0o600)
        print("OK: archivo cifrado PRIVADO; D1",result["d1_profiles"],
              "perfiles; Supabase Storage",result["supabase_storage_objects"],
              "objetos; R2 eliminado (0).")
        print("Pendiente: restauración real PostgreSQL en instancia aislada.")
        print("No se ha modificado Supabase, D1, DNS ni la web pública.")
    except BaseException:
        output.unlink(missing_ok=True)
        output.with_suffix(output.suffix+".sha256").unlink(missing_ok=True)
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
            print("R2 retirado; objetos Supabase Storage verificados:",
                details["objects_supabase"])
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
