#!/usr/bin/env node
/* Bellaquitas Fest: Worker media QA REAL en workers.dev.
 * Antes del upload confirma 503 (seguridad); tras upload exige HTTP Range 206 real.
 * Nunca envía datos personales ni genera puntos/sesiones.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const base='https://bellaquitas-media-qa.bellaquitas-fest-410.workers.dev';
const requireAssets=process.argv.includes('--require-assets');
assert.ok(process.argv.slice(2).every(x=>x==='--require-assets'),'Argumentos no autorizados');
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
 if(requireAssets)throw Error('BLOQUEADO: Media QA sigue sin ASSETS. No se han validado HTTP 206 reales ni los 3 logos.');
 console.log('OK: media QA aislado, sin assets ni datos, rechaza escrituras; publicación MP4 pendiente.');
}else{
 for(const media of originals){
  const name='/assets/'+encodeURIComponent(media.path);
  const head=await read(name,{method:'HEAD'});
  assert.equal(head.status,200,'El vídeo debe existir en Static Assets');
  assert.equal(head.headers.get('content-type'),'video/mp4');
  if(head.headers.has('content-length'))assert.equal(Number(head.headers.get('content-length')),media.bytes,'HEAD informa tamaño incorrecto');
  // HEAD puede omitir Content-Length en Workers Static Assets; los Range y bytes se verifican abajo.
  const file=readFileSync('assets/'+media.path);
  // Inicio, fotograma intermedio y final: Safari puede pedir rangos de búsqueda.
  const mid=Math.floor((media.bytes-65536)/2);
  for(const [offset,length] of [[0,256],[mid,65536],[media.bytes-256,256]]){
   const last=offset+length-1;
   const expected=file.subarray(offset,last+1);
   let verified=false;
   // Cloudflare puede anunciar 206 correcto pero entregar un cuerpo vacío
   // durante un fallo transitorio en el borde. Repetimos como máximo dos veces.
   // Nunca aceptar un 206 sin bytes; un fallo persistente deja el CI rojo.
   for(let attempt=1;attempt<=3;attempt++){
    const chunk=await read(name,{headers:{Range:'bytes='+offset+'-'+last}});
    assert.equal(chunk.status,206,'El servidor REAL debe responder 206 en Safari');
    assert.equal(chunk.headers.get('content-range'),'bytes '+offset+'-'+last+'/'+media.bytes);
    assert.equal(chunk.headers.get('content-type'),'video/mp4');
    assert.equal(chunk.headers.get('cross-origin-resource-policy'),'cross-origin','Safari/Chrome deben permitir vídeo desde Worker distinto');
    assert.equal(chunk.headers.get('set-cookie'),null);
    const data=Buffer.from(await chunk.arrayBuffer());
    console.log('MEDIA-RANGE',JSON.stringify({file:media.path,offset,attempt,status:chunk.status,length:data.length,expected:length,range:chunk.headers.get('content-range'),encoding:chunk.headers.get('content-encoding'),cache:chunk.headers.get('cf-cache-status')}));
    if(data.length===length){
      assert.deepEqual(data,expected,'Bytes originales deben coincidir: '+media.path+' @'+offset);
      verified=true;
      break;
    }
    if(data.length!==0)assert.fail('Fragmento 206 parcial no vacío: '+data.length+'/'+length);
    if(attempt<3)console.warn('Reintentando 206 vacío (fallo transitorio de Cloudflare): '+media.path+' @'+offset);
   }
   assert.equal(verified,true,'Tres intentos devolvieron 206 incompleto: '+media.path+' @'+offset);
  }
 }
 const logos=JSON.parse(readFileSync('cloudflare/legacy-logos-manifest.json','utf8')).files;
 assert.equal(logos.length,3,'Se necesitan exactamente tres logos históricos');
 for(const logo of logos){
  const path='/assets/migrated-logos/'+encodeURIComponent(logo.path);
  const local=readFileSync('assets/migrated-logos/'+logo.path);
  assert.equal(local.length,logo.bytes,'El logo recuperado en Git no coincide');
  assert.equal(createHash('md5').update(local).digest('hex'),logo.etagMd5,
   'El logo local no coincide con el original');
  const head=await read(path,{method:'HEAD'});
  assert.equal(head.status,200,'Logo original no accesible en QA');
  assert.equal(head.headers.get('content-type'),logo.type);
  assert.equal(head.headers.get('cross-origin-resource-policy'),'cross-origin','Logos públicos deben poder utilizarse desde web de pruebas');
  if(head.headers.has('content-length'))assert.equal(Number(head.headers.get('content-length')),logo.bytes,'HEAD informa tamaño de logo incorrecto');
  // GET completo y comparación SHA/bytes al final prueban que no se ha recodificado.
  const got=await read(path);
  assert.equal(got.status,200,'No se pudo leer el logo en QA');
  assert.equal(got.headers.get('set-cookie'),null);
  const bytes=Buffer.from(await got.arrayBuffer());
  assert.deepEqual(bytes,local,'Logo QA diferente de su original en Git');
 }
 console.log('OK: 5 MP4 en Cloudflare QA con HTTP 206 REAL y bytes idénticos; 3 logos originales servidos sin recomprimir.');
}
