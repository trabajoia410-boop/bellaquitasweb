#!/usr/bin/env python3
"""Prueba local de versiones PostgreSQL, sin red ni credenciales reales."""
from __future__ import annotations
import importlib.util
from pathlib import Path
from unittest.mock import patch
import subprocess

p=Path(__file__).resolve().parent/"backup_privado_local.py"
spec=importlib.util.spec_from_file_location("bellbackup",p)
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
def simulated(client:dict[str,int],server:int):
    calls=[]
    def mock_run(args,**kwargs):
        calls.append((args,kwargs))
        executable=args[0]
        if executable in ("pg_dump","pg_restore","psql") and "--version" in args:
            return subprocess.CompletedProcess(args,0,stdout=f"{executable} (PostgreSQL) {client[executable]}.2\n",stderr="")
        if executable=="psql" and "SHOW server_version_num;" in args:
            return subprocess.CompletedProcess(args,0,stdout=f"{server*10000+11}\n",stderr="")
        raise AssertionError("Unexpected command"+repr(args))
    with patch.object(module.subprocess,"run",mock_run):
        try:
            module.verify_postgres_versions({"PGHOST":"localhost","PGUSER":"fake"})
            return True,calls
        except RuntimeError as exc:
            return False,calls

good,calls=simulated({"pg_dump":17,"pg_restore":17,"psql":17},17)
assert good and len(calls)==4
print("OK: PostgreSQL 17.11 acepta pg_dump/pg_restore/psql 17 con versiones menores distintas")
bad,calls=simulated({"pg_dump":18,"pg_restore":18,"psql":18},17)
assert not bad
print("OK: PostgreSQL 17 rechaza herramientas 18")
bad,calls=simulated({"pg_dump":16,"pg_restore":16,"psql":16},17)
assert not bad
print("OK: PostgreSQL 17 rechaza herramientas 16")
bad,calls=simulated({"pg_dump":17,"pg_restore":18,"psql":17},17)
assert not bad
print("OK: PostgreSQL 17 rechaza pg_restore de versión mayor")
bad,calls=simulated({"pg_dump":17,"pg_restore":17,"psql":16},17)
assert not bad
print("OK: PostgreSQL 17 rechaza psql de versión diferente")
print("Los cinco casos usan respuestas falsas; ninguna conexión con Supabase.")
