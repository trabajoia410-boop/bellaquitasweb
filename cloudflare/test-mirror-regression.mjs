/**
 * Bellaquitas Fest — pruebas locales de seguridad de la migración.
 * node cloudflare/test-mirror-regression.mjs
 *
 * No realiza peticiones de red ni accede a D1/R2: utiliza roles y DB ficticios.
 * Verifica que el espejo respeta el diseño original y que el administrador
 * no puede efectuar cambios mientras staging esté bloqueado.
 */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {dirname,join} from "node:path";

const here=dirname(fileURLToPath(import.meta.url));
const file=path=>readFileSync(join(here,path),"utf8");
function loadModule(path,name,injections){
 const code=file(path).replace(/^import[^\n]*\n/gm,"")
  .replace(/^export /gm,"");
 const keys=Object.keys(injections);
 return new Function(...keys,code+"\nreturn "+name+";")(...Object.values(injections));
}
const base="https://staging.example";
const database={
 calls:0,
 prepare(){
  this.calls++;
  return {
   bind(){return this;},
   async all(){return {results:[]};},
   async first(){return null;},
   async run(){throw Error("No debe escribir en DB");}
  };
 },
 async batch(){this.calls++;return [{results:[]},{results:[]},{results:[]}]}
};
let profile=null;
const authenticatedProfile=async()=>profile;
const checkOrigin=request=>request.headers.get("Origin")===base;
const injections={authenticatedProfile,checkOrigin,Response,URL};
const read=loadModule("mirror-data-routes.js","mirrorDataRoute",injections);
const write=loadModule("mirror-write-routes.js","mirrorWriteRoute",injections);
const env={DB:database,MEDIA:{},STAGING_MUTATIONS:"disabled"};

async function expect(path,method,role,origin,status){
 profile=role?{
  id:"11111111-1111-4111-8111-111111111111",
  member_code:"MBR-QAFAKE123",name:"Ficticio",role,points:0,visits:0
 }:null;
 const request=new Request(base+path,{
  method,headers:{"Origin":origin,"Content-Type":"application/json"},
  ...(method==="POST"?{body:JSON.stringify({
   kind:"catalog",table:"events",action:"insert",
   item:{name:"Evento ficticio",date_label:"2026-11-20",location:"París"}
  })}:{})
 });
 const result=await (method==="POST"?write(request,env):read(request,env));
 assert.equal(result?.status,status,path+" / "+method+" / "+role);
}
for(const [role,origin,status] of [
 [null,base,401],["socio",base,403],["puerta",base,403],
 ["admin","https://attacker.example",403],["admin",base,423]
]){
 await expect("/v1/mirror/admin/write","POST",role,origin,status);
}
for(const [role,status] of [
 [null,401],["socio",403],["puerta",403],["admin",200]
]){
 await expect("/v1/mirror/admin/catalog/events","GET",role,base,status);
}
await expect("/v1/mirror/public/photos","GET",null,base,200);

// Paridad exacta entre el diseño del sitio en la rama y la copia congelada.
const snapshot=loadModule("mirror-snapshot.js","MIRROR_SNAPSHOT",{});
for(const path of ["index.html","app.js","styles.css",
 "locale-fr.js","assets/qr-local.js","assets/jsqr-local.js"]){
 assert.equal(snapshot[path],readFileSync(join(here,"..",path),"utf8"),
  path+" debe conservarse idéntico a la fuente visual");
}
// La copia congelada no depende de solicitudes dinámicas a Supabase.
const mirror=file("web-mirror.js");
assert.ok(mirror.includes("MIRROR_SNAPSHOT"));
assert.ok(mirror.includes("sameDesignHTML"));
assert.ok(mirror.includes("sameDesignJS"));
assert.ok(mirror.includes("STAGING")===false || mirror.includes("PRUEBAS"));
assert.ok(mirror.includes("https://challenges.cloudflare.com"));
const bridge=file("web-mirror-bridge.js");
assert.ok(bridge.includes('requestJson("/v1/auth/me")'));
assert.ok(bridge.includes('"/v1/mirror/admin/write"'));
assert.ok(!bridge.includes("createClient(cfg.supabaseUrl"));
console.log("✓ Roles y permisos del espejo: 10 casos, todas las mutaciones protegidas.");
console.log("✓ Paridad de 6 archivos originales HTML/CSS/JS/FR/QR.");
console.log("✓ Datos conectados solo a Cloudflare en el espejo.");
console.log("Pruebas terminadas. No se modificó ningún dato real.");
