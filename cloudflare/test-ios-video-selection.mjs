#!/usr/bin/env node
/* Prueba iPhone: seleccionar el MP4 móvil ya existente del bloque tras la banda
 * amarilla. Solo altera el espejo QA en memoria, nunca la web pública.
 */
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {mirrorRoute} from './web-mirror.js';
import {MIRROR_SNAPSHOT} from './mirror-snapshot.js';

const original=MIRROR_SNAPSHOT['app.js'];
assert.ok(original.includes("if(video.matches('.bf-hero-video'))"));
assert.ok(!original.includes('Fuente original correcta bajo la banda amarilla'),
 'El archivo público original no debe editarse para la migración');
const result=await mirrorRoute(
 new Request('https://qa.example.test/espejo/app.js'),{}
);
assert.equal(result.status,200,'El espejo debe servir app.js');
const js=await result.text();
assert.ok(js.includes('Fuente original correcta bajo la banda amarilla'));
assert.ok(js.includes("await import('/espejo/bridge.js')"));
assert.ok(!js.includes("await import('https://esm.sh/@supabase/supabase-js@2.118.0')"));
const begin=js.indexOf("  // Fuente original correcta bajo la banda amarilla");
const end=js.indexOf("  video.load();",begin);
assert.ok(begin>0&&end>begin,'Parche aparece antes de cargar el vídeo');
const piece=js.slice(begin,end);
function simulate(mobile,isAfterMarquee=true){
 const mobileSource='assets/Bellaquitas%20Fest%20para%20m%C3%B3vil.mp4';
 const desktopSource='assets/bellaquitas-fiesta-fondo.mp4';
 const values={src:null};
 const video={
  matches(q){return isAfterMarquee&&q==='.bf-after-marquee-video';},
  querySelector(q){
   const src=q==='source[media]'?mobileSource:q==='source:not([media])'?desktopSource:null;
   return src?{getAttribute(k){return k==='src'?src:null}}:null;
  },
  getAttribute(k){return values[k]??null;},
  setAttribute(k,v){values[k]=v;}
 };
 runInNewContext(piece,{video,bfVideoMobileMedia:{matches:mobile}},{
  timeout:3000,filename:'video-selection-safari-qa.js'
 });
 return values.src;
}
assert.equal(simulate(true),'assets/Bellaquitas%20Fest%20para%20m%C3%B3vil.mp4',
 'iOS móvil fuerza el archivo MP4 de móvil sin recodificar');
assert.equal(simulate(false),'assets/bellaquitas-fiesta-fondo.mp4',
 'Escritorio conserva el archivo de siempre');
assert.equal(simulate(true,false),null,'El parche no altera otros vídeos');
console.log('OK: Safari móvil y escritorio seleccionan los MP4 originales correctos. HTML, CSS y binarios sin modificar.');
