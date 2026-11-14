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
import stat
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
    """Candado EXCLUSIVO de la solución Cloudflare Workers + D1 y GitHub."""
    now=now or datetime.now(UTC)
    errors=[]
    if not isinstance(evidence,dict):
        return ["Evidencias no válidas"]
    if evidence.get("backend")!="cloudflare-d1-only":
        errors.append("Arquitectura: solo se admite Cloudflare D1, sin proveedor antiguo")
    def part(name):
        value=evidence.get(name)
        if not isinstance(value,dict):
            errors.append("Falta sección "+name)
            return {}
        return value
    def required(data,name,section):
        if data.get(name) is not True:
            errors.append(section+": falta confirmar "+name)
    def count(data,name,section):
        value=data.get(name)
        if type(value) is not int or value<0:
            errors.append(section+": falta recuento "+name)
            return None
        return value

    backup=part("backup")
    for key in ("encrypted_and_private","d1_export_real_verified",
                "d1_restore_local_real_verified","d1_profile_sha256_verified",
                "d1_google_links_verified","second_copy_verified",
                "r2_bucket_absent_verified","github_assets_hashes_verified"):
        required(backup,key,"Respaldo")
    if backup.get("r2_mode")!="removed":
        errors.append("Respaldo: R2 fue eliminado; no puede volver a activarse")
    if backup.get("source")!="cloudflare-d1":
        errors.append("Respaldo: solo se acepta exportación de Cloudflare D1")
    checksum=backup.get("archive_sha256")
    if not isinstance(checksum,str) or not re.fullmatch(r"[a-fA-F0-9]{64}",checksum):
        errors.append("Respaldo: falta SHA-256 del archivo cifrado")
    if not recent(backup.get("created_at"),MAX_BACKUP_AGE,now):
        errors.append("Respaldo: copia auténtica debe tener menos de 48 horas")
    source_count=count(backup,"source_profile_count","Respaldo")
    restored_count=count(backup,"restored_profile_count","Respaldo")
    if source_count is not None and restored_count!=source_count:
        errors.append("Respaldo: perfiles restaurados no coinciden")
    source_points=count(backup,"source_points","Respaldo")
    restored_points=count(backup,"restored_points","Respaldo")
    if source_points is not None and source_points!=restored_points:
        errors.append("Respaldo: puntos restaurados no coinciden")
    source_links=count(backup,"source_google_links","Respaldo")
    restored_links=count(backup,"restored_google_links","Respaldo")
    if source_links is not None and (source_links<6 or restored_links!=source_links):
        errors.append("Respaldo: identidades Google incompletas")

    reconciliation=part("reconciliation")
    if not recent(reconciliation.get("checked_at"),MAX_RECONCILIATION_AGE,now):
        errors.append("Conciliación: pruebas demasiado antiguas")
    pairs=(("source_profiles","target_profiles","perfiles"),
           ("source_points","target_points","puntos"),
           ("source_visits","target_visits","visitas"),
           ("source_lifetime_points","target_lifetime_points","puntos históricos"))
    for left,right,label in pairs:
        a=count(reconciliation,left,"Conciliación")
        b=count(reconciliation,right,"Conciliación")
        if a is not None and b is not None and a!=b:
            errors.append("Conciliación: difieren "+label)
    for key in ("no_real_test_mutations","all_six_real_profiles_preserved",
                "test_profile_excluded","original_public_files_sha_verified",
                "translations_and_videos_parity_verified",
                "legacy_external_media_urls_absent_verified",
                "public_frontend_cloudflare_only_verified",
                "admin_frontend_cloudflare_only_verified"):
        required(reconciliation,key,"Conciliación")

    auth=part("authentication")
    if auth.get("admin_login_method")!="google-d1":
        errors.append("Autenticación: solo se permite Google OAuth y sesiones D1")
    if count(auth,"google_linked_profiles","Autenticación")!=6:
        errors.append("Autenticación: deben conservarse exactamente 6 vinculaciones")
    if count(auth,"existing_admin_accounts","Autenticación")!=2:
        errors.append("Autenticación: faltan los dos administradores originales")
    if count(auth,"admins_with_real_google_login","Autenticación")!=2:
        errors.append("Autenticación: faltan dos pruebas Google reales")
    for key in ("google_oidc_signature_nonce_pkce_verified",
                "google_subject_to_existing_id_verified",
                "d1_session_method_column_verified",
                "d1_admin_sso_table_verified",
                "sso_login_and_logout_real_verified",
                "admin_role_denial_real_verified",
                "member_and_door_roles_verified",
                "same_origin_bellaquitas_fr_verified",
                "no_external_identity_service_in_runtime",
                "password_accounts_transition_verified",
                "all_login_methods_covered_without_fees",
                "no_duplicate_or_reset_loyalty_accounts",
                "free_worker_cpu_verified"):
        required(auth,key,"Autenticación")

    costs=part("costs")
    for key in ("workers_free_plan_verified","d1_free_plan_verified",
                "worker_under_free_daily_limits_verified",
                "d1_under_free_daily_limits_verified",
                "no_r2_binding_or_usage_verified",
                "no_paid_email_service_verified",
                "zero_cost_runtime_guard_verified",
                "worker_fail_closed_verified",
                "no_automatic_paid_upgrade_verified",
                "all_billing_sources_reviewed"):
        required(costs,key,"Costes")
    if not recent(costs.get("checked_at"),MAX_PRICING_AGE,now):
        errors.append("Costes: verificar cuotas y facturas de los últimos 14 días")

    rollback=part("rollback")
    for key in ("d1_rollback_snapshot_restored",
                "github_pages_unchanged",
                "cutover_writes_plan_rehearsed",
                "dns_and_domain_ready",
                "admin_login_fallback_verified",
                "site_design_unchanged"):
        required(rollback,key,"Reversión")

    owner=part("authorization")
    if owner.get("scope")!="phase6-cloudflare-d1-only" or owner.get("explicit_permission") is not True:
        errors.append("Autorización: el propietario no ha aprobado el corte Cloudflare D1")
    if not recent(owner.get("authorized_at"),MAX_APPROVAL_AGE,now):
        errors.append("Autorización: aprobación ausente o caducada")
    return errors

