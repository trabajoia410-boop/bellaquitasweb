/**
 * Bellaquitas Fest — ¿pueden alojarse los recursos originales en
 * Cloudflare Workers Static Assets FREE sin depender de R2 por lecturas?
 *
 * Lee exclusivamente archivos originales del checkout Git y el manifiesto
 * verificado. Nunca modifica medios, no comprime, no conecta a Cloudflare.
 *
 * IMPORTANTE: Cloudflare Static Assets no entrega 206 Range por defecto.
 * No cambiar vídeos de origen sin resolver los Range de Safari/iPhone.
 */
import assert from "node:assert/strict";
import {readFileSync,statSync} from "node:fs";
import path from "node:path";
import {fileURLToPath,pathToFileURL} from "node:url";
import {createHash} from "node:crypto";

const HERE=path.dirname(fileURLToPath(import.meta.url));
const recovered=path.join(HERE,"staging-source-2026-11-11","recovered-src");
const {SITE_MEDIA}=await import(pathToFileURL(path.join(recovered,"site-media-manifest.js")).href);
const LIMIT=25*1024*1024;
assert.equal(SITE_MEDIA.length,17,"Falta alguna de las 17 fuentes multimedia originales");
let total=0,large=0,videos=0;
const report=[];
for(const item of SITE_MEDIA){
 assert.ok(typeof item.path==="string"&&!item.path.includes("..")&&!item.path.startsWith("/"));
 const filename=path.join(HERE,"..","assets",item.path);
 const bytes=readFileSync(filename);
 const actual=statSync(filename).size;
 assert.equal(actual,item.bytes,"Tamaño distinto al de la versión aprobada: "+item.path);
 const gitHash=createHash("sha1")
   .update("blob "+bytes.length+"\0")
   .update(bytes).digest("hex");
 assert.equal(gitHash,item.gitSha1,"El medio original Git cambió: "+item.path);
 assert.ok(actual<=LIMIT,
   "El recurso supera 25 MiB, requiere otra estrategia GRATUITA sin recomprimir: "+item.path);
 total+=actual;
 if(actual>large)large=actual;
 if(item.type==="video/mp4")videos++;
 report.push({file:item.path,bytes:actual,mib:Math.round(actual/1048576*100)/100,
  type:item.type});
}
assert.equal(videos,5);
assert.ok(total<100*1024*1024);
console.log("OK: 17/17 recursos originales encajan en límite individual 25 MiB de Static Assets Free");
console.log("OK: 5/5 MP4 conservan todos sus bytes y su hash Git; no hay recompresión");
console.log("RESUMEN: "+JSON.stringify({
 items:report.length,videos,totalBytes:total,
 totalMiB:Math.round(total/1048576*100)/100,
 largestBytes:large,largestMiB:Math.round(large/1048576*100)/100,
 assetMaxMiB:25,filesMaxFree:20000
}));
console.log("BLOQUEO IMPORTANTE: Static Assets responde HTTP 200 a Range por defecto.");
console.log("Safari/iPhone requiere respuesta 206 verificable; servir vídeos requeriría Worker o alternativa que responda Range.");
console.log("Esta auditoría NO prueba un backend Static Assets funcionando ni el coste del streaming Range en Workers Free.");
console.log("Archivos de galería subidos por administradores NO son recursos estáticos y necesitan solución separada.");
console.log("No se ha desplegado ni contratado nada.");
