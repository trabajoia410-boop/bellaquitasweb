#!/usr/bin/env python3
"""
Bellaquitas Fest — comprobador PREVIO AL CORTE (fase 6).
Nunca hace deployments, solicitudes web, escrituras SQL ni toca perfiles.

Se ejecuta solo con evidencia NO SENSIBLE almacenada FUERA DE GIT:
  python3 cloudflare/phase6_readiness.py --check /carpeta-privada/evidencias.json
  python3 cloudflare/phase6_readiness.py --self-test

Sin archivo de evidencias o con cualquier comprobación pendiente -> FAIL-CLOSED.
Este script no concede permisos para publicar: el propietario debe autorizar
expresamente el corte después de ver los resultados.
"""
from __future__ import annotations

from datetime import datetime, timezone, timedelta
import copy
import json
import os
from pathlib import Path
import re
import sys
import tempfile

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
UTC = timezone.utc
MAX_RECONCILIATION_AGE = timedelta(hours=24)
MAX_BACKUP_AGE = timedelta(hours=48)
MAX_PRICING_AGE = timedelta(days=14)
MAX_APPROVAL_AGE = timedelta(days=7)

def parse_date(value: object) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        instant = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return instant.astimezone(UTC) if instant.tzinfo else None
    except ValueError:
        return None

def recent(value: object, age: timedelta, now: datetime) -> bool:
    stamp = parse_date(value)
    return stamp is not None and now - age <= stamp <= now

def validate(evidence: object, now: datetime | None = None) -> list[str]:
    """Human-readable missing steps, never logs email, keys, IDs, secrets."""
    now = now or datetime.now(UTC)
    errors: list[str] = []
    if not isinstance(evidence, dict):
        return ["La evidencia no es un objeto JSON válido"]
    def part(name: str) -> dict:
        item = evidence.get(name)
        if not isinstance(item, dict):
            errors.append(f"Falta sección '{name}'")
            return {}
        return item
    def required(data: dict, field: str, area: str) -> None:
        if data.get(field) is not True:
            errors.append(f"{area}: falta confirmar '{field}'")
    def number(data: dict, field: str) -> int | None:
        value = data.get(field)
        if type(value) is not int or value < 0:
            errors.append(f"Conciliación: '{field}' debe ser un entero no negativo")
            return None
        return value

    backup = part("backup")
    required(backup,"encrypted_and_private","Respaldo")
    required(backup,"postgres_restore_tested","Respaldo")
    required(backup,"d1_restore_tested","Respaldo")
    required(backup,"r2_bytes_verified","Respaldo")
    required(backup,"supabase_storage_bytes_verified","Respaldo")
    required(backup,"second_copy_verified","Respaldo")
    checksum=backup.get("archive_sha256")
    if not isinstance(checksum,str) or not re.fullmatch(r"[a-fA-F0-9]{64}",checksum):
        errors.append("Respaldo: falta SHA-256 del archivo cifrado")
    if not recent(backup.get("created_at"),MAX_BACKUP_AGE,now):
        errors.append("Respaldo: falta una copia reciente (máximo 48 horas)")
    if type(backup.get("r2_objects")) is not int or backup["r2_objects"] < 20:
        errors.append("Respaldo: inventario R2 incompleto (al menos 20 objetos)")
    if type(backup.get("supabase_storage_objects")) is not int or backup["supabase_storage_objects"] < 3:
        errors.append("Respaldo: inventario Supabase Storage incompleto (al menos 3 objetos)")

    reconciliation=part("reconciliation")
    if not recent(reconciliation.get("checked_at"),MAX_RECONCILIATION_AGE,now):
        errors.append("Conciliación: conteos demasiado antiguos (máximo 24 horas)")
    src=number(reconciliation,"source_profiles")
    dest=number(reconciliation,"target_profiles")
    src_points=number(reconciliation,"source_points")
    dest_points=number(reconciliation,"target_points")
    src_visits=number(reconciliation,"source_visits")
    dest_visits=number(reconciliation,"target_visits")
    if src is not None and dest is not None and src != dest:
        errors.append("Conciliación: el número de perfiles difiere (retirar/excluir cuenta ficticia)")
    if src_points is not None and dest_points is not None and src_points != dest_points:
        errors.append("Conciliación: puntos de fidelidad diferentes")
    if src_visits is not None and dest_visits is not None and src_visits != dest_visits:
        errors.append("Conciliación: visitas diferentes")
    required(reconciliation,"no_real_test_mutations","Conciliación")
    required(reconciliation,"translation_and_media_parity_verified","Conciliación")

    authentication=part("authentication")
    required(authentication,"email_password_works","Autenticación")
    required(authentication,"google_and_admin_link_verified","Autenticación")
    required(authentication,"session_and_logout_verified","Autenticación")
    required(authentication,"free_cpu_or_external_auth_verified","Autenticación")
    required(authentication,"no_paid_upgrade_or_automatic_billing","Autenticación")
    if not recent(authentication.get("free_plan_checked_at"),MAX_PRICING_AGE,now):
        errors.append("Autenticación: comprobar los límites gratuitos en los últimos 14 días")
    admin_count=authentication.get("existing_admin_accounts")
    active=authentication.get("admins_with_verified_login")
    if type(admin_count) is not int or admin_count < 1 or type(active) is not int or active != admin_count:
        errors.append("Autenticación: aún hay administradores existentes sin contraseña verificada")
    required(authentication,"no_new_duplicate_admin_accounts","Autenticación")

    costs=part("costs")
    required(costs,"cloudflare_workers_and_d1_free_confirmed","Costes")
    required(costs,"r2_no_uncapped_billing_or_nonbillable_storage_verified","Costes")
    required(costs,"resend_email_free_limit_protected","Costes")
    required(costs,"all_other_meters_and_autopay_reviewed","Costes")
    required(costs,"budget_alert_not_considered_hard_cap","Costes")
    if not recent(costs.get("checked_at"),MAX_PRICING_AGE,now):
        errors.append("Costes: revisar facturación y límites dentro de 14 días")

    rollback=part("rollback")
    required(rollback,"procedure_rehearsed","Reversión")
    required(rollback,"previous_backend_retained","Reversión")
    required(rollback,"write_conflicts_plan_checked","Reversión")
    required(rollback,"dns_and_domain_ready","Reversión")
    required(rollback,"design_unchanged","Reversión")

    owner=part("authorization")
    if owner.get("scope")!="phase6-backend-cutover" or owner.get("explicit_permission") is not True:
        errors.append("Autorización: el propietario aún no ha autorizado expresamente el corte")
    if not recent(owner.get("authorized_at"),MAX_APPROVAL_AGE,now):
        errors.append("Autorización: consentimiento ausente o anterior a siete días")

    return errors