# Prohibido incluir PII, tokens, contraseñas o exportaciones en las evidencias.
# El comprobador solo consume indicadores estrictamente definidos.
# Solo métricas anónimas; jamás incluir nombres, tokens, passwords o IDs.
ALLOWED_EVIDENCE_FIELDS = {
    "backend":set(),
    "backup":{
        "encrypted_and_private","d1_export_real_verified",
        "d1_restore_local_real_verified","d1_profile_sha256_verified",
        "d1_google_links_verified","second_copy_verified",
        "r2_bucket_absent_verified","github_assets_hashes_verified",
        "r2_mode","source","archive_sha256","created_at",
        "source_profile_count","restored_profile_count",
        "source_points","restored_points",
        "source_google_links","restored_google_links",
    },
    "reconciliation":{
        "checked_at","source_profiles","target_profiles",
        "source_points","target_points","source_visits","target_visits",
        "source_lifetime_points","target_lifetime_points",
        "no_real_test_mutations","all_six_real_profiles_preserved",
        "test_profile_excluded","original_public_files_sha_verified",
        "translations_and_videos_parity_verified",
        "legacy_external_media_urls_absent_verified",
        "public_frontend_cloudflare_only_verified",
        "admin_frontend_cloudflare_only_verified",
    },
    "authentication":{
        "admin_login_method","google_linked_profiles",
        "existing_admin_accounts","admins_with_real_google_login",
        "google_oidc_signature_nonce_pkce_verified",
        "google_subject_to_existing_id_verified",
        "d1_session_method_column_verified","d1_admin_sso_table_verified",
        "sso_login_and_logout_real_verified",
        "admin_role_denial_real_verified",
        "member_and_door_roles_verified",
        "same_origin_bellaquitas_fr_verified",
        "no_external_identity_service_in_runtime",
        "password_accounts_transition_verified",
        "all_login_methods_covered_without_fees",
        "no_duplicate_or_reset_loyalty_accounts","free_worker_cpu_verified",
    },
    "costs":{
        "workers_free_plan_verified","d1_free_plan_verified",
        "worker_under_free_daily_limits_verified",
        "d1_under_free_daily_limits_verified",
        "no_r2_binding_or_usage_verified","no_paid_email_service_verified",
        "zero_cost_runtime_guard_verified","worker_fail_closed_verified",
        "no_automatic_paid_upgrade_verified",
        "all_billing_sources_reviewed","checked_at",
    },
    "rollback":{
        "d1_rollback_snapshot_restored","github_pages_unchanged",
        "cutover_writes_plan_rehearsed","dns_and_domain_ready",
        "admin_login_fallback_verified","site_design_unchanged",
    },
    "authorization":{"scope","explicit_permission","authorized_at"},
}

def reject_unexpected_evidence_fields(evidence: object) -> None:
    """Rechazar claves inesperadas sin reflejar nunca sus nombres ni valores."""
    if not isinstance(evidence, dict):
        raise RuntimeError("Las evidencias deben ser un objeto")
    if set(evidence) - set(ALLOWED_EVIDENCE_FIELDS):
        raise RuntimeError("Sección de evidencia no permitida; no incluir datos personales")
    for area, allowed in ALLOWED_EVIDENCE_FIELDS.items():
        section = evidence.get(area)
        if isinstance(section, dict) and set(section) - allowed:
            raise RuntimeError(
                "Se detectaron campos no permitidos en " + area +
                "; no incluir contraseñas, emails, identificadores ni tokens"
            )

