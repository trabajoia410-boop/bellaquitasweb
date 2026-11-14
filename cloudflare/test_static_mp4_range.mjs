/**
 * Prueba de MP4 originales desde Static Assets + Range 206.
 * No abre cuentas, no despliega, no usa R2 ni datos de usuarios.
 */
import assert from "node:assert/strict";
import {test} from "node:test";
import {createReadStream,readFileSync} from "node:fs";
import {Readable} from "node:stream";
import {fileURLToPath,pathToFileURL} from "node:url";
import path from "node:path";
import {performance} from "node:perf_hooks";
const here=path.dirname(fileURLToPath(import.meta.url));
const recovered=path.join(here,"staging-source-2026-11-11","recovered-src");
const {staticMp4RangeRoute}=await import(pathToFileURL(path.join(recovered,"static-mp4-range.js")).href);
const {SITE_MEDIA}=await import(pathToFileURL(path.join(recovered,"site-media-manifest.js")).href);
const movies=SITE_MEDIA.filter(x=>x.type==="video/mp4");
assert.equal(movies.length,5);
const HOME="https://simulacion.bellaquitas.test";
let calls=0;
const env={
 STATIC_MP4_RANGE_ENABLED:"yes",
 ASSETS:{
  async fetch(request){
   calls++;
   const url=new URL(request.url);
   const name=decodeURIComponent(url.pathname.slice("/espejo/assets/".length));
   const media=movies.find(x=>x.path===name);
   if(!media)return new Response("No existe",{status:404});
   assert.equal(request.headers.get("Range"),null,"El binding devuelve 200 y todo el fichero");
   const filename=path.join(here,"..","assets",name);
   const stream=Readable.toWeb(createReadStream(filename,{highWaterMark:65536}));
   return new Response(stream,{status:200,headers:{
      "Content-Type":"video/mp4","Content-Length":String(media.bytes)
   }});
  }
 }
};
function request(name,range,method="GET",headers={}){
 const h=new Headers(headers);
 if(range!==undefined)h.set("Range",range);
 return new Request(HOME+"/espejo/assets/"+encodeURIComponent(name),{method,headers:h});
}
test("rechaza activación por defecto y no consulta ningún vídeo",async()=>{
 const media=movies[0],before=calls;
 assert.equal(await staticMp4RangeRoute(request(media.path,"bytes=0-10"),{}),null);
 assert.equal(await staticMp4RangeRoute(request(media.path,"bytes=0-10"),{
  ASSETS:env.ASSETS,STATIC_MP4_RANGE_ENABLED:"no"
 }),null);
 assert.equal(before,calls);
});
test("no permite recursos fuera de la lista de cinco MP4",async()=>{
 const before=calls;
 for(const file of ["logo-navbar.png","fake.mp4","../malicioso.mp4","qr-local.js"]){
  const result=await staticMp4RangeRoute(request(file,"bytes=0-5"),env);
  assert.equal(result,null,file);
 }
 assert.equal(calls,before);
});
test("Rango inválido o no satisfacible devuelve 416 sin tocar Assets",async()=>{
 const media=movies[0],before=calls;
 for(const range of [
  "bytes="+media.bytes+"-","bytes=10-9","bytes=0-1,7-10",
  "bytes=-0","bytes=a-b","bytes=--","items=0-1","bytes=999999999999999999-"
 ]){
  const res=await staticMp4RangeRoute(request(media.path,range),env);
  assert.equal(res.status,416,range);
  assert.equal(res.headers.get("Content-Range"),"bytes */"+media.bytes);
  assert.equal((await res.arrayBuffer()).byteLength,0);
 }
 assert.equal(calls,before);
});
for(const media of movies){
 test("MP4 original: "+media.path+" entrega intervalos 206 correctos",async()=>{
  const filename=path.join(here,"..","assets",media.path);
  const original=readFileSync(filename);
  assert.equal(original.byteLength,media.bytes);
  const ranges=[
   {raw:"bytes=0-1023",start:0,end:1023},
   {raw:"bytes=1048576-1048639",start:1048576,end:1048639},
   {raw:"bytes=-512",start:media.bytes-512,end:media.bytes-1},
   {raw:"bytes="+(media.bytes-5)+"-",start:media.bytes-5,end:media.bytes-1},
   {raw:"bytes=0-",start:0,end:media.bytes-1}
  ];
  for(const r of ranges){
    const t=performance.now(),cpu=process.cpuUsage();
    const res=await staticMp4RangeRoute(request(media.path,r.raw),env);
    assert.equal(res.status,206,media.path+" "+r.raw);
    assert.equal(res.headers.get("Content-Type"),"video/mp4");
    assert.equal(res.headers.get("Accept-Ranges"),"bytes");
    assert.equal(res.headers.get("Content-Range"),"bytes "+r.start+"-"+r.end+"/"+media.bytes);
    assert.equal(Number(res.headers.get("Content-Length")),r.end-r.start+1);
    assert.deepEqual(Buffer.from(await res.arrayBuffer()),original.subarray(r.start,r.end+1));
    const used=process.cpuUsage(cpu);
    const ms=(used.user+used.system)/1000;
    console.log("MEDIDA_NODE "+JSON.stringify({name:media.path,range:r.raw,bytes:r.end-r.start+1,
      cpuMs:Math.round(ms*100)/100,wallMs:Math.round((performance.now()-t)*100)/100}));
  }
 });
}
test("HEAD respeta metadatos y no lee archivos",async()=>{
 const media=movies[1],before=calls;
 const head=await staticMp4RangeRoute(request(media.path,"bytes=2-12","HEAD"),env);
 assert.equal(head.status,206);
 assert.equal(head.headers.get("Content-Range"),"bytes 2-12/"+media.bytes);
 assert.equal(head.headers.get("Content-Length"),"11");
 assert.equal(head.body,null);
 assert.equal(calls,before);
});
test("GET sin Range conserva archivo completo 200 y MIME original",async()=>{
 const media=movies[3],expected=readFileSync(path.join(here,"..","assets",media.path));
 const res=await staticMp4RangeRoute(request(media.path),env);
 assert.equal(res.status,200);
 assert.equal(res.headers.get("Content-Range"),null);
 assert.equal(Number(res.headers.get("Content-Length")),media.bytes);
 assert.deepEqual(Buffer.from(await res.arrayBuffer()),expected);
});
test("un binding con bytes distintos no sirve contenido como legítimo",async()=>{
 const media=movies[0],e={
  STATIC_MP4_RANGE_ENABLED:"yes",
  ASSETS:{async fetch(){return new Response(new Uint8Array([1,2,3]),{
   status:200,headers:{"Content-Length":"3"}});}}
 };
 const r=await staticMp4RangeRoute(request(media.path,"bytes=0-1"),e);
 assert.equal(r.status,503);
});
test("archivo completo no encontrado tampoco devuelve 206 válido",async()=>{
 const media=movies[0],e={
  STATIC_MP4_RANGE_ENABLED:"yes",
  ASSETS:{async fetch(){return new Response("No existe",{status:404});}}
 };
 const r=await staticMp4RangeRoute(request(media.path,"bytes=0-1"),e);
 assert.equal(r.status,503);
});
console.log("QA de Streaming: cinco MP4 originales, sin recompresión ni API remota.");
