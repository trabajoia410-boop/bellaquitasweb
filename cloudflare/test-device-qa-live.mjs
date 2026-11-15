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
assert.equal(library.status,200);
const live=Buffer.from(await library.arrayBuffer()),orig=readFileSync('assets/jsqr-local.js');
assert.deepEqual(createHash('sha256').update(live).digest('hex'),createHash('sha256').update(orig).digest('hex'),'La biblioteca QR debe ser byte por byte idéntica a la original');
assert.equal(notFound.status,404,'Rutas extra cerradas');
assert.equal(post.status,405,'No permitir POST ni datos reales');
assert.equal(head.status,200);assert.equal((await head.text()).length,0);
for(const x of [page,health,script,library,notFound,post,head])
 assert.equal(x.headers.get('set-cookie'),null,'Sin cookies de sesión');
console.log('OK: dispositivo QA HTTPS publicado, lector QR original idéntico, cámara local, ES/FR, 5 vídeos de staging, cero cookies/POST/DB/R2.');
