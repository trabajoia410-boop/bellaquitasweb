#!/usr/bin/env node
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import worker from './media-qa-worker.js';

const run=spawnSync(process.execPath,['cloudflare/deploy-media-qa.mjs'],{
 encoding:'utf8',timeout:30000,maxBuffer:1024*1024
});
assert.equal(run.status,0,'Dry-run falló: '+run.stderr);
const line=run.stdout.split('\n').find(x=>x.trim().startsWith('{"worker"'));
assert.ok(line,'Falta un manifiesto del dry-run');
const plan=JSON.parse(line);
assert.equal(plan.worker,'bellaquitas-media-qa');
assert.equal(plan.mode,'dry-run');
assert.equal(plan.files,17,'Debe incluir los 17 archivos originales Git');
assert.equal(plan.videos,5);
assert.equal(plan.missingLogos,3);
assert.equal(plan.hasDatabaseBinding,false);
assert.equal(plan.productionDomainChanged,false);
assert.equal(plan.shaHash,'sha256-first16bytes-hex');
assert.ok(plan.totalBytes>50*1024*1024,'No se deben excluir vídeos grandes');
const host='https://qa-media.example.test';
const req=(path,init)=>new Request(host+path,init);
let r=await worker.fetch(req('/health'),{});
assert.equal(r.status,200);
assert.equal((await r.json()).assetsReady,false);
r=await worker.fetch(req('/assets/Bellaquitas%20Fest%20para%20m%C3%B3vil.mp4'),{});
assert.equal(r.status,503,'Sin Static Assets debe denegar la entrega');
r=await worker.fetch(req('/assets/unknown.mp4'),{});
assert.equal(r.status,404,'Sólo medios verificados');
r=await worker.fetch(req('/assets/Bellaquitas%20Fest%20para%20m%C3%B3vil.mp4',{method:'POST'}),{});
assert.equal(r.status,405,'No permitir escrituras');
const samples=[['Bellaquitas Fest para móvil.mp4',9072277],['bellaquitas fiesta portada.mp4',25437525]];
for(const [name,size] of samples){
 const bytes=Uint8Array.from({length:100},(_,i)=>i);
 const range='bytes=0-99';
 const env={ASSETS:{async fetch(request){
  assert.equal(request.headers.get('Range'),range);
  return new Response(bytes,{status:206,headers:{
   'Content-Type':'application/octet-stream','Content-Range':'bytes 0-99/'+size,
   'Content-Length':String(bytes.length),'Accept-Ranges':'bytes'
  }});
 }}};
 const url='/assets/'+encodeURIComponent(name);
 r=await worker.fetch(req(url,{headers:{Range:range}}),env);
 assert.equal(r.status,206);
 assert.equal(r.headers.get('content-type'),'video/mp4');
 assert.equal(r.headers.get('content-range'),'bytes 0-99/'+size);
 assert.equal(r.headers.get('content-length'),'100');
 assert.equal(r.headers.get('X-Robots-Tag'),'noindex, nofollow');
 assert.deepEqual(Buffer.from(await r.arrayBuffer()),Buffer.from(bytes));
}
assert.equal(run.stderr.trim().length,0,'No debe haber errores ni secretos expuestos');
console.log('OK: 17 recursos verificados para subida QA, 5 MP4, 3 logos aún pendientes, worker aislado y 206 sin modificar bytes. Sin red ni tokens.');
