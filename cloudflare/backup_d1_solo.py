#!/usr/bin/env python3
"""Bellaquitas Fest: copia y restauración locales de Cloudflare D1, SIN otros proveedores.

--check: comprueba herramientas y destino D1, sin consultas a Internet.
--self-test: valida restauración con socios y puntos FICTICIOS, sin red.
--run: exporta D1 STAGING con Wrangler, comprueba los puntos y cifra GPG AES256.
--verify ARCHIVO.gpg: descifra en una carpeta local temporal, comprueba hashes.
--restore-local ARCHIVO.gpg DESTINO.sqlite: restaura en un SQLite nuevo y
compara cuentas y puntos, NUNCA escribe en Cloudflare ni en producción.

Ni contraseñas, tokens, URLs firmadas, perfiles ni archivos en GitHub Actions.
La copia contiene datos privados reales, requiere terminal LOCAL del dueño.
"""
from __future__ import annotations
from datetime import datetime,timezone
import hashlib
import io
import json
import os
from pathlib import Path
import shutil
import sqlite3
import subprocess
import sys
import tarfile
import tempfile
import tomllib

ROOT=Path(__file__).resolve().parent
REPO=ROOT.parent
CONFIG=ROOT/"wrangler.backup.toml"
NAME="bellaquitas-staging"
DB_ID="c7ada9c9-d397-4e22-b5b8-3fbd8d13e550"
ACCOUNT="7698bb24db010350ba4b02c36c0fbeb5"
MAX_SQL=80*1024*1024
TABLES=("profiles","auth_identity_links","auth_sessions",
        "events","rewards","promos","redemptions","activity",
        "site_content","site_drafts")
FORBIDDEN_SQL=("ATTACH DATABASE","LOAD_EXTENSION(","VACUUM INTO")

def safe_location(path: Path) -> Path:
    dest=path.expanduser().resolve()
    if dest==REPO or REPO in dest.parents:
        raise RuntimeError("La copia privada no debe guardarse en GitHub ni el proyecto")
    if any(term in str(dest).casefold() for term in
           ("onedrive","dropbox","google drive",".git")):
        raise RuntimeError("No usar carpetas sincronizadas o Git")
    return dest

def config_ok() -> None:
    values=tomllib.loads(CONFIG.read_text("utf8"))
    items=values.get("d1_databases")
    if (values.get("account_id")!=ACCOUNT or not isinstance(items,list) or
        len(items)!=1 or items[0].get("database_id")!=DB_ID or
        items[0].get("database_name")!=NAME or
        items[0].get("jurisdiction")!="eu" or
        "r2_buckets" in values or "routes" in values):
        raise RuntimeError("Configuración D1 alterada; bloqueada")
    if "wrangler" not in (shutil.which("wrangler") or ""):
        # La falta de herramienta solo bloquea --run, no --self-test.
        pass

def sha(data:bytes)->str:
    return hashlib.sha256(data).hexdigest()

def validate_sql(snapshot:bytes)->dict:
    if not isinstance(snapshot,bytes) or not snapshot or len(snapshot)>MAX_SQL:
        raise RuntimeError("Exportación D1 vacía o demasiado grande")
    sql=snapshot.decode("utf8")
    if any(x in sql.upper() for x in FORBIDDEN_SQL):
        raise RuntimeError("SQL con instrucción no admitida para restauración local")
    db=sqlite3.connect(":memory:")
    try:
        db.executescript(sql)
        found={r[0] for r in db.execute(
            "SELECT name FROM sqlite_master WHERE type='table'")}
        if not set(TABLES).issubset(found):
            raise RuntimeError("Copia D1 incompleta: faltan tablas")
        def count(query):
            return int(db.execute(query).fetchone()[0])
        metrics={
          "profiles":count("SELECT count(*) FROM profiles"),
          "admins":count("SELECT count(*) FROM profiles WHERE role='admin'"),
          "google_links":count(
             "SELECT count(*) FROM auth_identity_links WHERE provider='google'"),
          "points":count("SELECT coalesce(sum(points),0) FROM profiles"),
          "lifetime_points":count(
             "SELECT coalesce(sum(lifetime_points),0) FROM profiles"),
          "visits":count("SELECT coalesce(sum(visits),0) FROM profiles"),
          "events":count("SELECT count(*) FROM events"),
          "rewards":count("SELECT count(*) FROM rewards"),
          "redemptions":count("SELECT count(*) FROM redemptions"),
        }
        if (metrics["profiles"]<6 or metrics["admins"]<2 or
            metrics["google_links"]<6):
            raise RuntimeError("No se han conservado las seis identidades y dos admins")
        linked=count(
          "SELECT count(DISTINCT l.profile_id) FROM auth_identity_links l "
          "JOIN profiles p ON p.id=l.profile_id WHERE l.provider='google'")
        if linked!=metrics["google_links"]:
            raise RuntimeError("Duplicados o cuentas Google desvinculadas")
        if count("SELECT count(*) FROM profiles WHERE points<0 OR visits<0")!=0:
            raise RuntimeError("Saldo o visitas inválidos")
        lines=[]
        for r in db.execute("SELECT id,role,member_code,points,lifetime_points,"
                            "visits FROM profiles ORDER BY id"):
            lines.append(json.dumps(list(r),ensure_ascii=False,separators=(",",":")))
        fingerprint=sha(("\n".join(lines)+"\n").encode("utf8"))
        return {"metrics":metrics,"profile_sha256":fingerprint}
    finally:
        db.close()