def safe_load_file(filename: str) -> dict:
    original = Path(filename).expanduser()
    if original.is_symlink():
        raise RuntimeError("No se admiten evidencias privadas mediante enlaces simbólicos")
    file = original.resolve()
    if file == REPO or REPO in file.parents:
        raise RuntimeError("Las pruebas reales, fechas y evidencias deben quedar FUERA del repositorio público")
    # Abrir sin seguir enlaces simbólicos (si el sistema admite O_NOFOLLOW) y
    # comprobar permisos sobre el descriptor YA abierto, evitando carreras stat/open.
    flags = os.O_RDONLY | getattr(os, "O_CLOEXEC", 0) | getattr(os, "O_NOFOLLOW", 0)
    fd = os.open(file, flags)
    try:
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode):
            raise RuntimeError("Las evidencias deben ser un archivo privado normal")
        if info.st_size > 100_000:
            raise RuntimeError("Archivo de evidencia demasiado grande; no incluir datos personales")
        if os.name == "posix":
            if info.st_uid != os.getuid() or info.st_mode & 0o077:
                raise RuntimeError(
                    "Archivo de evidencias no privado: debe pertenecer al usuario y tener permisos 0600"
                )
        with os.fdopen(fd, "r", encoding="utf8") as handle:
            fd = -1
            evidence = json.load(handle)
    finally:
        if fd >= 0:
            os.close(fd)
    reject_unexpected_evidence_fields(evidence)
    return evidence

def make_synthetic(now: datetime) -> dict:
    stamp=now.isoformat()
    return {
        "backend":"cloudflare-d1-only",
        "backup":{
            "encrypted_and_private":True,"d1_export_real_verified":True,
            "d1_restore_local_real_verified":True,
            "d1_profile_sha256_verified":True,"d1_google_links_verified":True,
            "second_copy_verified":True,"r2_bucket_absent_verified":True,
            "github_assets_hashes_verified":True,
            "r2_mode":"removed","source":"cloudflare-d1",
            "archive_sha256":"a"*64,"created_at":stamp,
            "source_profile_count":7,"restored_profile_count":7,
            "source_points":91,"restored_points":91,
            "source_google_links":6,"restored_google_links":6,
        },
        "reconciliation":{
            "checked_at":stamp,
            "source_profiles":6,"target_profiles":6,
            "source_points":91,"target_points":91,
            "source_visits":2,"target_visits":2,
            "source_lifetime_points":120,"target_lifetime_points":120,
            **{x:True for x in (
                "no_real_test_mutations","all_six_real_profiles_preserved",
                "test_profile_excluded","original_public_files_sha_verified",
                "translations_and_videos_parity_verified",
                "legacy_external_media_urls_absent_verified",
                "public_frontend_cloudflare_only_verified",
                "admin_frontend_cloudflare_only_verified"
            )}
        },
        "authentication":{
            "admin_login_method":"google-d1",
            "google_linked_profiles":6,"existing_admin_accounts":2,
            "admins_with_real_google_login":2,
            **{x:True for x in (
                "google_oidc_signature_nonce_pkce_verified",
                "google_subject_to_existing_id_verified",
                "d1_session_method_column_verified",
                "d1_admin_sso_table_verified",
                "sso_login_and_logout_real_verified",
                "admin_role_denial_real_verified",
                "member_and_door_roles_verified",
                "same_origin_bellaquitas_fr_verified",
                "no_external_identity_service_in_runtime",
                "password_accounts_transition_verified",
                "all_login_methods_covered_without_fees",
                "no_duplicate_or_reset_loyalty_accounts",
                "free_worker_cpu_verified"
            )}
        },
        "costs":{
            "checked_at":stamp,
            **{x:True for x in (
                "workers_free_plan_verified","d1_free_plan_verified",
                "worker_under_free_daily_limits_verified",
                "d1_under_free_daily_limits_verified",
                "no_r2_binding_or_usage_verified",
                "no_paid_email_service_verified",
                "zero_cost_runtime_guard_verified","worker_fail_closed_verified",
                "no_automatic_paid_upgrade_verified",
                "all_billing_sources_reviewed"
            )}
        },
        "rollback":{x:True for x in (
            "d1_rollback_snapshot_restored","github_pages_unchanged",
            "cutover_writes_plan_rehearsed","dns_and_domain_ready",
            "admin_login_fallback_verified","site_design_unchanged"
        )},
        "authorization":{
            "scope":"phase6-cloudflare-d1-only",
            "explicit_permission":True,
            "authorized_at":stamp,
        }
    }