def safe_load_file(filename: str) -> dict:
    original = Path(filename).expanduser()
    if original.is_symlink():
        raise RuntimeError("No se admiten evidencias privadas mediante enlaces simbólicos")
    file = original.resolve()
    if file == REPO or REPO in file.parents:
        raise RuntimeError("Las pruebas reales, fechas y evidencias deben quedar FUERA del repositorio público")
    if not file.is_file() or file.is_symlink():
        raise RuntimeError("Falta archivo de evidencia privado o es un enlace simbólico")
    if file.stat().st_size > 100_000:
        raise RuntimeError("Archivo de evidencia excesivamente grande; no incluir datos personales")
    with file.open("r",encoding="utf8") as handle:
        return json.load(handle)

def make_synthetic(now: datetime) -> dict:
    stamp=now.isoformat()
    return {
      "backup":{
        "encrypted_and_private":True,
        "postgres_restore_tested":True,
        "d1_restore_tested":True,
        "r2_bytes_verified":True,
        "supabase_storage_bytes_verified":True,
        "second_copy_verified":True,
        "archive_sha256":"a"*64,
        "r2_objects":20,
        "supabase_storage_objects":3,
        "created_at":stamp},
      "reconciliation":{
        "checked_at":stamp,
        "source_profiles":3,"target_profiles":3,
        "source_points":40,"target_points":40,
        "source_visits":1,"target_visits":1,
        "no_real_test_mutations":True,
        "translation_and_media_parity_verified":True},
      "authentication":{
        "existing_admin_accounts":1,
        "admins_with_verified_login":1,
        "email_password_works":True,
        "google_and_admin_link_verified":True,
        "session_and_logout_verified":True,
        "free_cpu_or_external_auth_verified":True,
        "no_paid_upgrade_or_automatic_billing":True,
        "free_plan_checked_at":stamp,
        "no_new_duplicate_admin_accounts":True},
      "costs":{
        "cloudflare_workers_and_d1_free_confirmed":True,
        "r2_no_uncapped_billing_or_nonbillable_storage_verified":True,
        "resend_email_free_limit_protected":True,
        "all_other_meters_and_autopay_reviewed":True,
        "budget_alert_not_considered_hard_cap":True,
        "checked_at":stamp},
      "rollback":{
        "procedure_rehearsed":True,
        "previous_backend_retained":True,
        "write_conflicts_plan_checked":True,
        "dns_and_domain_ready":True,
        "design_unchanged":True},
      "authorization":{
        "explicit_permission":True,
        "scope":"phase6-backend-cutover",
        "authorized_at":stamp},
    }

