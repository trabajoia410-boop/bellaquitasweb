#!/usr/bin/env python3
"""Bellaquitas Fest - ensayo REAL de pg_dump/pg_restore SOLO en PostgreSQL ficticio.

Prohibido conectar a Supabase o a un servidor que no sea localhost.
Se crean dos DB efímeras identificadas como fake; no se exporta un solo dato real.
"""
from __future__ import annotations

import os
import re
from pathlib import Path
import subprocess
import sys
import tempfile

HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
from backup_privado_local import REQUIRED_PG,verify_pg

SRC="bellaquitas_fake_source"
DST="bellaquitas_fake_restore"

def require_local() -> None:
    if os.getenv("BELLAQUITAS_FAKE_RESTORE")!="yes":
        raise RuntimeError("Ejecución bloqueada sin BELLAQUITAS_FAKE_RESTORE=yes")
    if os.getenv("PGHOST") not in ("127.0.0.1","localhost"):
        raise RuntimeError("Solo se admiten bases de datos ficticias en localhost")
    if os.getenv("PGPORT")!="5432" or os.getenv("PGUSER")!="bellaquitas_fake":
        raise RuntimeError("Usuario/puerto deben ser los ficticios de CI")
    if os.getenv("PGDATABASE")!="postgres":
        raise RuntimeError("Solo se admite la base administrativa ficticia postgres")
    if os.getenv("GITHUB_ACTIONS")!="true":
        raise RuntimeError("Este ensayo solo se permite en GitHub Actions aislado")

def command(args: list[str],*,query: str|None=None) -> str:
    result=subprocess.run(args,input=query,text=True,capture_output=True,check=True)
    return result.stdout.strip()

def sql(db: str,stmt: str) -> str:
    return command(["psql","-X","--set=ON_ERROR_STOP=1","--no-align","--tuples-only",
                    "--dbname",db],query=stmt)

def build_schema() -> str:
    statements=["CREATE SCHEMA auth;","CREATE SCHEMA storage;"]
    for schema,tables in REQUIRED_PG.items():
        for name in tables:
            if schema=="public" and name=="profiles":
                statement=("CREATE TABLE public.profiles (id text PRIMARY KEY, role text NOT NULL,"
                           " points integer NOT NULL DEFAULT 0, visits integer NOT NULL DEFAULT 0);")
            else:
                statement=f"CREATE TABLE {schema}.{name} (id text PRIMARY KEY, note text);"
            statements.append(statement)
    # Datos de prueba deliberadamente falsos; no hay emails ni tokens reales.
    statements += [
        "INSERT INTO public.profiles(id,role,points,visits) VALUES ('fake-admin','admin',43,2);",
        "INSERT INTO public.profiles(id,role,points,visits) VALUES ('fake-socio','socio',19,1);",
        "INSERT INTO public.events(id,note) VALUES ('fake-event','Solo ensayo sin datos reales');",
        "INSERT INTO public.activity(id,note) VALUES ('fake-activity','Ensayo de visitas');",
        "INSERT INTO public.redemptions(id,note) VALUES ('fake-redemption','Canje ficticio');",
        "INSERT INTO public.site_content(id,note) VALUES ('fake-home','Texto ficticio de portada');",
        "INSERT INTO auth.users(id,note) VALUES ('fake-auth-user','Cuenta exclusivamente ficticia');",
        "INSERT INTO auth.identities(id,note) VALUES ('fake-identity','Google simulado');",
        "INSERT INTO auth.sessions(id,note) VALUES ('fake-session','Sesión simulada');",
        "INSERT INTO auth.refresh_tokens(id,note) VALUES ('fake-refresh','Refresh ficticio');",
        "INSERT INTO storage.buckets(id,note) VALUES ('fake-bucket','Bucket ficticio');",
        "INSERT INTO storage.objects(id,note) VALUES ('fake-object','Imagen ficticia');",
    ]
    return "\n".join(statements)+"\n"

def summary(db: str) -> dict:
    result={}
    for schema,names in REQUIRED_PG.items():
        for name in names:
            count=sql(db,f"SELECT COUNT(*) FROM {schema}.{name};")
            result[f"{schema}.{name}"]=int(count)
    points=sql(db,"SELECT COUNT(*) || ':' || SUM(points) || ':' || SUM(visits) FROM public.profiles;")
    result["loyalty"]=points
    return result

def main():
    require_local()
    assert sum(map(len,REQUIRED_PG.values()))==18
    for db in (SRC,DST):
        exists=sql("postgres","SELECT COUNT(*) FROM pg_database WHERE datname='"+db+"';")
        if exists!="0":
            raise RuntimeError("Una base de ensayo ya existe; para evitar borrarla, abortar")
    sql("postgres",f"CREATE DATABASE {SRC};")
    sql("postgres",f"CREATE DATABASE {DST};")
    with tempfile.TemporaryDirectory(prefix="bellaquitas-fake-pg-") as temp:
        directory=Path(temp)
        sql(SRC,build_schema())
        original=summary(SRC)
        assert original["loyalty"]=="2:62:3",original
        dump=directory/"source-only-fake.dump"
        command(["pg_dump","--format=custom","--no-owner","--no-privileges",
                 "--file",str(dump),"--dbname",SRC])
        listing=command(["pg_restore","--list",str(dump)])
        verify_pg(listing)
        print("OK: pg_dump contiene 18 tablas públicas, de Auth y Storage")
        # Falla si alguien elimina una tabla de Auth del listado de respaldo.
        corrupted="\n".join(
            line for line in listing.splitlines()
            if not re.search(r"\bTABLE DATA\s+auth\s+sessions\s+",line)
        )
        try:
            verify_pg(corrupted)
        except RuntimeError:
            print("OK: restauración rechazada si falta auth.sessions")
        else:
            raise AssertionError("Un backup sin auth.sessions fue aceptado")
        command(["pg_restore","--exit-on-error","--no-owner","--no-privileges",
                 "--dbname",DST,str(dump)])
        restored=summary(DST)
        assert restored==original,{"before":original,"after":restored}
        assert restored["auth.users"]==1
        assert restored["auth.identities"]==1
        assert restored["auth.sessions"]==1
        assert restored["storage.objects"]==1
        assert restored["public.events"]==1
        assert restored["loyalty"]=="2:62:3"
        print("OK: pg_restore de PostgreSQL 16 completo en una base nueva y aislada")
        print("OK: 18/18 recuentos de tablas y 62 puntos / 3 visitas FICTICIOS coinciden")
        print("OK: Auth, sesiones, canjes, eventos y Storage ficticios recuperados")
        print("No se ha conectado a Supabase ni leído una cuenta de Bellaquitas Fest.")

if __name__=="__main__":
    try:
        main()
    except Exception as exc:
        print("ERROR en restauración ficticia:",str(exc)[:300],file=sys.stderr)
        raise SystemExit(1)