def make_bundle(snapshot:bytes)->bytes:
    verified=validate_sql(snapshot)
    manifest={
      "format":"bellaquitas-cloudflare-d1-v1",
      "created_at":datetime.now(timezone.utc).isoformat(),
      "database_id":DB_ID,
      "snapshot_sha256":sha(snapshot),
      **verified,
    }
    payload=json.dumps(manifest,sort_keys=True,ensure_ascii=False).encode("utf8")
    out=io.BytesIO()
    with tarfile.open(fileobj=out,mode="w:gz") as tar:
        for name,data in (("snapshot.sql",snapshot),("manifest.json",payload)):
            entry=tarfile.TarInfo(name);entry.size=len(data);entry.mode=0o600
            tar.addfile(entry,io.BytesIO(data))
    return out.getvalue()

def verify_bundle(binary:bytes)->tuple[bytes,dict]:
    try:
        with tarfile.open(fileobj=io.BytesIO(binary),mode="r:gz") as tar:
            members=tar.getmembers()
            if len(members)!=2 or {x.name for x in members}!={"snapshot.sql","manifest.json"}:
                raise RuntimeError("Archivo incompleto o con contenido adicional")
            if any(not x.isfile() for x in members):
                raise RuntimeError("El respaldo contiene enlaces no permitidos")
            sqlentry=tar.extractfile("snapshot.sql")
            infoentry=tar.extractfile("manifest.json")
            if not sqlentry or not infoentry:
                raise RuntimeError("Faltan objetos del respaldo")
            snapshot=sqlentry.read(MAX_SQL+1)
            manifest=json.loads(infoentry.read(65536))
    except (tarfile.TarError,ValueError) as e:
        raise RuntimeError("Archivo de backup inválido") from e
    if (manifest.get("database_id")!=DB_ID or
        manifest.get("format")!="bellaquitas-cloudflare-d1-v1" or
        manifest.get("snapshot_sha256")!=sha(snapshot)):
        raise RuntimeError("El origen o SHA-256 del respaldo no coincide")
    checked=validate_sql(snapshot)
    if manifest.get("metrics")!=checked["metrics"] or (
        manifest.get("profile_sha256")!=checked["profile_sha256"]):
        raise RuntimeError("Cuentas, puntos o identidades no coinciden")
    return snapshot,manifest

def local_required() -> None:
    if os.getenv("CI") or os.getenv("GITHUB_ACTIONS") or not sys.stdin.isatty():
        raise RuntimeError("Solo en terminal privada; nunca GitHub Actions")
    if not shutil.which("gpg"):
        raise RuntimeError("Instalar GPG gratuito en el equipo privado")

def decrypt_file(file:Path,folder:Path)->bytes:
    decrypted=folder/"plain.tar.gz"
    subprocess.run(["gpg","--quiet","--decrypt","--output",str(decrypted),
                    str(file)],check=True)
    return decrypted.read_bytes()

def run() -> None:
    local_required()
    config_ok()
    if not shutil.which("wrangler"):
        raise RuntimeError("Se necesita Wrangler instalado en el equipo privado")
    if not os.getenv("CLOUDFLARE_API_TOKEN"):
        raise RuntimeError("Configurar token Cloudflare privado SOLO en este equipo")
    location=os.getenv("BELLAQUITAS_BACKUP_DIR")
    if not location:
        raise RuntimeError("Definir BELLAQUITAS_BACKUP_DIR fuera de GitHub/OneDrive")
    folder=safe_location(Path(location))
    folder.mkdir(parents=True,exist_ok=True)
    try:folder.chmod(0o700)
    except OSError:pass
    if input("Escribe COPIA_D1_LOCAL para continuar: ").strip()!="COPIA_D1_LOCAL":
        raise RuntimeError("Cancelado sin exportar datos")
    name="bellaquitas-d1-"+datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")+".tar.gz.gpg"
    target=folder/name
    if target.exists():raise RuntimeError("No sobrescribir un respaldo existente")
    with tempfile.TemporaryDirectory(dir=folder,prefix=".d1-encrypt-") as tmp:
        temp=Path(tmp)
        source=temp/"snapshot.sql"
        subprocess.run([
            "wrangler","d1","export",NAME,"--remote","--config",
            str(CONFIG),"--output",str(source),"--skip-confirmation"
        ],check=True)
        snapshot=source.read_bytes()
        bundle=make_bundle(snapshot)
        tarpath=temp/"bundle.tar.gz";tarpath.write_bytes(bundle)
        subprocess.run(["gpg","--quiet","--symmetric","--cipher-algo","AES256",
                        "--output",str(target),str(tarpath)],check=True)
        if not target.is_file() or target.stat().st_size<100:
            raise RuntimeError("GPG no cifró la copia")
        verify_bundle(decrypt_file(target,temp))
        target.chmod(0o600)
        (folder/(name+".sha256")).write_text(sha(target.read_bytes())+"\n","utf8")
        print("OK: D1 cifrado, íntegro y verificado; original intacto")
        print("Copiar el .gpg a un segundo dispositivo privado y probar restauración")

