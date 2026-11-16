#!/usr/bin/env node
/** Cuando Static Assets responde 200 a Range, Worker debe entregar 206 exacto.
 * Todos los datos sintéticos y memoria local: sin red, D1, R2 ni cuentas.
 */
import assert from 'node:assert/strict';
import worker,{parseByteRange} from './media-qa-worker.js';
const base='https://bellaquitas-media-qa.example.test';
const file='auth-startup.js';
const original=Uint8Array.from({length:56},(_,i)=>(i*19)%256);
let assetFetches=0;
const env={ASSETS:{async fetch(_req){
 assetFetches++;
 // Imitamos el comportamiento real: el asset IGNORA el Range y devuelve 200.
 return new Response(original,{status:200,headers:{'Content-Type':'application/octet-stream'}});
}}};
async function get(range,method='GET'){
 const headers=range?{Range:range}:{};
 return worker.fetch(new Request(base+'/assets/'+file,{method,headers}),env);
}
assert.deepEqual(parseByteRange('bytes=0-3',56),{start:0,end:3,length:4});
assert.deepEqual(parseByteRange('bytes=53-',56),{start:53,end:55,length:3});
assert.deepEqual(parseByteRange('bytes=-4',56),{start:52,end:55,length:4});
assert.deepEqual(parseByteRange('bytes=-100',56),{start:0,end:55,length:56});
for(const bad of ['bytes=56-','bytes=20-10','bytes=-0','bytes=0-2,4-7','items=1-4','bytes=99999999999999999999-']){
 assert.equal(parseByteRange(bad,56).invalid,true,'Range inválido: '+bad);
}
for(const [range,start,end] of [
 ['bytes=0-0',0,0],
 ['bytes=0-9',0,9],
 ['bytes=10-14',10,14],
 ['bytes=53-',53,55],
 ['bytes=-4',52,55],
 ['bytes=-100',0,55],
 ['bytes=30-800',30,55]
]){
 const r=await get(range);
 assert.equal(r.status,206,'Respuesta parcial real '+range);
 assert.equal(r.headers.get('Content-Range'),'bytes '+start+'-'+end+'/56');
 assert.equal(Number(r.headers.get('Content-Length')),end-start+1);
 assert.equal(r.headers.get('Accept-Ranges'),'bytes');
 assert.equal(r.headers.get('Content-Type'),'application/javascript');
 assert.deepEqual(new Uint8Array(await r.arrayBuffer()),original.slice(start,end+1));
}
const head=await get('bytes=7-20','HEAD');
assert.equal(head.status,206);
assert.equal(head.headers.get('content-range'),'bytes 7-20/56');
assert.equal(head.headers.get('content-length'),'14');
assert.equal((await head.arrayBuffer()).byteLength,0);
for(const invalid of ['bytes=56-','bytes=-0','bytes=20-10','bytes=0-1,5-10']){
 const r=await get(invalid);
 assert.equal(r.status,416,'Rechazar Range imposible');
 assert.equal(r.headers.get('Content-Range'),'bytes */56');
}
const full=await get(null);
assert.equal(full.status,200);
assert.deepEqual(new Uint8Array(await full.arrayBuffer()),original);
const unsafe=await worker.fetch(new Request(base+'/assets/'+file,{method:'POST'}),env);
assert.equal(unsafe.status,405);
const mystery=await worker.fetch(new Request(base+'/assets/UNKNOWN.mp4'),env);
assert.equal(mystery.status,404);
assert.ok(assetFetches>=8,'Se usa siempre el binding Static Assets');
console.log('OK: 7 Range parciales exactos, HEAD206, 4 inválidos 416, bytes y MIME intactos, 0 escrituras.');
