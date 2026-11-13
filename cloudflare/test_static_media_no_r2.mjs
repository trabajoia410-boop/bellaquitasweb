/**
 * Medios originales de Bellaquitas Fest, sin acceso R2:
 * pruebas 100% offline del mismo Worker ensamblado para fase 5.
 */
import assert from "node:assert/strict";
import {test} from "node:test";
import path from "node:path";
import {fileURLToPath,pathToFileURL} from "node:url";
const dir=path.dirname(fileURLToPath(import.meta.url));
const recovered=path.join(dir,"staging-source-2026-11-11","recovered-src");
const {default:worker}=await import(pathToFileURL(path.join(recovered,"bellaquitas-api-staging.js")).href);
const BASE="https://bellaquitas-api-staging.example.test";
let paidR2Calls=0;
const MEDIA={async head(){paidR2Calls++;throw Error("No R2");},
 async get(){paidR2Calls++;throw Error("No R2");},
 async put(){paidR2Calls++;throw Error("No R2");},
 async delete(){paidR2Calls++;throw Error("No R2");}};
const env={COST_POLICY:"free-only",MEDIA,DB:{prepare(){throw Error("No se debe consultar D1 para contenido público estático");}}};
async function call(path,{method="GET",range}={}){
 const headers=range?{Range:range}:{};
 return worker.fetch(new Request(BASE+path,{method,headers,redirect:"manual"}),env);
}
test("cinco MP4 exactos apuntan a los originales públicos sin R2",async()=>{
 const files=[
  "Bellaquitas Fest para móvil.mp4",
  "bellaquitas fiesta portada movil.mp4",
  "bellaquitas fiesta portada.mp4",
  "bellaquitas-fiesta-fondo 1.mp4",
  "bellaquitas-fiesta-fondo.mp4"
 ];
 for(const name of files){
  const url="/espejo/assets/"+encodeURIComponent(name);
  for(const opts of [{},{method:"HEAD"},{range:"bytes=0-1023"}]){
   const r=await call(url,opts);
   assert.equal(r.status,307,url);
   assert.equal(r.headers.get("location"),
     "https://trabajoia410-boop.github.io/bellaquitasweb/assets/"+encodeURIComponent(name));
  }
 }
 assert.equal(paidR2Calls,0);
});
test("logos, iconos y tarjetas estáticos no dependen de R2",async()=>{
 for(const name of ["logo-navbar.png","logo-bellaquitas.webp",
  "tarjeta-qr-dorso.webp","icon-192.png","favicon.svg"]){
  const r=await call("/espejo/assets/"+name);
  assert.equal(r.status,307,name);
  assert.match(r.headers.get("location")||"",/github\.io\/bellaquitasweb\/assets\//);
 }
 assert.equal(paidR2Calls,0);
});
test("archivos desconocidos no se convierten en redirecciones abiertas",async()=>{
 const r=await call("/espejo/assets/no-existe.png");
 assert.equal(r.status,404);
 assert.equal(r.headers.get("location"),null);
 assert.equal(paidR2Calls,0);
});
test("el script QR original permanece en el Worker y no se descarga de GitHub",async()=>{
 const r=await call("/espejo/assets/qr-local.js");
 assert.equal(r.status,200);
 assert.match(r.headers.get("content-type")||"",/javascript/);
 assert.equal(r.headers.get("location"),null);
 assert.equal(paidR2Calls,0);
});
test("sin COST_POLICY se bloquea el Worker antes del media",async()=>{
 const bad={MEDIA,DB:env.DB};
 const r=await worker.fetch(new Request(BASE+"/espejo/assets/logo-navbar.png"),bad);
 assert.equal(r.status,503);
 assert.equal(paidR2Calls,0);
});
