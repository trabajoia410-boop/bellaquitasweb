#!/usr/bin/env node
/**
 * Bellaquitas Fest: prueba HTTPS REAL de /espejo/ en Cloudflare staging
 * con MP4 originales alojados en Cloudflare Static Assets (Service Binding); cero cuentas y cero escrituras.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const BASE='https://bellaquitas-api-staging.bellaquitas-fest-410.workers.dev';
const read=(path,opts={})=>fetch(BASE+path,{cache:'no-store',redirect:'manual',signal:AbortSignal.timeout(45000),...opts});
const root=await read('/espejo/');
assert.equal(root.status,200,'El espejo visual debe permanecer disponible');
assert.match(root.headers.get('content-type')||'',/text\/html/);
assert.match(root.headers.get('x-robots-tag')||'',/noindex/);
const html=await root.text();
assert.ok(html.includes('id="app"'));
assert.ok(!html.includes('vlsipvngvxcgnwrhpjgg.supabase.co'),'HTML no puede conectar al backend antiguo');
for(const route of ['/espejo/styles.css','/espejo/locale-fr.js','/espejo/app.js','/espejo/bridge.js']){
 const r=await read(route);
 assert.equal(r.status,200,'Recurso de traducción/diseño/puente debe existir: '+route);
 assert.equal(r.headers.get('set-cookie'),null);
 const body=await r.text();
 assert.ok(body.length>100,'Recurso no debe estar vacío: '+route);
}
const manifest=JSON.parse(readFileSync('cloudflare/site-media-manifest.js','utf8').match(/export const SITE_MEDIA\s*=\s*(\[[\s\S]*?\]);/)[1]);
const videos=manifest.filter(x=>x.type==='video/mp4');
assert.equal(videos.length,5);
let checkedRanges=0;
for(const video of videos){
 const path='/espejo/assets/'+encodeURIComponent(video.path);
 const head=await read(path,{method:'HEAD'});
 if(head.status!==200){const probe=await read(path,{headers:{Range:'bytes=0-255'}});console.error('Diagnóstico espejo staging:',video.path,'HEAD',head.status,'RANGE',probe.status,'respuesta',(await probe.text()).slice(0,180));}
 assert.equal(head.status,200,'Video HEAD no disponible en espejo: '+video.path);
 if(head.headers.has('content-length'))assert.equal(Number(head.headers.get('content-length')),video.bytes,'Se ha cambiado tamaño del vídeo: '+video.path);
 assert.equal(head.headers.get('content-type'),'video/mp4');
 const local=readFileSync('assets/'+video.path);
 assert.equal(local.length,video.bytes);
 for(const start of [0,video.bytes-256]){
  const last=start+255;
  const r=await read(path,{headers:{Range:'bytes='+start+'-'+last}});
  assert.equal(r.status,206,'El espejo no admite 206: '+video.path);
  assert.equal(r.headers.get('content-range'),'bytes '+start+'-'+last+'/'+video.bytes);
  assert.equal(r.headers.get('content-type'),'video/mp4');
  assert.equal(r.headers.get('cache-control'),'no-store');
  assert.equal(r.headers.get('set-cookie'),null);
  const buf=Buffer.from(await r.arrayBuffer());
  assert.deepEqual(buf,local.subarray(start,last+1),'Bytes diferentes al original: '+video.path);
  checkedRanges++;
 }
}
const small=['logo-navbar.png','logo-bellaquitas.webp','favicon.svg','62609.jpg'];
for(const filename of small){
 const r=await read('/espejo/assets/'+encodeURIComponent(filename));
 assert.equal(r.status,200,'Imagen original no servida por el espejo: '+filename);
 assert.equal(r.headers.get('set-cookie'),null);
 if(filename==='62609.jpg')assert.equal(r.headers.get('content-type'),'image/jpeg');
 assert.deepEqual(Buffer.from(await r.arrayBuffer()),readFileSync('assets/'+filename),
  'Imagen original modificada: '+filename);
}
assert.equal((await read('/espejo/assets/fake-sensitive.env')).status,404);
assert.equal((await read('/espejo/assets/logo-navbar.png',{method:'POST'})).status,405);
console.log('OK: espejo staging real: HTML/CSS/FR/JS, 5 MP4 con '+checkedRanges+' HTTP 206 y bytes intactos, 3 recursos de marca y 1 fondo lateral original idénticos, sin cookies ni R2. NO es prueba física Safari.');
