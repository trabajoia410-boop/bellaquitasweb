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

 // Los Static Assets DIRECTOS pueden tener el mismo fallo transitorio.
 // Nunca entregar 206 anunciando 256 bytes cuando el cuerpo llegó vacío.
 let directCalls=0;
 const directRangeHeaders={
  'Content-Range':'bytes 0-255/9072277',
  'Content-Length':'256',
  'Content-Type':'video/mp4'
 };
 const directEnv={...safeEnv,ASSETS:{async fetch(request){
  directCalls++;
  assert.match(new URL(request.url).pathname,/^\/assets\//);
  assert.equal(request.headers.get('Range'),range);
  for(const header of ['cookie','authorization','origin'])
   assert.equal(request.headers.get(header),null,'No filtrar '+header+' a ASSETS');
  return new Response(new Uint8Array(directCalls===1?0:256),{
   status:206,headers:directRangeHeaders
  });
 }}};
 response=await mirrorRoute(req(STAGE,{headers:{
   Range:range,Cookie:'session-forbidden',Authorization:'Bearer forbidden'
 }}),directEnv);
 assert.equal(response.status,206,'Static Assets reintenta un fragmento vacío');
 assert.equal((await response.arrayBuffer()).byteLength,256);
 assert.equal(directCalls,2,'Un único reintento de Static Assets');
 directCalls=0;
 directEnv.ASSETS.fetch=async()=>{
  directCalls++;
  return new Response(new Uint8Array(0),{status:206,headers:directRangeHeaders});
 };
 response=await mirrorRoute(req(STAGE,{headers:{Range:range}}),directEnv);
 assert.equal(response.status,503,'Dos fragmentos 206 vacíos desde Static Assets son fallo');
 assert.equal(directCalls,3,'Dos rangos y un fallback completo; no reintentar indefinidamente el vídeo');
 
 // Static Assets puede ignorar Range y responder 200 con cuerpo recortado.
 // Recuperar un 206 real leyendo el cuerpo COMPLETO y guardando solo 256B.
 const fullLength=9072277,fullVideo=new Uint8Array(fullLength);
 for(let i=0;i<256;i++){
  fullVideo[i]=i;
  fullVideo[fullLength-256+i]=255-i;
 }
 let rangeGets=0,fullGets=0;
 const direct200={...safeEnv,ASSETS:{async fetch(request){
  for(const h of ['cookie','authorization','origin'])
   assert.equal(request.headers.get(h),null);
  if(request.headers.has('Range')){
   rangeGets++;
   return new Response(new Uint8Array(16),{status:200,
    headers:{'Content-Length':'16','Content-Type':'video/mp4'}});
  }
  fullGets++;
  return new Response(fullVideo,{status:200,
   headers:{'Content-Length':String(fullLength),'Content-Type':'video/mp4'}});
 }}};
 response=await mirrorRoute(req(STAGE,{headers:{Range:range}}),direct200);
 assert.equal(response.status,206,'Convertir 200 a 206 válido para Safari');
 assert.equal(response.headers.get('Content-Range'),'bytes 0-255/'+fullLength);
 assert.equal(response.headers.get('Content-Length'),'256');
 assert.deepEqual(new Uint8Array(await response.arrayBuffer()),fullVideo.subarray(0,256));
 assert.equal(rangeGets,1);
 assert.equal(fullGets,1,'ASSETS se reabre sin Range al responder 200');
 const endRange='bytes='+(fullLength-256)+'-'+(fullLength-1);
 response=await mirrorRoute(req(STAGE,{headers:{Range:endRange}}),direct200);
 assert.equal(response.status,206,'Safari puede leer los últimos 256 bytes');
 assert.deepEqual(new Uint8Array(await response.arrayBuffer()),fullVideo.subarray(fullLength-256));
 assert.equal(rangeGets,2);
 assert.equal(fullGets,2);
 
 service.fetch=async(request)=>{
  serviceCalls++;
  const url=new URL(request.url);
  assert.equal(url.origin,'https://bellaquitas-media-qa.bellaquitas-fest-410.workers.dev');
  assert.equal(url.pathname,'/assets/'+encodeURIComponent(video));
  assert.equal(request.method,'GET');
  assert.equal(request.redirect,'manual');
  assert.equal(request.headers.get('Range'),range);
  for(const header of ['cookie','authorization','origin'])assert.equal(request.headers.get(header),null);
  return new Response(new Uint8Array(256),{status:206,headers:{
   'Content-Range':'bytes 0-255/9072277','Content-Length':'256','Content-Type':'video/mp4',
   'Set-Cookie':'synthetic=should-not-leak; Path=/'
  }});
 };
 response=await mirrorRoute(req(STAGE,{headers:{
  Range:range,Cookie:'fictitious_session=cannot_forward',Authorization:'Bearer cannot-forward'
 }}),proxyEnv);
 assert.equal(response.status,206);
 assert.equal(response.headers.get('content-range'),'bytes 0-255/9072277');
 assert.equal(response.headers.get('content-type'),'video/mp4');
 assert.equal(response.headers.get('cache-control'),'public,max-age=86400',
  'Vídeos originales públicos cacheables; ningún dato del socio se reenvía');
 assert.equal(response.headers.get('x-robots-tag'),'noindex, nofollow');
 assert.equal(response.headers.get('set-cookie'),null);
 assert.equal((await response.arrayBuffer()).byteLength,256);
 assert.equal(serviceCalls,1);
 assert.equal(fetched,0,'Service Binding evita fetch público');

 // Un upstream puede anunciar 206/256 bytes y transferir 0: Safari falla.
 // El espejo reintenta sólo un rango pequeño y nunca devuelve 206 vacío.
 const rangeHeaders={'Content-Range':'bytes 0-255/9072277',
   'Content-Length':'256','Content-Type':'video/mp4'};
 let retries=0;
 service.fetch=async()=>{
  retries++;
  return new Response(new Uint8Array(retries===1?0:256),
    {status:206,headers:rangeHeaders});
 };
 response=await mirrorRoute(req(STAGE,{headers:{Range:range}}),proxyEnv);
 assert.equal(response.status,206,'Reintento interno recupera 206 incompleto');
 assert.equal((await response.arrayBuffer()).byteLength,256);
 assert.equal(retries,2,'Se hizo un solo reintento con los mismos bytes');
 retries=0;
 service.fetch=async()=>{
  retries++;
  return new Response(new Uint8Array(0),{status:206,headers:rangeHeaders});
 };
 response=await mirrorRoute(req(STAGE,{headers:{Range:range}}),proxyEnv);
 assert.equal(response.status,503,'Dos 206 vacíos NO son éxito');
 assert.equal(retries,2,'La recuperación no debe generar bucles ilimitados');

 service.fetch=async()=>new Response(null,{status:503});
 response=await mirrorRoute(req(),proxyEnv);
 assert.equal(response.status,503,'Error upstream no debe mostrar secretos ni cambiar de origen');
 response=await mirrorRoute(new Request(STAGE+'/espejo/assets/nonexistent.mp4'),proxyEnv);
 assert.equal(response.status,404,'No inventar nombres de medios');
 response=await mirrorRoute(new Request(STAGE+'/espejo/assets/%2e%2e%2fsecret.env'),proxyEnv);
 assert.equal(response.status,404,'No permitir traversal');
 console.log('OK: espejo con vídeo original sólo en staging, HTTP 206 y Range, nunca cookies/tokens, ASSETS preferido, producción bloqueada.');
}finally{globalThis.fetch=original}
