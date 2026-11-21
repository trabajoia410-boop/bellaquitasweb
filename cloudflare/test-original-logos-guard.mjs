#!/usr/bin/env node
/* Garantía de no publicar la migración con logos ajenos o incompletos.
 * No se descargan ni modifican archivos ni datos de clientes.
 */
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const manifest=JSON.parse(readFileSync('cloudflare/legacy-logos-manifest.json','utf8'));
assert.equal(manifest.files.length,3);
const paths=manifest.files.map(x=>join('assets','migrated-logos',x.path));
const missing=paths.filter(p=>!existsSync(p));
const run=spawnSync(process.execPath,['cloudflare/build-static-assets.mjs','--require-logos'],{
 encoding:'utf8',timeout:20000,maxBuffer:1024*1024
});
const logs=(run.stdout||'')+(run.stderr||'');
if(missing.length){
 assert.notEqual(run.status,0,'La publicación debe bloquearse sin los 3 logos');
 assert.match(logs,/Publicación bloqueada/i);
 console.log('OK: bloqueo preventivo de publicación por '+missing.length+' logos pendientes.');
}else{
 assert.equal(run.status,0,'Si están los 3 logos, deben pasar tamaños, firmas y ETag: '+logs.slice(-900));
 assert.match(logs,/Logos originales certificados/);
 console.log('OK: los 3 logos verificados y publicación desbloqueada.');
}
