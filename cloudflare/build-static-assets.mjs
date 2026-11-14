#!/usr/bin/env node
// Bellaquitas Fest: construir únicamente los medios originales permitidos.
// NO copiamos código de repositorio, .env, SQL, secrets ni credenciales.
import {readFileSync,createReadStream,statSync,mkdirSync,copyFileSync,rmSync} from 'node:fs';
import {join,resolve,basename} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const src=resolve('assets');
const target=resolve('cloudflare/dist-static');
const manifest=readFileSync('cloudflare/site-media-manifest.js','utf8').match(/export const SITE_MEDIA\s*=\s*(\[[\s\S]*?\]);/);
assert.ok(manifest,'Inventario original ausente');
const assets=JSON.parse(manifest[1]),maxBytes=25*1024*1024;
assert.ok(assets.length>0,'Sin archivos');
const planned=new Set();
for(const asset of assets){
 assert.equal(asset.path,basename(asset.path),'Nombre sospechoso');
 assert.ok(!asset.path.includes('..')&&!asset.path.startsWith('.'),'Ruta inválida');
 assert.ok(!planned.has(asset.path),'Archivo duplicado: '+asset.path);
 planned.add(asset.path);
 const original=join(src,asset.path);
 assert.equal(statSync(original).size,asset.bytes,'Tamaño diferente: '+asset.path);
 assert.ok(asset.bytes<=maxBytes,'Archivo excede 25 MiB: '+asset.path);
 const content=readFileSync(original);
 const sha=createHash('sha1').update('blob '+content.byteLength+'\0').update(content).digest('hex');
 assert.equal(sha,asset.gitSha1,'Huella Git distinta: '+asset.path);
}
rmSync(target,{recursive:true,force:true});
mkdirSync(join(target,'assets'),{recursive:true});
let total=0;
for(const item of assets){
 const original=join(src,item.path),destination=join(target,'assets',item.path);
 copyFileSync(original,destination);
 assert.equal(statSync(destination).size,item.bytes,'Copia incompleta: '+item.path);
 total+=item.bytes;
}
console.log('Static Assets seguros:',assets.length,'archivos;',total,'bytes idénticos al inventario Git.');
console.log('Ruta local:',target,' (no se ha desplegado ningún archivo).');
console.log('Los logos antiguos aún NO están disponibles: bloqueo antes de producción.');
