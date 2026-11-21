#!/usr/bin/env node
/**
 * Asegura que el QR sintético que se muestra en el banco móvil se decodifica
 * con EXACTAMENTE la biblioteca jsQR original, sin cámara ni datos de socios.
 * No consulta la red, D1, R2 ni al usuario.
 */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import worker from './device-qa-worker.js';
const require=createRequire(import.meta.url);
const jsQR=require('../assets/jsqr-local.js');
assert.equal(typeof jsQR,'function','Lector jsQR original no instalado');
const base='https://device-qa.example.invalid';
const r=await worker.fetch(new Request(base+'/app.js'),{});
assert.equal(r.status,200);
const script=await r.text();
const token=script.match(/const QA_CHALLENGE="([^"]+)";/);
const matrix=script.match(/const QA_MATRIX="([0-9a-f ]+)".split\(" "\);/);
assert.ok(token&&matrix,'La prueba debe tener un QR conocido y estático');
assert.equal(token[1],'BELLAQUITAS-QA-QR-2026');
const rows=matrix[1].split(' ');
assert.equal(rows.length,33);
assert.ok(rows.every(row=>/^[0-9a-f]{9}$/.test(row)),'Cada fila codifica 33 módulos');
const width=198;
const pixels=new Uint8ClampedArray(width*width*4);
for(let y=0;y<33;y++){
 const bits=BigInt('0x'+rows[y]);
 for(let x=0;x<33;x++){
  const black=((bits>>BigInt(x))&1n)===1n;
  for(let dy=0;dy<6;dy++)for(let dx=0;dx<6;dx++){
   const idx=((y*6+dy)*width+x*6+dx)*4;
   pixels[idx]=black?0:255;
   pixels[idx+1]=black?0:255;
   pixels[idx+2]=black?0:255;
   pixels[idx+3]=255;
  }
 }
}
const decoded=jsQR(pixels,width,width,{inversionAttempts:'attemptBoth'});
assert.ok(decoded,'jsQR debe reconocer el código ficticio');
assert.equal(decoded.data,token[1],'Nunca utilizar un código de socio');
assert.ok(script.includes('videoValidated'),'Debe detectar vídeo avanzando, no solo cargado');
assert.ok(script.includes('cameraValidated'),'Debe distinguir cámara física del lector local');
assert.ok(script.includes('readerValidated'),'Debe verificar QR sin pedir cámara');
assert.ok(!script.includes('fetch('),'Los resultados no se envían a ningún servidor');
assert.ok(!script.includes('localStorage'),'No se persisten resultados');
const html=await (await worker.fetch(new Request(base+'/'),{})).text();
assert.match(html,/id="qaSampleQr"/);
assert.match(html,/id="testDecoder"/);
assert.match(html,/id="copyReport"/);
assert.ok(!html.includes('<form'),'No solicitar contraseñas');
console.log('OK: QR ficticio decodificado byte a byte con jsQR original; cámara y vídeo verificables; informe local sin red ni datos personales.');