def verify(file:Path,restore:Path|None=None)->None:
    local_required()
    archive=safe_location(file)
    if archive.is_symlink() or not archive.is_file() or not archive.name.endswith(".gpg"):
        raise RuntimeError("Se necesita un .gpg auténtico de una carpeta privada")
    destination=safe_location(restore) if restore else None
    if destination and (destination.exists() or destination.suffix!=".sqlite"):
        raise RuntimeError("El destino SQLite debe ser nuevo, no puede sobrescribirse")
    with tempfile.TemporaryDirectory(dir=archive.parent,prefix=".d1-verify-") as temp:
        snapshot,manifest=verify_bundle(decrypt_file(archive,Path(temp)))
        if destination:
            if input("Escribe RESTAURAR_SOLO_LOCAL: ").strip()!="RESTAURAR_SOLO_LOCAL":
                raise RuntimeError("Cancelado sin restaurar")
            db=sqlite3.connect(destination)
            try:
                db.executescript(snapshot.decode("utf8"))
                db.commit()
            except:
                db.close()
                destination.unlink(missing_ok=True)
                raise
            finally:
                try:db.close()
                except:pass
            # Verificación por la misma fuente SQL: integridad del archivo
            # creado y comparación de métricas con el manifiesto.
            restored=sqlite3.connect(destination)
            try:
                rows=restored.iterdump()
                check=validate_sql(("\n".join(rows)+"\n").encode("utf8"))
            finally:restored.close()
            if check["metrics"]!=manifest["metrics"] or (
                check["profile_sha256"]!=manifest["profile_sha256"]):
                destination.unlink(missing_ok=True)
                raise RuntimeError("Restauración incorrecta: diferencias en cuentas/puntos")
            destination.chmod(0o600)
            print("OK: restauración SQLite PRIVADA validada; sin escrituras Cloudflare")
        else:
            print("OK: GPG íntegro, seis identidades Google y saldos verificados")

def self_test()->None:
    sql="""
    CREATE TABLE profiles(id TEXT PRIMARY KEY,role TEXT,member_code TEXT,
      points INTEGER,lifetime_points INTEGER,visits INTEGER);
    CREATE TABLE auth_identity_links(profile_id TEXT,provider TEXT,provider_subject TEXT);
    CREATE TABLE auth_sessions(token_hash TEXT);
    CREATE TABLE events(id TEXT); CREATE TABLE rewards(id TEXT);
    CREATE TABLE promos(id TEXT); CREATE TABLE redemptions(id TEXT);
    CREATE TABLE activity(id TEXT); CREATE TABLE site_content(key TEXT);
    CREATE TABLE site_drafts(key TEXT);
    """
    for i in range(6):
        sql+=("INSERT INTO profiles VALUES('f"+str(i)+"','"+
              ("admin" if i<2 else "socio")+"','QR"+str(i)+"',"+
              str(i+10)+","+str(i+20)+",1);\n")
        sql+=("INSERT INTO auth_identity_links VALUES('f"+str(i)+
              "','google','fictional-"+str(i)+"');\n")
    binary=make_bundle(sql.encode("utf8"))
    snapshot,manifest=verify_bundle(binary)
    assert manifest["metrics"]["profiles"]==6
    assert manifest["metrics"]["admins"]==2
    assert manifest["metrics"]["google_links"]==6
    assert manifest["metrics"]["points"]==75
    assert sha(snapshot)==manifest["snapshot_sha256"]
    try:
        verify_bundle(binary.replace(b"fictional",b"tampered!"))
        raise AssertionError("No se detectó archivo alterado")
    except RuntimeError:pass
    print("OK: respaldo/restauración lógica D1 con seis cuentas inventadas")
    print("Ningún servicio remoto ha sido consultado")

def main() ->None:
    config_ok()
    args=sys.argv[1:]
    if args==["--self-test"]:self_test()
    elif args==["--check"]:
        print("Config D1 staging correcta, nunca R2")
        print("Wrangler:",bool(shutil.which("wrangler")),"GPG:",bool(shutil.which("gpg")))
    elif args==["--run"]:run()
    elif len(args)==2 and args[0]=="--verify":verify(Path(args[1]))
    elif len(args)==3 and args[0]=="--restore-local":
        verify(Path(args[1]),Path(args[2]))
    else:
        raise RuntimeError("Uso: --check | --self-test | --run | "
          "--verify ARCHIVO.gpg | --restore-local ARCHIVO.gpg NUEVO.sqlite")

if __name__=="__main__":
    try:main()
    except Exception as exc:
        print("BLOQUEADO:",type(exc).__name__,str(exc)[:220],file=sys.stderr)
        raise SystemExit(1)
