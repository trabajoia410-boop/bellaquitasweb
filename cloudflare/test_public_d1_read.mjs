/**
 * D1-only public web; SQLite in-memory fixtures, no external network or PII.
 * To run:
 * node cloudflare/staging-source-2026-11-11/extract-modules.mjs
 * node --experimental-default-type=module cloudflare/assemble-admin-candidate.mjs
 * node --experimental-sqlite --experimental-default-type=module --test cloudflare/test_public_d1_read.mjs
 */
import {test} from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {fileURLToPath,pathToFileURL} from "node:url";
const HERE=fileURLToPath(new URL(".",import.meta.url));
const dir=join(HERE,"staging-source-2026-11-11","recovered-src");
const {publicD1ReadRoute}=await import(pathToFileURL(join(dir,"public-d1-read-routes.js")).href);
const {createAuthSession}=await import(pathToFileURL(join(dir,"auth-routes.js")).href);
const db=new DatabaseSync(":memory:");
db.exec("PRAGMA foreign_keys=ON");
db.exec(readFileSync(join(HERE,"migrations","0001-schema.sql"),"utf8"));
db.exec(readFileSync(join(HERE,"migrations","0003-oauth-sessions.sql"),"utf8"));
for(const [id,role,points] of [["a","admin",31],["p","puerta",0],["s","socio",8],["o","socio",101]]){
 db.prepare("INSERT INTO profiles(id,name,role,member_code,points,lifetime_points,visits) VALUES (?,?,?,?,?,?,?)")
 .run(id,"FICTICIO "+role,role,"MBR-FAKE-"+id,points,points,0);
}
db.prepare("INSERT INTO rewards(id,name,cost) VALUES ('r','FAKE',2)").run();
for(const [id,user,cost] of [["r1","s",2],["r2","o",2]]){
 db.prepare("INSERT INTO redemptions(id,code,user_id,reward_id,cost) VALUES (?,?,?,?,?)")
 .run(id,"CNJ-FAKE-"+id,user,"r",cost);
}
for(const [id,user] of [["e1","s"],["e2","o"]]){
 db.prepare("INSERT INTO activity(id,user_id,type,delta,detail) VALUES (?,?,'visita',0,'FICTION')").run(id,user);
}
db.prepare("INSERT INTO moments_albums(id,title,event_date,published) VALUES ('public','PUBLIC TEST','2026-11-01',1)").run();
db.prepare("INSERT INTO moments_albums(id,title,event_date,published) VALUES ('secret','PRIVATE TEST','2026-11-01',0)").run();
for(const [id,album,path] of [
 ["photo1","public","assets/galeria/fiesta.webp"],
 ["photo2","public","legacy-private-storage/personal.jpg"],
 ["photo3","secret","assets/galeria/secret.jpg"],
 ["photo4","public","assets/../private.jpg"]
]){
 db.prepare("INSERT INTO moments_photos(id,album_id,storage_path) VALUES (?,?,?)").run(id,album,path);
}
const DB={
 prepare(sql){
  const statement=db.prepare(sql);
  return {bind(...args){return {
    first:async()=>statement.get(...args)||null,
    all:async()=>({results:statement.all(...args)}),
    run:async()=>statement.run(...args)
  };}, first:async()=>statement.get()||null,
  all:async()=>({results:statement.all()}),
  run:async()=>statement.run()};
 }
};
const env={DB},cookies={};
for(const id of ["a","p","s","o"]){
 const header=await createAuthSession("00000000-0000-4000-8000-00000000000"+({a:"1",p:"2",s:"3",o:"4"}[id]),{
  DB:{
   ...DB,
   prepare(sql){
    if(!sql.includes("INSERT INTO auth_sessions"))return DB.prepare(sql);
    return {
     bind(hash,uuid,ttl){
      return {run:async()=>{
       db.prepare("INSERT INTO auth_sessions(token_hash,profile_id,expires_at) VALUES (?,?,unixepoch()+?)")
       .run(hash,id,ttl);
      }};
     }
    };
   }
  }
 });
 cookies[id]=header.split(";")[0];
}
const invoke=async(path,id,method="GET")=>{
 const headers=id?{Cookie:cookies[id]}:{};
 const res=await publicD1ReadRoute(new Request("https://bellaquitas.fr"+path,{method,headers}),env);
 assert.ok(res,"Route not registered "+path);
 return {status:res.status,payload:await res.json(),headers:res.headers};
};
test("invitado sin cookie no consulta socios ni puerta",async()=>{
 for(const path of ["/v1/me/overview","/v1/door/overview"]){
  const r=await invoke(path);
  assert.equal(r.status,401);
  assert.equal(r.headers.get("cache-control"),"private, no-store");
 }
});
test("socio recibe solo su perfil, sus canjes y su actividad",async()=>{
 const {status,payload}=await invoke("/v1/me/overview","s");
 assert.equal(status,200);
 assert.equal(payload.profile.id,"s");
 assert.equal(payload.profile.points,8);
 assert.equal(payload.redemptions.length,1);
 assert.equal(payload.redemptions[0].user_id,"s");
 assert.equal(payload.activity.length,1);
 assert.equal(payload.activity[0].id,"e1");
 assert.ok(!JSON.stringify(payload).includes("CNJ-FAKE-r2"));
});
test("socios no acceden a registros del personal",async()=>{
 assert.equal((await invoke("/v1/door/overview","s")).status,403);
 assert.equal((await invoke("/v1/door/overview","o")).status,403);
});
test("personal puerta ve socios y canjes pendientes sin contraseñas",async()=>{
 for(const role of ["a","p"]){
  const {status,payload}=await invoke("/v1/door/overview",role);
  assert.equal(status,200);
  assert.equal(payload.members.length,2);
  assert.equal(payload.redemptions.length,2);
  assert.ok(!JSON.stringify(payload).includes("password"));
 }
});
test("fotos de galerías: solo publicadas y con rutas estáticas propias",async()=>{
 const r=await invoke("/v1/moments/public-photos");
 assert.equal(r.status,200);
 assert.equal(r.payload.items.length,1);
 assert.equal(r.payload.items[0].image_url,"/assets/galeria/fiesta.webp");
});
test("métodos de escritura no son aceptados por rutas de lectura",async()=>{
 assert.equal((await invoke("/v1/me/overview","a","POST")).status,405);
 assert.equal((await invoke("/v1/moments/public-photos",null,"DELETE")).status,405);
});
test("rutas ajenas pasan al siguiente handler",async()=>{
 const r=await publicD1ReadRoute(new Request("https://bellaquitas.fr/v1/events"),env);
 assert.equal(r,null);
});
console.log("OK: D1 público solo lectura, datos propios, puerta privada, medios estáticos.");
