#!/usr/bin/env node
// QA no destructiva, sin red, sin credenciales y sin tocar D1 ni producción.
import {readFileSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const read=(p)=>readFileSync(p,'utf8');
const raw=read('cloudflare/site-media-manifest.js');
const match=raw.match(/export const SITE_MEDIA\s*=\s*(\[[\s\S]*?\]);/);
assert.ok(match,'Inventario SITE_MEDIA no disponible');
const list=JSON.parse(match[1]);
assert.ok(list.length>=15,'Inventario incompleto');
const maxAsset=25*1024*1024;
let bytes=0, videos=0;
for(const item of list){
 assert.ok(!item.path.includes('/')&&!item.path.includes('..'),'Ruta no válida');
 const path=join('assets',item.path);
 const stat=statSync(path);
 assert.equal(stat.size,item.bytes,'Tamaño cambiado: '+path);
 assert.ok(stat.size<=maxAsset,'Supera el límite gratuito 25 MiB: '+path);
 const buffer=readFileSync(path);
 const gitBlob=createHash('sha1').update('blob '+buffer.length+'\0').update(buffer).digest('hex');
 assert.equal(gitBlob,item.gitSha1,'Archivo original modificado: '+path);
 bytes+=stat.size;
 if(item.type==='video/mp4')videos++;
}
const runtime=[
 'cloudflare/bellaquitas-api-staging.js',
 'cloudflare/web-mirror.js',
 'cloudflare/mirror-write-routes.js',
 'cloudflare/mirror-data-routes.js',
 'cloudflare/protected-routes.js'
];
for(const file of runtime){
 const body=read(file);
 assert.ok(!body.includes('env.MEDIA'),'Dependencia R2 todavía activa: '+file);
}
assert.ok(read('cloudflare/bellaquitas-api-staging.js').includes('adminConsoleRoute(request)'),'Panel no integrado en Worker');
assert.ok(read('cloudflare/auth-routes.js').includes('returnDestination==="admin"'),'Retorno OAuth admin ausente');
assert.ok(read('cloudflare/admin-console.js').includes('/administracion/'),'No existe la URL admin');
console.log('QA aprobada: '+list.length+' archivos originales / '+videos+' vídeos / '+bytes+' bytes exactos.');
console.log('Todos los recursos listados caben en Workers Static Assets Free.');
console.log('No se encontró acceso R2 en las rutas de ejecución inspeccionadas.');
console.log('Producción no modificada. Sin accesos a Supabase, R2 ni D1.');
