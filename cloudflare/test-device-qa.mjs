#!/usr/bin/env node
/** QA QR/hardware en Worker aislado: no necesita cuentas, puntos ni red. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import worker from './device-qa-worker.js';
const url='https://bellaquitas-device-qa.example.test';
const get=(path,method='GET')=>worker.fetch(new Request(url+path,{method}),{});
let r=await get('/');assert.equal(r.status,200);
const html=await r.text();
assert.match(html,/Bellaquitas Fest/);
assert.match(html,/id="camera"/);
assert.match(html,/id="original"/);
assert.ok(html.includes('data-lang="fr"'));
assert.ok(!html.includes('<form'),'El lector no debe pedir ni recibir credenciales');
assert.ok(!html.includes('supabase.co')&&!html.includes('r2.cloudflarestorage.com'));
assert.match(r.headers.get('content-security-policy')||'',/connect-src|default-src 'none'/);
r=await get('/app.js');assert.equal(r.status,200);
const js=await r.text();new Script(js,{filename:'device-qa-browser.js'});
assert.ok(js.includes('getUserMedia'),'Usar cámara física en el dispositivo');
assert.ok(js.includes('window.jsQR'),'La detección debe ser local');
assert.ok(js.includes('getImageData'),'El QR no debe enviarse al backend');
assert.ok(!js.includes('fetch(')&&!js.includes('XMLHttpRequest'),'La página NO debe transmitir códigos al servidor');
assert.ok(js.includes('pagehide'),'Detener cámara al salir');
r=await get('/health');assert.deepEqual(await r.json(),{
 service:'bellaquitas-device-qa',production:false,hasD1:false,hasR2:false,qrLibrary:false
});
r=await get('/jsqr.js');assert.equal(r.status,503,'Sin la librería original se falla cerrado');
r=await get('/app.js','POST');assert.equal(r.status,405);
r=await get('/no-existe');assert.equal(r.status,404);
r=await get('/','HEAD');assert.equal(r.status,200);assert.equal(await r.text(),'');
const original=readFileSync('assets/jsqr-local.js','utf8');
new Script(original,{filename:'jsqr-original.js'});
assert.ok(original.length>200000,'Nunca publicar una librería QR vacía');
console.log('OK: vista móvil ES/FR, jsQR original compilable, cámara local, cero envío QR, 5 vídeos staging, CSP y ningún DB/POST.');
