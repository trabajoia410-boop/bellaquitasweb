#!/usr/bin/env node
/**
 * Bellaquitas mirror: pruebas del fallback de medios ORIGINAL sólo en staging.
 * Sin red, sin D1 ni R2, sin datos reales.
 */
import assert from 'node:assert/strict';
import {mirrorRoute} from './web-mirror.js';
const STAGE='https://bellaquitas-api-staging.bellaquitas-fest-410.workers.dev';
const PROD='https://bellaquitas.fr';
const QA='https://bellaquitas-api-qa.bellaquitas-fest-410.workers.dev';
const video='Bellaquitas Fest para móvil.mp4';
const route='/espejo/assets/'+encodeURIComponent(video);
const safeEnv={STAGING_MUTATIONS:'disabled',ALLOW_NEW_ACCOUNTS:'no'};
let serviceCalls=0;
const service={async fetch(){serviceCalls++;throw Error('Servicios fuera de la ruta probada')}};
const proxyEnv={...safeEnv,VIDEO_QA_PROXY:service};
const req=(host=STAGE,options={})=>new Request(host+route,options);
const original=globalThis.fetch;
let fetched=0;
try{
 globalThis.fetch=async()=>{fetched++;throw Error('No debe realizar llamadas externas')};
 let response=await mirrorRoute(req(),{});
 assert.equal(response.status,503,'Sin flags de seguridad no hay fallback');
 response=await mirrorRoute(req(PROD),proxyEnv);
 assert.equal(response.status,503,'Prohibido proxy de pruebas sobre dominio público');
 response=await mirrorRoute(req(QA),proxyEnv);
 assert.equal(response.status,503,'Prohibido fallback en Worker QA genérico');
 response=await mirrorRoute(req(STAGE),{...proxyEnv,ALLOW_NEW_ACCOUNTS:'yes'});
 assert.equal(response.status,503,'Prohibido si se permiten registros nuevos');
 response=await mirrorRoute(req(STAGE),{...proxyEnv,STAGING_MUTATIONS:'enabled'});
 assert.equal(response.status,503,'Prohibido si las mutaciones están habilitadas');
 assert.equal(fetched,0,'No realizar ninguna petición pública');
 assert.equal(serviceCalls,0,'No llamar al Worker interno en entornos no permitidos');
 let assetCalls=0;
 const assetEnv={...safeEnv,ASSETS:{async fetch(request){
  assetCalls++;assert.match(new URL(request.url).pathname,/^\/assets\//);
  return new Response('static-original',{status:200,headers:{'Content-Type':'video/mp4','Content-Length':'15'}});
 }}};
 response=await mirrorRoute(req(),assetEnv);
 assert.equal(response.status,200);
 assert.equal(await response.text(),'static-original');
 assert.equal(assetCalls,1,'Cuando haya ASSETS, preferir almacenamiento autónomo');
 assert.equal(fetched,0,'ASSETS nunca necesita proxy temporal');

 const range='bytes=0-255';
 service.fetch=async(request)=>{
  serviceCalls++;
  const url=new URL(request.url);
  assert.equal(url.origin,'https://bellaquitas-media-proxy-qa.bellaquitas-fest-410.workers.dev');
  assert.equal(url.pathname,'/assets/'+encodeURIComponent(video));
  assert.equal(request.method,'GET');
  assert.equal(request.redirect,'manual');
  assert.equal(request.headers.get('Range'),range);
  for(const header of ['cookie','authorization','origin'])assert.equal(request.headers.get(header),null);
  return new Response(new Uint8Array(256),{status:206,headers:{
   'Content-Range':'bytes 0-255/9072277','Content-Length':'256','Content-Type':'video/mp4'
  }});
 };
 response=await mirrorRoute(req(STAGE,{headers:{
  Range:range,Cookie:'fictitious_session=cannot_forward',Authorization:'Bearer cannot-forward'
 }}),proxyEnv);
 assert.equal(response.status,206);
 assert.equal(response.headers.get('content-range'),'bytes 0-255/9072277');
 assert.equal(response.headers.get('content-type'),'video/mp4');
 assert.equal(response.headers.get('cache-control'),'no-store');
 assert.equal(response.headers.get('x-robots-tag'),'noindex, nofollow');
 assert.equal(response.headers.get('set-cookie'),null);
 assert.equal((await response.arrayBuffer()).byteLength,256);
 assert.equal(serviceCalls,1);
 assert.equal(fetched,0,'Service Binding evita fetch público');
 service.fetch=async()=>new Response(null,{status:503});
 response=await mirrorRoute(req(),proxyEnv);
 assert.equal(response.status,503,'Error upstream no debe mostrar secretos ni cambiar de origen');
 response=await mirrorRoute(new Request(STAGE+'/espejo/assets/nonexistent.mp4'),proxyEnv);
 assert.equal(response.status,404,'No inventar nombres de medios');
 response=await mirrorRoute(new Request(STAGE+'/espejo/assets/%2e%2e%2fsecret.env'),proxyEnv);
 assert.equal(response.status,404,'No permitir traversal');
 console.log('OK: espejo con vídeo original sólo en staging, HTTP 206 y Range, nunca cookies/tokens, ASSETS preferido, producción bloqueada.');
}finally{globalThis.fetch=original}
