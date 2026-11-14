#!/usr/bin/env python3
"""Prueba CI sintética, SIN credenciales ni exportación D1 auténtica.

La configuración de respaldo siempre debe apuntar EXCLUSIVAMENTE al
staging preexistente; nunca a una base real ni un bucket R2.
"""
from pathlib import Path
import tomllib

folder=Path(__file__).resolve().parent
config=tomllib.loads((folder/"wrangler.backup.toml").read_text("utf8"))
assert config["name"]=="bellaquitas-backup-readonly-qa"
assert config["account_id"]=="7698bb24db010350ba4b02c36c0fbeb5"
assert "routes" not in config and "workers_dev" not in config
assert "r2_buckets" not in config and "kv_namespaces" not in config
assert "vars" not in config and "secrets" not in config
d1=config["d1_databases"]
assert len(d1)==1
assert d1[0]["binding"]=="DB"
assert d1[0]["database_name"]=="bellaquitas-staging"
assert d1[0]["database_id"]=="c7ada9c9-d397-4e22-b5b8-3fbd8d13e550"
assert d1[0]["jurisdiction"]=="eu"
backup=(folder/"backup_privado_local.py").read_text("utf8")
assert "wrangler.backup.toml" in backup
assert 'run(["wrangler","d1","export",DATABASE,"--remote"' in backup
assert '"--config",str(config)' in backup
assert "wrangler\",\"deploy" not in backup
print("OK: backup apunta a D1 staging exacta, sin R2, routes ni secrets.")
print("OK: exportación remota explícita; ninguna publicación a Cloudflare.")
