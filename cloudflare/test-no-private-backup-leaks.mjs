#!/usr/bin/env node
/**
 * Preflight de Bellaquitas Fest: nunca subir al repo claves privadas,
 * backups con datos de personas, contraseñas en texto ni paquetes de
 * recuperación. Sin solicitudes de red ni lectura de secretos Cloudflare.
 */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,statSync} from 'node:fs';
const files=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const forbiddenPath=/(^|\/)(?:\.env(?:\.[^/]+)?|[^/]+\.(?:pem|p12|pfx|key|kdbx|sqlite|sqlite3|db|db-journal|db-wal|age|gpg|asc|bqbk)|[^/]*(?:private[-_]?key|clave[-_]?privada|clave[-_]?recuperacion|recovery[-_]?key|backup[-_]?encrypted|respaldo[-_]?cifrado)[^/]*\.(?:zip|tar|gz|json|txt)|[^/]*(?:backup|respaldo|recuperacion)[^/]*\.(?:sql|sqlite|zip|csv))$/i;
const begin=/-----BEGIN\s+(?:RSA\s+|EC\s+|OPENSSH\s+|ENCRYPTED\s+|PGP\s+)?PRIVATE\s+KEY(?:\s+BLOCK)?-----/;
const verified=[];
for(const path of files){
 assert.ok(!forbiddenPath.test(path),'BLOQUEADO: Archivo privado o respaldo no debe estar versionado: '+path);
 if(statSync(path).size>1_200_000||/\.(?:png|jpe?g|webp|mp4|woff2?|ico|pdf|zip|gz|tar)$/i.test(path))continue;
 const data=readFileSync(path);
 if(data.includes(0))continue;
 const txt=data.toString('utf8');
 assert.ok(!begin.test(txt),'BLOQUEADO: clave privada PEM dentro del archivo '+path);
 verified.push(path);
}
assert.ok(files.length>=25,'Inventario Git incompleto');
console.log('OK: '+files.length+' archivos Git verificados; '+verified.length+' textos examinados, sin claves privadas o backups personales versionados.');
