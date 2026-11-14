#!/usr/bin/env node
/**
 * Bellaquitas Fest — prueba extremo a extremo de QR sin cámara ni red.
 * Genera el SVG con el MISMO código local del usuario, lo rasteriza en
 * memoria y lo lee con el MISMO jsQR local del control de puerta.
 * No utiliza IDs de usuarios reales, D1, R2 o la web pública.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

function element(tag){
 return {
  tag,attributes:{},children:[],
  setAttribute(name,value){this.attributes[name]=String(value)},
  getAttribute(name){return this.attributes[name]},
  append(...children){this.children.push(...children)},
  replaceChildren(...children){this.children=children}
 };
}
const document={createElementNS(_ns,tag){return element(tag)}};
const context={document,Uint8Array,Uint8ClampedArray,console};
context.window=context;
context.self=context;
vm.createContext(context);
vm.runInContext(readFileSync('assets/qr-local.js','utf8'),context,{filename:'assets/qr-local.js'});
vm.runInContext(readFileSync('assets/jsqr-local.js','utf8'),context,{filename:'assets/jsqr-local.js'});
assert.equal(typeof context.BellaQR?.render,'function');
assert.equal(typeof context.jsQR,'function');

function imageDataFromSvg(svg,scale){
 const view=svg.getAttribute('viewBox').split(/\s+/).map(Number);
 assert.equal(view[0],0);assert.equal(view[1],0);
 const modules=view[2];
 assert.equal(modules,view[3]);
 const width=modules*scale,height=modules*scale;
 const pixels=new Uint8ClampedArray(width*height*4);
 // SVG has a white rect background and black path with 4-unit quiet zone.
 for(let i=0;i<pixels.length;i+=4){pixels[i]=255;pixels[i+1]=255;pixels[i+2]=255;pixels[i+3]=255;}
 const path=svg.children.find(e=>e.tag==='path');
 assert.ok(path,'La salida debe contener módulos oscuros');
 const d=path.getAttribute('d');
 const black=new Set();
 const regex=/M(\d+),(\d+)h1v1h-1z/g;
 let match,count=0;
 while((match=regex.exec(d))!==null){
  const x=Number(match[1]),y=Number(match[2]);
  assert.ok(x>=4&&y>=4&&x<modules-4&&y<modules-4,'QR dentro del área útil');
  black.add(y*modules+x);count++;
 }
 assert.equal(d, [...d.matchAll(regex)].map(m=>m[0]).join(''),'El SVG tiene solo comandos QR esperados');
 assert.ok(count>100);
 for(const bit of black){
  const x=bit%modules,y=Math.floor(bit/modules);
  for(let dy=0;dy<scale;dy++)for(let dx=0;dx<scale;dx++){
   const idx=((y*scale+dy)*width+x*scale+dx)*4;
   pixels[idx]=0;pixels[idx+1]=0;pixels[idx+2]=0;
  }
 }
 return {pixels,width,height,count};
}

for(const code of ['MBR-QA000001','MBR-QATEST-123456','MBR-ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789']){
 const container=element('div');
 const svg=context.BellaQR.render(container,code,{label:'QR ficticio'});
 assert.equal(container.children[0],svg);
 assert.equal(svg.getAttribute('shape-rendering'),'crispEdges');
 for(const scale of [4,7]){
  const image=imageDataFromSvg(svg,scale);
  const result=context.jsQR(image.pixels,image.width,image.height,{inversionAttempts:'dontInvert'});
  assert.ok(result,'jsQR debe poder leer el SVG original '+code+' escala '+scale);
  assert.equal(result.data,code,'El lector debe devolver el código exacto');
  assert.match(result.data,/^MBR-[A-Z0-9-]{5,80}$/);
 }
}
assert.throws(()=>context.BellaQR.render(element('div'),'https://malicioso.example'),/no válido/);
assert.throws(()=>context.BellaQR.render(element('div'),'CNJ-1234567890'),/no válido/);
console.log('OK: generador SVG y lector jsQR leen 3 códigos ficticios a 2 resoluciones; entradas ajenas rechazadas.');
