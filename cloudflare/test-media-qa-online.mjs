#!/usr/bin/env node
/* Bellaquitas Fest: Worker media QA REAL en workers.dev.
 * Antes del upload confirma 503 (seguridad); tras upload exige HTTP Range 206 real.
 * Nunca envía datos personales ni genera puntos/sesiones.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const base='https://bellaquitas-media-qa.bellaquitas-fest-410.workers.dev';
const read=async(path,init={})=>fetch(base+path,{
 redirect:'manual',signal:AbortSignal.timeout(30000),cache:'no-store',...init
});
const health=await read('/health');
assert.equal(health.status,200,'El Worker multimedia QA debe existir');
const config=await health.json();
assert.equal(config.service,'bellaquitas-media-qa');
assert.equal(config.production,false);
assert.equal(health.headers.get('set-cookie'),null);
const badPost=await read('/assets/logo-navbar.png',{method:'POST'});
assert.equal(badPost.status,405,'Servidor sólo lectura');
const missing=await read('/assets/ARCHIVO-PROHIBIDO.mp4');
assert.equal(missing.status,404,'Lista blanca de medios');
const manifest=readFileSync('cloudflare/site-media-manifest.js','utf8').match(/export const SITE_MEDIA\s*=\s*(\[[\s\S]*?\]);/);
assert.ok(manifest);
const originals=JSON.parse(manifest[1]).filter(x=>x.type==='video/mp4');
assert.equal(originals.length,5);
if(!config.assetsReady){
 const v=await read('/assets/'+encodeURIComponent(originals[0].path));
 assert.equal(v.status,503,'El medio aún no se ha publicado: fallar cerrado');
 console.log('OK: media QA aislado, sin assets ni datos, rechaza escrituras; publicación MP4 pendiente.');
}else{
 for(const media of originals){
  const name='/assets/'+encodeURIComponent(media.path);
  const head=await read(name,{method:'HEAD'});
  assert.equal(head.status,200,'El vídeo debe existir en Static Assets');
  assert.equal(head.headers.get('content-type'),'video/mp4');
  assert.equal(Number(head.headers.get('content-length')),media.bytes,'No se debe recomprimir el vídeo');
  const file=readFileSync('assets/'+media.path);
  for(const [offset,length] of [[0,256],[media.bytes-256,256]]){
   const last=offset+length-1;
   const chunk=await read(name,{headers:{Range:'bytes='+offset+'-'+last}});
   assert.equal(chunk.status,206,'El servidor REAL debe responder 206 en Safari');
   assert.equal(chunk.headers.get('content-range'),'bytes '+offset+'-'+last+'/'+media.bytes);
   assert.equal(chunk.headers.get('content-type'),'video/mp4');
   assert.equal(chunk.headers.get('set-cookie'),null);
   const data=Buffer.from(await chunk.arrayBuffer());
   assert.deepEqual(data,file.subarray(offset,last+1),'Bytes originales deben coincidir al inicio/final');
  }
 }
 console.log('OK: 5 MP4 en Cloudflare QA; HTTP 206 REAL, tamaño intacto y bytes de inicio/final verificados.');
}
