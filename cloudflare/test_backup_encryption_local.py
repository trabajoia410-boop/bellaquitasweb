#!/usr/bin/env python3
"""QA: cifrado GPG + descifrado + hash SHA-256, todo en datos inventados.

Sin cuentas, credenciales, archivos privados, servicios pagos ni red.
"""
from __future__ import annotations
import hashlib, importlib.util, json, os, pathlib, subprocess, tarfile, tempfile, io

here=pathlib.Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location("bellbackup",here/"backup_privado_local.py")
backup=importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)

with tempfile.TemporaryDirectory(prefix="bellaquitas-qa-gpg-") as temp:
    root=pathlib.Path(temp)
    files={
        "supabase-full.dump":b"PGDMPdatos sinteticos solamente",
        "cloudflare-d1-staging.sql":b"CREATE TABLE profiles(id TEXT);",
        "supabase-storage-inventory.json":json.dumps({"Contents":[{"Key":"logo.png","Size":7}]}).encode(),
        "supabase-storage/logo.png":b"IMAGEN7",
    }
    hashes={key:hashlib.sha256(value).hexdigest() for key,value in files.items()}
    manifest={
        "supabase-full.dump":hashes["supabase-full.dump"],
        "cloudflare-d1-staging.sql":hashes["cloudflare-d1-staging.sql"],
        "supabase-storage-inventory.json":hashes["supabase-storage-inventory.json"],
        "r2_mode":"removed",
        "postgres_expected":{
            "profiles":2,"points":23,"lifetime_points":40,"visits":1,
            "admins":1,"auth_users":2,"auth_identities":2,
            "auth_sessions":1,"storage_objects":1
        },
        "supabase-storage":{"logo.png":hashes["supabase-storage/logo.png"]},
    }
    files["checksum-manifest.json"]=json.dumps(manifest).encode()
    original=root/"fake-backup.tar.gz"
    with tarfile.open(original,"w:gz") as tar:
        for name,data in files.items():
            item=tarfile.TarInfo(name)
            item.size=len(data)
            tar.addfile(item,io.BytesIO(data))
    password="SOLO-CLAVE-FICTICIA-DE-CI"
    env=dict(os.environ,GNUPGHOME=str(root/"gpg-home"))
    pathlib.Path(env["GNUPGHOME"]).mkdir(mode=0o700)
    encrypted=root/"fake-backup.tar.gz.gpg"
    subprocess.run(["gpg","--quiet","--batch","--yes","--pinentry-mode","loopback",
                    "--passphrase",password,"--symmetric","--cipher-algo","AES256",
                    "--output",str(encrypted),str(original)],env=env,check=True,capture_output=True)
    assert encrypted.exists() and encrypted.stat().st_size>0
    restored=root/"restored.tar.gz"
    subprocess.run(["gpg","--quiet","--batch","--yes","--pinentry-mode","loopback",
                    "--passphrase",password,"--decrypt","--output",str(restored),
                    str(encrypted)],env=env,check=True,capture_output=True)
    assert hashlib.sha256(restored.read_bytes()).digest()==hashlib.sha256(original.read_bytes()).digest()
    details=backup.verify_archive_contents(restored)
    assert details == {"objects_r2":0,"objects_supabase":1,"files_checked":4},details
    print("OK: cifrado GPG AES256 y descifrado completo con archivo FICTICIO")
    print("OK: 4 hashes SHA-256 comprobados; R2 eliminado, originales en Supabase Storage")
    wrong=subprocess.run(["gpg","--quiet","--batch","--yes","--pinentry-mode","loopback",
                    "--passphrase","CLAVE-ERRONEA-DE-CI","--decrypt",
                    "--output",str(root/"wrong.tar.gz"),str(encrypted)],
                    env=env,capture_output=True)
    assert wrong.returncode!=0,"Se aceptó descifrado con contraseña equivocada"
    print("OK: una contraseña GPG incorrecta no permite recuperar la copia")
