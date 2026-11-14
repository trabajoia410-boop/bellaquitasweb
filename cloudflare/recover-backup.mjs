#!/usr/bin/env node
// Recuperación local desde el JSON privado de encrypted_archives.
// Uso: BF_BACKUP_KEY=valor node cloudflare/recover-backup.mjs archivo.json salida.sql
// NO subas el archivo descifrado ni la clave a GitHub.
import {readFileSync,writeFileSync} from 'node:fs';
import {createDecipheriv,createHash,timingSafeEqual} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
const [infile,outfile]=process.argv.slice(2);
if(!infile||!outfile)throw Error('Uso: node cloudflare/recover-backup.mjs ARCHIVO_CIFRADO.json SALIDA.sql');
const secret=process.env.BF_BACKUP_KEY;
if(!secret)throw Error('Falta BF_BACKUP_KEY, que debe conservarse fuera del repositorio.');
const key=Buffer.from(secret,'base64');
assert.equal(key.length,32,'La clave AES-256 debe medir 32 bytes');
const x=JSON.parse(readFileSync(infile,'utf8'));
const archive=x.archive??x.result?.[0]?.results?.[0]??x.results?.[0]??x;
const iv=Buffer.from(archive.iv_base64,'base64');
const full=Buffer.from(archive.ciphertext_base64,'base64');
assert.equal(iv.length,12,'Nonce incorrecto');
assert.ok(full.length>16,'Archivo incompleto');
const decipher=createDecipheriv('aes-256-gcm',key,iv);
decipher.setAuthTag(full.subarray(-16));
const packed=Buffer.concat([decipher.update(full.subarray(0,-16)),decipher.final()]);
const sql=gunzipSync(packed);
const actual=createHash('sha256').update(sql).digest();
const expected=Buffer.from(archive.plaintext_sha256,'hex');
assert.ok(expected.length===32&&timingSafeEqual(actual,expected),'SHA-256 incorrecto');
assert.equal(sql.length,archive.plaintext_bytes,'Longitud incorrecta');
assert.ok(sql.toString('utf8',0,160).includes('Bellaquitas Fest D1 SQL backup'),'Formato inesperado');
writeFileSync(outfile,sql,{flag:'wx',mode:0o600});
console.log('Copia SQL verificada y recuperada:',outfile,'bytes',sql.length);
console.log('IMPORTANTE: la copia SQL en claro contiene datos sensibles de usuarios.');
