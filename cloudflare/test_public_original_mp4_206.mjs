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
 test("MP4 público: Range HTTP 206 y mismos 1024 bytes: "+item.path,async()=>{
  const url=host+"/assets/"+encodeURIComponent(item.path);
  const response=await fetch(url,{headers:{"Range":"bytes=0-1023","Accept-Encoding":"identity"},
   redirect:"follow",signal:AbortSignal.timeout(30000)});
  console.log("ORIGEN "+JSON.stringify({
    filename:item.path,url:response.url,status:response.status,
    range:response.headers.get("Content-Range"),
    length:response.headers.get("Content-Length"),
    contentType:response.headers.get("Content-Type")
  }));
  assert.equal(response.status,206,"El servidor actual NO cumple HTTP 206 para "+item.path);
  assert.equal(response.headers.get("Content-Range"),"bytes 0-1023/"+item.bytes);
  const actual=Buffer.from(await response.arrayBuffer());
  assert.equal(actual.length,1024);
  const original=readFileSync(path.join(dir,"..","assets",item.path));
  assert.deepEqual(actual,original.subarray(0,1024),"El vídeo público no coincide con GitHub");
 });
}