def self_test() -> None:
    now=datetime(2026,11,14,11,0,tzinfo=UTC)
    good=make_synthetic(now)
    assert not validate(good,now),validate(good,now)
    assert validate({},now)
    print("OK: sin evidencia nunca se autoriza una publicación")
    mutations=[
      ("Proveedor ajeno",{"backend":"otro"},"Arquitectura"),
      ("Copia real ausente",{"backup":{"d1_export_real_verified":False}},"d1_export"),
      ("Restauración real ausente",{"backup":{"d1_restore_local_real_verified":False}},"d1_restore"),
      ("Huella de perfiles incompleta",{"backup":{"d1_profile_sha256_verified":False}},"d1_profile"),
      ("Fuente de copia no D1",{"backup":{"source":"legacy"}},"Cloudflare D1"),
      ("R2 reactivado",{"backup":{"r2_mode":"present"}},"R2"),
      ("Google perdido en copia",{"backup":{"restored_google_links":5}},"identidades Google"),
      ("Puntos perdidos en restauración",{"backup":{"restored_points":90}},"puntos"),
      ("Puntos diferentes",{"reconciliation":{"target_points":92}},"puntos"),
      ("Visitas diferentes",{"reconciliation":{"target_visits":3}},"visitas"),
      ("Puntos históricos",{"reconciliation":{"target_lifetime_points":121}},"puntos históricos"),
      ("Cuenta ficticia mezclada",{"reconciliation":{"test_profile_excluded":False}},"test_profile_excluded"),
      ("URLs de medios antiguos",{"reconciliation":{"legacy_external_media_urls_absent_verified":False}},"media"),
      ("Web conserva backend retirado",{"reconciliation":{"public_frontend_cloudflare_only_verified":False}},"public_frontend"),
      ("Panel conserva backend retirado",{"reconciliation":{"admin_frontend_cloudflare_only_verified":False}},"admin_frontend"),
      ("Login Google falso",{"authentication":{"admins_with_real_google_login":0}},"Google reales"),
      ("Sesiones D1 sin actualizar",{"authentication":{"d1_session_method_column_verified":False}},"d1_session"),
      ("Tabla admin inexistente",{"authentication":{"d1_admin_sso_table_verified":False}},"d1_admin"),
      ("Omitir seguridad Google",{"authentication":{"google_oidc_signature_nonce_pkce_verified":False}},"google_oidc"),
      ("Mismo origen ausente",{"authentication":{"same_origin_bellaquitas_fr_verified":False}},"same_origin"),
      ("Correo sin plan gratis",{"authentication":{"all_login_methods_covered_without_fees":False}},"all_login_methods"),
      ("Plan de pago habilitado",{"costs":{"no_automatic_paid_upgrade_verified":False}},"paid_upgrade"),
      ("R2 todavía vinculado",{"costs":{"no_r2_binding_or_usage_verified":False}},"no_r2"),
      ("Sin CPU comprobada",{"authentication":{"free_worker_cpu_verified":False}},"free_worker_cpu"),
      ("Sin restaurar vuelta atrás",{"rollback":{"d1_rollback_snapshot_restored":False}},"d1_rollback"),
      ("Sin permiso explícito",{"authorization":{"explicit_permission":False}},"Autorización"),
      ("Sin nueva autorización",{"authorization":{"scope":"phase6-backend-cutover"}},"Autorización"),
      ("Datos caducados",{"backup":{"created_at":"2026-01-01T00:00:00Z"}},"48 horas"),
    ]
    for name,overrides,expected in mutations:
        item=copy.deepcopy(good)
        for section,value in overrides.items():
            if isinstance(value,dict) and isinstance(item.get(section),dict):
                item[section].update(value)
            else:item[section]=value
        problems=validate(item,now)
        assert any(expected.casefold() in x.casefold() for x in problems),(name,problems)
        print("OK:",name)
    with tempfile.TemporaryDirectory() as tmp:
        file=Path(tmp)/"synthetic-evidence.json"
        file.write_text(json.dumps(good),encoding="utf8")
        file.chmod(0o600)
        assert not validate(safe_load_file(str(file)),now)
        if os.name=="posix":
            file.chmod(0o644)
            try:
                safe_load_file(str(file))
                raise AssertionError("Archivo de evidencia no privado")
            except RuntimeError:pass
            file.chmod(0o600)
        alias=Path(tmp)/"alias"
        alias.symlink_to(file)
        try:
            safe_load_file(str(alias))
            raise AssertionError("Se permitió symlink")
        except RuntimeError:pass
        fake=copy.deepcopy(good)
        fake["authentication"]["password_forbidden"]="sintetico"
        file.write_text(json.dumps(fake),encoding="utf8")
        file.chmod(0o600)
        try:
            safe_load_file(str(file))
            raise AssertionError("Se permitió secreto entre las evidencias")
        except RuntimeError:pass
    print("OK: 28 bloqueos de corte + privacidad; solo datos ficticios.")
    print("Un resultado de ensayo NUNCA equivale a autorización real.")

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
