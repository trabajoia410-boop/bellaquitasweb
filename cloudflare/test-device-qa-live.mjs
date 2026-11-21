#!/usr/bin/env node
/** Prueba HTTPS real de cámara/QR móvil en Worker QA; no usa usuarios reales. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const HOST='https://bellaquitas-device-qa.bellaquitas-fest-410.workers.dev';
const get=(path,init={})=>fetch(HOST+path,{
 redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(30000),...init
});
const [page,health,script,library,notFound,post,head]=await Promise.all([
 get('/'),get('/health'),get('/app.js'),get('/jsqr.js'),get('/archivos-falsos'),
 get('/app.js',{method:'POST'}),get('/',{method:'HEAD'})
]);
assert.equal(page.status,200,'La página QR pública de QA debe estar publicada en Cloudflare');
assert.match(page.headers.get('content-security-policy')||'',/script-src 'self'/);
assert.match(page.headers.get('content-security-policy')||'',/default-src 'none'/);
assert.match(page.headers.get('x-robots-tag')||'',/noindex/);
const html=await page.text();
assert.ok(html.includes('id="camera"')&&html.includes('id="original"'));
assert.ok(html.includes('data-lang="fr"'),'Interfaz ES/FR');
assert.ok(!html.includes('<form'),'La página no solicita credenciales');
assert.ok(!html.includes('supabase.co')&&!html.includes('r2.cloudflarestorage.com'));
assert.equal(health.status,200);
const state=await health.json();
assert.deepEqual(state,{service:'bellaquitas-device-qa',production:false,hasD1:false,hasR2:false,qrLibrary:true});
assert.equal(script.status,200);
const js=await script.text();
assert.ok(js.includes('getUserMedia')&&js.includes('window.jsQR')&&!js.includes('fetch('));
assert.ok(js.includes("https://bellaquitas-media-qa.bellaquitas-fest-410.workers.dev"),'QA móvil debe usar multimedia Cloudflare y no proxy temporal');
assert.equal(library.status,200);
const live=Buffer.from(await library.arrayBuffer()),orig=readFileSync('assets/jsqr-local.js');
assert.deepEqual(createHash('sha256').update(live).digest('hex'),createHash('sha256').update(orig).digest('hex'),'La biblioteca QR debe ser byte por byte idéntica a la original');
assert.equal(notFound.status,404,'Rutas extra cerradas');
assert.equal(post.status,405,'No permitir POST ni datos reales');
assert.equal(head.status,200);assert.equal((await head.text()).length,0);
for(const x of [page,health,script,library,notFound,post,head])
 assert.equal(x.headers.get('set-cookie'),null,'Sin cookies de sesión');
// Los cinco MP4 de la página QA deben funcionar por HTTP Range real (sin R2).
const sourceBase='https://bellaquitas-media-qa.bellaquitas-fest-410.workers.dev';
const manifestText=readFileSync('cloudflare/site-media-manifest.js','utf8');
const manifestPart=manifestText.match(/export const SITE_MEDIA\s*=\s*(\[[\s\S]*?\]);/);
assert.ok(manifestPart,'Inventario histórico ausente');
const originals=JSON.parse(manifestPart[1]).filter(x=>x.type==='video/mp4');
assert.equal(originals.length,5,'Cinco archivos MP4 originales');
for(const file of originals){
 const url=sourceBase+'/assets/'+encodeURIComponent(file.path);
 const headResponse=await fetch(url,{method:'HEAD',cache:'no-store',signal:AbortSignal.timeout(30000)});
 assert.equal(headResponse.status,200,'No existe MP4 '+file.path);
 assert.match(headResponse.headers.get('content-type')||'',/video\/mp4/);
 if(headResponse.headers.has('content-length'))assert.equal(Number(headResponse.headers.get('content-length')),file.bytes,'HEAD no coincide con original');
 const response=await fetch(url,{headers:{Range:'bytes=0-127'},cache:'no-store',signal:AbortSignal.timeout(30000)});
 assert.equal(response.status,206,'El vídeo debe aceptar HTTP Range para Safari');
 assert.equal(response.headers.get('content-range'),'bytes 0-127/'+file.bytes);
 assert.equal(response.headers.get('set-cookie'),null,'Ningún vídeo crea sesiones');
 assert.deepEqual(Buffer.from(await response.arrayBuffer()),readFileSync('assets/'+file.path).subarray(0,128),
  'Los bytes de vídeo en staging deben coincidir con Git');
}
console.log('OK: cinco MP4 de Cloudflare Static Assets, HTTP 206 real, bytes originales exactos, sin cookies.');

console.log('OK: dispositivo QA HTTPS publicado, lector QR original idéntico, cámara local, ES/FR, 5 vídeos de Cloudflare Static Assets, cero cookies/POST/DB/R2.');
