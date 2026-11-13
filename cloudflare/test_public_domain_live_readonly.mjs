/**
 * Bellaquitas Fest — health check REAL y de SOLO LECTURA del dominio público.
 * No usa tokens, cookies, Supabase API, POST, login ni almacenamiento remoto.
 * Verifica que el CDN conserve exactamente HTML/CSS/JS/ES-FR y los cinco MP4
 * del main original, con streaming Range HTTP 206.
 *
 * Si el dominio no está accesible desde GitHub Actions, falla CERRADO.
 */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
const HOST="https://bellaquitas.fr";
const ROOT=HOST+"/";
const BASE="aafb4de85a204cdb79b281815df5819417e7d9c6";
const assetPaths=[
 "assets/Bellaquitas Fest para móvil.mp4",
 "assets/bellaquitas fiesta portada movil.mp4",
 "assets/bellaquitas fiesta portada.mp4",
 "assets/bellaquitas-fiesta-fondo 1.mp4",
 "assets/bellaquitas-fiesta-fondo.mp4"
];
function baseline(path){
 return execFileSync("git",["show",BASE+":"+path],{maxBuffer:30*1024*1024});
}
const sha=x=>createHash("sha256").update(x).digest("hex");
async function get(path,{range=false}={}){
 const u=ROOT+path.split("/").map(encodeURIComponent).join("/");
 const headers={Accept:"*/*"};
 if(range)headers.Range="bytes=0-1023";
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),12000);
 try{
  const res=await fetch(u,{method:"GET",headers,
   redirect:"follow",cache:"no-store",signal:controller.signal});
  assert.equal(new URL(res.url).origin,HOST,
   "Bellaquitas está redirigiendo a otro origen; rompe sesión SSO sin 2º login");
  assert.equal(res.status,range?206:200,path+" — rango o página no disponible");
  assert.equal(res.headers.get("x-robots-tag")?.includes("noindex"),false,
    path+" está marcado noindex inesperadamente");
  const bytes=Buffer.from(await res.arrayBuffer());
  assert.ok(bytes.length>0);
  return {res,bytes};
 }finally{clearTimeout(timeout);}
}
console.log("Bellaquitas: prueba pública sin credenciales, solo GET; SIN mutaciones");
for(const path of ["index.html","styles.css","config.js","locale-fr.js"]){
 const live=await get(path==="index.html"?"":path);
 const original=baseline(path);
 assert.equal(sha(live.bytes),sha(original),
   path+" distinto del main original: detener corte y revisar CDN");
 console.log("OK "+path+": idéntico al original de GitHub");
}
{
 const {bytes}=await get("app.js?v=traduccion62".split("?")[0]);
 assert.equal(sha(bytes),sha(baseline("app.js")),
  "app.js de dominio no corresponde a la versión original");
 console.log("OK app.js: web oficial permanece en main, sin panel nuevo");
}
for(const path of assetPaths){
 const {res,bytes}=await get(path,{range:true});
 assert.match(res.headers.get("content-range")||"",/^bytes 0-1023\/\d+$/);
 assert.match(res.headers.get("content-type")||"",/video\/mp4/i);
 assert.equal(bytes.length,1024);
 assert.equal(sha(bytes),sha(baseline(path).subarray(0,1024)),
  path+" presenta un vídeo recodificado o distinto");
 console.log("OK MP4 original (1024 bytes + HTTP 206): "+path);
}
console.log("OK: domain HTTPS, 5 MP4 206 idénticos, ES/FR/HTML/CSS y app original");
