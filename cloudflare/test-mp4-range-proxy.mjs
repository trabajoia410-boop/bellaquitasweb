#!/usr/bin/env node
/* Bellaquitas Fest: simulación exacta del proxy de Range en el espejo Cloudflare.
 * No prueba una respuesta 206 REAL de Cloudflare hasta publicar Static Assets;
 * sí prueba que el Worker no pierde Range, Content-Range ni cambia los bytes.
 */
import assert from 'node:assert/strict';
import {mirrorRoute} from './web-mirror.js';
import {SITE_MEDIA} from './site-media-manifest.js';

const originals=SITE_MEDIA.filter(item=>item.type==='video/mp4');
assert.equal(originals.length,5,'Se esperan los 5 MP4 originales');
let calls=0;
for(const media of originals){
 const bytes=new Uint8Array(1024);
 for(let i=0;i<bytes.length;i++)bytes[i]=i%251;
 const range='bytes=0-1023';
 const env={ASSETS:{async fetch(request){
  calls++;
  assert.equal(request.method,'GET');
  assert.equal(request.headers.get('Range'),range,'La petición de Safari debe mantenerse');
  assert.equal(new URL(request.url).pathname,'/assets/'+encodeURIComponent(media.path),
   'La ruta codificada debe conservar nombres, espacios y acentos');
  return new Response(bytes.slice(),{status:206,headers:{
   'Content-Type':'application/octet-stream',
   'Content-Range':'bytes 0-1023/'+media.bytes,
   'Accept-Ranges':'bytes',
   'Content-Length':'1024'
  }});
 }}};
 const uri='/espejo/assets/'+encodeURIComponent(media.path);
 const response=await mirrorRoute(
  new Request('https://qa.example.test'+uri,{headers:{Range:range}}),env
 );
 assert.equal(response.status,206,'El navegador debe recibir Partial Content');
 assert.equal(response.headers.get('Content-Range'),'bytes 0-1023/'+media.bytes);
 assert.equal(response.headers.get('Content-Type'),'video/mp4');
 assert.equal(response.headers.get('Accept-Ranges'),'bytes');
 assert.equal(response.headers.get('Content-Length'),'1024');
 assert.deepEqual(Buffer.from(await response.arrayBuffer()),Buffer.from(bytes),
  'La respuesta no debe modificar ni transcodificar los bytes del MP4');
 const noAsset=await mirrorRoute(new Request('https://qa.example.test'+uri),{});
 assert.equal(noAsset.status,503,'Sin medios publicados el Worker debe fallar cerrado');
}
assert.equal(calls,5);
const forbidden=await mirrorRoute(new Request('https://qa.example.test/espejo/assets/%2E%2E%2Fsecret.env'),{});
assert.equal(forbidden.status,404,'Prohibir rutas de archivos desconocidos');
console.log('OK: 5 vídeos, Range 206, Content-Range, longitud, MIME y bytes intactos; sin ASSETS devuelve 503.');
