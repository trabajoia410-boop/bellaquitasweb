#!/usr/bin/env node
/* Bellaquitas proxy QA — pruebas deterministas. Sin red ni datos reales. */
import assert from 'node:assert/strict';
import worker from './media-proxy-qa-worker.js';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const base="https://bellaquitas-media-proxy-qa.bellaquitas-fest-410.workers.dev";
const path='/assets/'+encodeURIComponent('Bellaquitas Fest para móvil.mp4');
const originSHA='733244ec58fa2d0af053bf969d25525a8f878aa2';
const localManifest=JSON.parse(readFileSync('cloudflare/site-media-manifest.js','utf8').match(/export const SITE_MEDIA\s*=\s*(\[[\s\S]*?\]);/)[1]);
const logos=JSON.parse(readFileSync('cloudflare/legacy-logos-manifest.json','utf8')).files;
assert.equal(localManifest.length,17);
assert.equal(logos.length,3);
assert.equal(localManifest.filter(x=>x.type==='video/mp4').length,5);
for(const logo of logos){
 const data=readFileSync('assets/migrated-logos/'+logo.path);
 assert.equal(data.length,logo.bytes);
 assert.equal(createHash('md5').update(data).digest('hex'),logo.etagMd5);
}
const f=globalThis.fetch;
try{
 let requestCount=0;
 globalThis.fetch=async()=>{throw Error('No debe consultar redes para rutas inválidas')};
 const response=async(name,init)=>worker.fetch(new Request(base+name,init));
 assert.equal((await response('/health')).status,200);
 const h=await (await response('/health')).json();
 assert.equal(h.production,false);
 assert.equal(h.uploadedStaticAssets,false);
 assert.equal(h.allowlistedAssets,20);
 assert.equal(h.sourceCommit,originSHA);
 assert.equal((await response('/assets/.env')).status,404);
 assert.equal((await response('/assets/secret-key.sql')).status,404);
 assert.equal((await response('/assets/%2e%2e%2fsecret-key.sql')).status,404);
 assert.equal((await response('/assets/unknown.mp4')).status,404);
 assert.equal((await response('/assets/logo-navbar.png',{method:'POST'})).status,405);
 assert.equal((await response(path,{headers:{Range:'bytes=0-25,30-50'}})).status,416);
 assert.equal((await response(path,{headers:{Range:'bytes=wat'}})).status,416);
 assert.equal(requestCount,0);

 const range='bytes=0-255';
 globalThis.fetch=async (url,options)=>{
  requestCount++;
  assert.ok(url.startsWith('https://raw.githubusercontent.com/trabajoia410-boop/bellaquitasweb/'+originSHA+'/assets/'));
  assert.ok(url.includes('Bellaquitas%20Fest%20para%20m%C3%B3vil.mp4'));
  assert.equal(options.headers.get('Range'),range);
  assert.equal(options.redirect,'manual');
  return new Response(new Uint8Array(256),{status:206,headers:{
   'Content-Range':'bytes 0-255/9072277','Content-Length':'256','Content-Type':'application/octet-stream'
  }});
 };
 const good=await response(path,{headers:{Range:range}});
 assert.equal(good.status,206);
 assert.equal(good.headers.get('content-range'),'bytes 0-255/9072277');
 assert.equal(good.headers.get('content-type'),'video/mp4');
 assert.equal(good.headers.get('accept-ranges'),'bytes');
 assert.equal(good.headers.get('cache-control'),'no-store');
 assert.equal(good.headers.get('set-cookie'),null);
 assert.equal((await good.arrayBuffer()).byteLength,256);
 assert.equal(requestCount,1);

 // Un CDN remoto que cambia el archivo debe rechazarse.
 globalThis.fetch=async()=>new Response(new Uint8Array(256),{status:206,headers:{
  'Content-Range':'bytes 0-255/9072278','Content-Length':'256'
 }});
 assert.equal((await response(path,{headers:{Range:range}})).status,502);
 globalThis.fetch=async()=>new Response(new Uint8Array(256),{status:200,headers:{'Content-Length':'256'}});
 assert.equal((await response(path,{headers:{Range:range}})).status,502);
 assert.equal((await response(path)).status,502);
 globalThis.fetch=async()=>new Response(null,{status:503});
 assert.equal((await response(path)).status,503);
 console.log('OK: Proxy multimedia QA prueba 20 nombres permitidos, 5 MP4, SHA Git fijado, 206, sin cambios de bytes, origen seguro y sin secretos/D1/R2.');
}finally{globalThis.fetch=f}
