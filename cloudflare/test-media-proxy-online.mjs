#!/usr/bin/env node
/**
 * Bellaquitas Fest: prueba HTTP REAL del proxy QA temporal en Workers.
 * NO prueba Workers Static Assets ni dispositivos físicos. No usa claves.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
// Reconfirmación tras corregir redirect:manual en Workers (versión QA aislada).
const BASE='https://bellaquitas-media-proxy-qa.bellaquitas-fest-410.workers.dev';
const SHA='733244ec58fa2d0af053bf969d25525a8f878aa2';
const request=(path,opts={})=>fetch(BASE+path,{cache:'no-store',redirect:'manual',signal:AbortSignal.timeout(45000),...opts});
const h=await request('/health');assert.equal(h.status,200);
const json=await h.json();
assert.equal(json.service,'bellaquitas-media-proxy-qa');
assert.equal(json.production,false);
assert.equal(json.mode,'temporary-github-proxy');
assert.equal(json.uploadedStaticAssets,false);
assert.equal(json.allowlistedAssets,20);
assert.equal(json.sourceCommit,SHA);
assert.equal((await request('/assets/.env')).status,404);
assert.equal((await request('/assets/no-existe.mp4')).status,404);
assert.equal((await request('/assets/logo-navbar.png',{method:'POST'})).status,405);
const manifest=JSON.parse(readFileSync('cloudflare/site-media-manifest.js','utf8').match(/export const SITE_MEDIA\s*=\s*(\[[\s\S]*?\]);/)[1]);
const videos=manifest.filter(x=>x.type==='video/mp4');
assert.equal(videos.length,5);
let ranges=0;
for(const item of videos){
 const url='/assets/'+encodeURIComponent(item.path);
 const original=readFileSync('assets/'+item.path);
 assert.equal(original.length,item.bytes);
 const head=await request(url,{method:'HEAD'});
 if(head.status!==200){
  const probe=await request(url,{headers:{Range:'bytes=0-255'}});
  const message=probe.status===206?'bytes:206':(await probe.text().catch(()=>'<unavailable>')).slice(0,180);
  console.error('Diagnóstico de origen QA: HEAD='+head.status+' RANGE='+probe.status+' causa='+message);
 }
 assert.equal(head.status,200,'Video HEAD no disponible: '+item.path);
 assert.equal(Number(head.headers.get('content-length')),item.bytes,'Tamaño HEAD cambiado: '+item.path);
 assert.equal(head.headers.get('content-type'),'video/mp4');
 for(const start of [0,item.bytes-256]){
  const last=start+255;
  const req=await request(url,{headers:{Range:'bytes='+start+'-'+last}});
  assert.equal(req.status,206,'No hay 206 en proxy: '+item.path);
  assert.equal(req.headers.get('content-range'),'bytes '+start+'-'+last+'/'+item.bytes);
  assert.equal(req.headers.get('content-type'),'video/mp4');
  assert.equal(req.headers.get('accept-ranges'),'bytes');
  assert.equal(req.headers.get('set-cookie'),null);
  const result=Buffer.from(await req.arrayBuffer());
  assert.deepEqual(result,original.subarray(start,last+1),'Byte diferente en '+item.path);
  ranges++;
 }
}
const extraFiles=manifest.filter(x=>x.type!=='video/mp4');
assert.equal(extraFiles.length,12);
for(const item of extraFiles){
 const path='/assets/'+encodeURIComponent(item.path);
 const expected=readFileSync('assets/'+item.path);
 const head=await request(path,{method:'HEAD'});
 assert.equal(head.status,200,'Recurso original ausente: '+item.path);
 // GitHub responde HEAD sin Content-Length para recursos de texto comprimibles.
 // La comprobación concluyente es descargar el GET y comparar cada byte.
 const reported=Number(head.headers.get('content-length'));
 assert.ok(reported===0||reported===item.bytes,'Tamaño HEAD inesperado: '+item.path);
 assert.equal(head.headers.get('content-type'),item.type);
 const got=await request(path);
 assert.equal(got.status,200,'Recurso original no descargable: '+item.path);
 assert.equal(got.headers.get('set-cookie'),null);
 assert.deepEqual(Buffer.from(await got.arrayBuffer()),expected,'Recurso original diferente: '+item.path);
}
const logos=JSON.parse(readFileSync('cloudflare/legacy-logos-manifest.json','utf8')).files;
assert.equal(logos.length,3);
for(const logo of logos){
 const original=readFileSync('assets/migrated-logos/'+logo.path);
 const path='/assets/migrated-logos/'+encodeURIComponent(logo.path);
 const head=await request(path,{method:'HEAD'});
 assert.equal(head.status,200,'Logo QA ausente: '+logo.path);
 assert.equal(Number(head.headers.get('content-length')),logo.bytes);
 assert.equal(head.headers.get('content-type'),logo.type);
 const got=await request(path);
 assert.equal(got.status,200);
 assert.equal(got.headers.get('set-cookie'),null);
 assert.deepEqual(Buffer.from(await got.arrayBuffer()),original,'Los bytes del logo no coinciden');
}
console.log('OK: Cloudflare Worker QA temporal + GitHub SHA fijo, 5 MP4 / '+ranges+' respuestas HTTP 206 y 3 logos y 12 archivos adicionales completos idénticos en bytes; sin R2/D1. NO son Static Assets definitivos.');
