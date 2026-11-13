#!/usr/bin/env python3
"""Pruebas de restauración privada con datos completamente inventados.

Nunca ejecuta pg_restore contra cuenta real o localhost: se simulan los
controles que bloquean un destino ajeno, una BD usada y saldos distintos.
"""
from __future__ import annotations
import copy
from unittest.mock import patch
import restore_privado_aislado as target
from backup_privado_local import validate_metrics,EXPECTED_METRICS

def rejects(fn,fragment):
    try:
        fn()
    except RuntimeError as exc:
        assert fragment in str(exc),(fragment,str(exc))
    else:
        raise AssertionError("Se permitió un caso inseguro: "+fragment)

safe={
    "PGHOST":"127.0.0.1",
    "PGPORT":"5432",
    "PGUSER":"bellaquitas_restore",
    "PGPASSWORD":"FAKE-NO-REAL-PASSWORD",
    "PGDATABASE":"bellaquitas_restore_qa20261113",
    "PGSSLMODE":"disable",
    "BELLAQUITAS_RESTORE_LOCAL_ONLY":"yes",
}
assert target.local_target(safe,require_tty=False)=="bellaquitas_restore_qa20261113"
print("OK: solo DB con prefijo bellaquitas_restore en 127.0.0.1")

for key,value,error in [
    ("PGHOST","db.vlsipvngvxcgnwrhpjgg.supabase.co","localhost"),
    ("PGHOST","not-local.example","localhost"),
    ("PGPORT","6543","localhost"),
    ("PGUSER","postgres","bellaquitas_restore"),
    ("PGUSER","postgres.vlsipvngvxcgnwrhpjgg","bellaquitas_restore"),
    ("PGDATABASE","postgres","bellaquitas_restore_"),
    ("PGDATABASE","bellaquitas-staging","bellaquitas_restore_"),
    ("PGDATABASE","bellaquitas_restore_","bellaquitas_restore_"),
    ("BELLAQUITAS_RESTORE_LOCAL_ONLY","no","confirmación local"),
    ("PGHOSTADDR","1.2.3.4","hostaddr"),
    ("PGSERVICE","prod","hostaddr"),
    ("PGSERVICEFILE","some-file","hostaddr"),
    ("CI","true","GitHub Actions"),
    ("GITHUB_ACTIONS","true","GitHub Actions"),
]:
    env={**safe,key:value}
    rejects(lambda env=env:target.local_target(env,require_tty=False),error)
assert target.local_target({**safe,"PGHOST":"localhost"},require_tty=False)
print("OK: DB reales, Supabase, servicio oculto y GitHub Actions bloqueados")

with patch.object(target,"sql",return_value="0"):
    target.require_empty_target(safe)
for result in ["1","17",""]:
    with patch.object(target,"sql",return_value=result):
        rejects(lambda:target.require_empty_target(safe),"Destino NO vacío")
print("OK: no se puede sobrescribir una BD que contenga tablas")

good={
 "profiles":2,"points":62,"lifetime_points":99,"visits":3,
 "admins":1,"auth_users":2,"auth_identities":2,
 "auth_sessions":1,"storage_objects":1
}
assert validate_metrics(good)==good
with patch.object(target,"sql",return_value=__import__("json").dumps(good)):
    target.compare_restored(good,safe)
for field in EXPECTED_METRICS:
    altered={**good,field:good[field]+1}
    with patch.object(target,"sql",return_value=__import__("json").dumps(altered)):
        rejects(lambda:target.compare_restored(good,safe),"Restauración no coincide")
for corrupt in [{}, {**good,"points":True}, {**good,"points":-1},
                {**good,"admins":3}, {**good,"admins":0}]:
    rejects(lambda corrupt=corrupt:validate_metrics(corrupt),
            "Métricas" if "admins" not in corrupt or corrupt.get("points") in (True,-1)
            else "Recuento")
print("OK: cambios de 9 métricas, incluidos puntos y Auth, detectados")
print("OK: sin conexión a PostgreSQL, Cloudflare, Supabase o cuentas reales")