def self_test() -> None:
    now=datetime(2026,11,12,11,0,tzinfo=UTC)
    good=make_synthetic(now)
    assert not validate(good,now),validate(good,now)
    assert any("Falta sección" in x for x in validate({},now))
    print("OK: rechazo sin ninguna evidencia")
    mutations=[
      ("Rechazo sin autorización",{"authorization":{"explicit_permission":False}},"Autorización"),
      ("Rechazo si falta restaurar PostgreSQL",{"backup":{"postgres_restore_tested":False}},"Respaldo"),
      ("Rechazo si falta Supabase Storage",{"backup":{"supabase_storage_objects":2}},"Supabase Storage"),
      ("Rechazo de la cuenta ficticia sin retirar",{"reconciliation":{"target_profiles":4}},"perfiles"),
      ("Rechazo de puntos diferentes",{"reconciliation":{"target_points":41}},"puntos"),
      ("Rechazo si el hash excede Workers Free",{"authentication":{"free_cpu_or_external_auth_verified":False}},"Autenticación"),
      ("Rechazo de administradores sin contraseña",{"authentication":{"admins_with_verified_login":0}},"administradores"),
      ("Rechazo de cambio a plan facturable",{"authentication":{"no_paid_upgrade_or_automatic_billing":False}},"no_paid_upgrade_or_automatic_billing"),
      ("Rechazo de R2 sin límite de facturación",{"costs":{"r2_no_uncapped_billing_or_nonbillable_storage_verified":False}},"r2_no_uncapped_billing"),
      ("Rechazo si solo existen alertas de presupuesto",{"costs":{"budget_alert_not_considered_hard_cap":False}},"budget_alert"),
      ("Rechazo si no se controla el correo gratuito",{"costs":{"resend_email_free_limit_protected":False}},"resend_email"),
      ("Rechazo si no se conocen los demás cargos",{"costs":{"all_other_meters_and_autopay_reviewed":False}},"all_other_meters"),
      ("Rechazo sin plan de reversión",{"rollback":{"procedure_rehearsed":False}},"Reversión"),
      ("Rechazo por evidencia antigua",{"reconciliation":{"checked_at":"2026-01-01T00:00:00Z"}},"antiguos"),
    ]
    passed=0
    for title, overrides, match in mutations:
        fixture=copy.deepcopy(good)
        for key,values in overrides.items():
            fixture[key]=values if key not in fixture else {**fixture[key],**values}
        problems=validate(fixture,now)
        assert problems and any(match.casefold() in p.casefold() for p in problems),(title,problems)
        print("OK:",title)
        passed+=1
    with tempfile.TemporaryDirectory() as temp:
        file=Path(temp)/"synthetic-evidence.json"
        file.write_text(json.dumps(good),encoding="utf8")
        assert not validate(safe_load_file(str(file)),now)
    print(f"OK: {passed+1} comprobaciones de rechazo y 2 controles positivos, solo con datos ficticios.")
    print("AVISO: pasar un fixture de ensayo NO es autorización para publicar.")

def main():
    if len(sys.argv)==2 and sys.argv[1]=="--self-test":
        self_test()
        return 0
    if len(sys.argv)==3 and sys.argv[1]=="--check":
        try:
            data=safe_load_file(sys.argv[2])
            problems=validate(data)
        except (OSError,RuntimeError,ValueError,json.JSONDecodeError) as e:
            print("NO AUTORIZADO: evidencia privada inválida",file=sys.stderr)
            return 1
        if problems:
            print(f"NO AUTORIZADO: faltan {len(problems)} condiciones de seguridad.")
            for item in problems: print(" - "+item)
            return 1
        print("PRE-CORTE: evidencias declaradas completas. REQUIERE revisión humana y autorización explícita.")
        print("El comprobador no despliega, ni garantiza que las evidencias sean verídicas.")
        return 0
    print("Uso: python3 cloudflare/phase6_readiness.py --self-test | --check /ruta-privada/evidencias.json",file=sys.stderr)
    return 2

if __name__=="__main__":
    raise SystemExit(main())
