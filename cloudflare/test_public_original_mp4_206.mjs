/**
 * Auditoría HTTP de solo lectura contra los cinco MP4 PÚBLICOS actuales.
 * No usa cuentas, cookies, datos privados ni modifica puntos/visitas.
 *
 * Busca si GitHub Pages / bellaquitas.fr admite 206 nativo, que evitaría
 * leer los MP4 mediante un Worker Free con tope CPU de 10 ms.
 */
import {test} from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import {readFileSync} from "node:fs";
import {fileURLToPath,pathToFileURL} from "node:url";
const dir=path.dirname(fileURLToPath(import.meta.url));
const root=path.join(dir,"staging-source-2026-11-11","recovered-src");
const {SITE_MEDIA}=await import(pathToFileURL(path.join(root,"site-media-manifest.js")).href);
const videos=SITE_MEDIA.filter(x=>x.type==="video/mp4");
assert.equal(videos.length,5);
const host=process.env.VIDEO_PUBLIC_ORIGIN||"https://bellaquitas.fr";
for(const item of videos){
 const original=readFileSync(path.join(dir,"..","assets",item.path));
 assert.equal(original.length,item.bytes,"El archivo original cambió");
 const ranges=[
  {label:"inicio",start:0},
  {label:"mitad",start:Math.floor(item.bytes/2)},
  {label:"final",start:item.bytes-1024}
 ];
 for(const part of ranges){
  test("MP4 público: HTTP 206 "+part.label+" y bytes idénticos: "+item.path,async()=>{
   const end=part.start+1023;
   const expected="bytes "+part.start+"-"+end+"/"+item.bytes;
   const url=host+"/assets/"+encodeURIComponent(item.path);
   const response=await fetch(url,{headers:{
     "Range":"bytes="+part.start+"-"+end,
     "Accept-Encoding":"identity"
   },redirect:"follow",signal:AbortSignal.timeout(30000)});
   console.log("ORIGEN "+JSON.stringify({
     filename:item.path,segment:part.label,status:response.status,
     range:response.headers.get("Content-Range"),
     length:response.headers.get("Content-Length"),
     contentType:response.headers.get("Content-Type")
   }));
   assert.equal(response.status,206,"No hay HTTP 206: "+item.path+" "+part.label);
   assert.equal(response.headers.get("Content-Range"),expected);
   assert.ok(response.headers.get("Content-Type")?.startsWith("video/mp4"));
   const bytes=Buffer.from(await response.arrayBuffer());
   assert.equal(bytes.length,1024);
   assert.deepEqual(bytes,original.subarray(part.start,end+1),
     "El vídeo del dominio público no coincide con GitHub");
  });
 }
}
