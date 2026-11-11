/**
 * Integración COMPLETA del entrypoint Worker Bellaquitas Fest.
 *
 * El mismo código desplegado del Worker atiende las peticiones por su
 * export default.fetch, sobre D1 de SQLite :memory: y R2 simulado.
 * No existe acceso a Supabase/Cloudflare real, ni a sesiones de socios.
 */
import assert from "node:assert/strict";
import {test,before,after} from "node:test";
import {DatabaseSync} from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath,pathToFileURL} from "node:url";

const dir=path.dirname(fileURLToPath(import.meta.url));
const recovered=path.join(dir,"staging-source-2026-11-11","recovered-src");
const {default:worker}=await import(pathToFileURL(path.join(recovered,"bellaquitas-api-staging.js")).href);
const {createAuthSession}=await import(pathToFileURL(path.join(recovered,"auth-routes.js")).href);
const BASE="https://bellaquitas-api-staging.bellaquitas-fest-410.workers.dev";
const ADMIN="00000000-0000-4000-8000-000000000101";
const MEMBER="00000000-0000-4000-8000-000000000102";
const DOOR="00000000-0000-4000-8000-000000000103";
const EVENT="00000000-0000-4000-8000-000000000104";
const TITLE="Evento completamente ficticio de ensayo";
const ROLE_SEEDS=[
  [ADMIN,"Admin QA","admin","MBR-QA-TESTADMIN"],
  [MEMBER,"Socio QA","socio","MBR-QA-TESTSOCIO"],
  [DOOR,"Control QA","puerta","MBR-QA-TESTPUERTA"]
];
class DBMemory{
  constructor(){
    this.raw=new DatabaseSync(":memory:");
    this.raw.exec("PRAGMA foreign_keys=ON");
    for(const file of ["0001-schema.sql","0002-auth-and-invariants.sql","0003-oauth-sessions.sql"]){
      this.raw.exec(fs.readFileSync(path.join(dir,"migrations",file),"utf8"));
    }
    for(const entry of ROLE_SEEDS){
      this.raw.prepare("INSERT INTO profiles(id,name,role,member_code) VALUES (?,?,?,?)").run(...entry);
    }
    this.raw.prepare("INSERT INTO events(id,name,date_label,location,description,start_time,active,localized_content) VALUES (?,?,?,?,?,?,?,?)").run(
      EVENT,TITLE,"2027-03-20","Lugar ficticio","Descripción de ensayo","21:00",1,JSON.stringify({fr:{name:"Événement fictif"}})
    );
  }
  prepare(sql){
    const s=this.raw.prepare(sql);
    return {
      bind(...args){
        return {
          async first(){return s.get(...args)||null;},
          async all(){return {results:s.all(...args)};},
          async run(){return {success:true,meta:s.run(...args)};}
        };
      },
      async first(){return s.get()||null;},
      async all(){return {results:s.all()};},
      async run(){return {success:true,meta:s.run()};}
    };
  }
  async batch(stmts){
    const arr=[];for(const s of stmts)arr.push(await s.run());return arr;
  }
  close(){this.raw.close();}
}
class R2Memory{
  constructor(){this.objects=new Map();}
  async get(key){return this.objects.get(key)||null;}
  async put(key,body,options={}){this.objects.set(key,{body:new Uint8Array(body),httpMetadata:options.httpMetadata||{}});}
  async delete(key){this.objects.delete(key);}
}

const DB=new DBMemory(),MEDIA=new R2Memory();
const env={DB,MEDIA,PUBLIC_ORIGIN:BASE,STAGING_MUTATIONS:"enabled",ALLOW_NEW_ACCOUNTS:"no"};
const cookies={};
before(async()=>{
  for(const [role,id] of [["admin",ADMIN],["member",MEMBER],["door",DOOR]]){
    cookies[role]=(await createAuthSession(id,env)).split(";")[0];
  }
});
after(()=>DB.close());

async function request(route,{method="GET",role=null,origin=BASE,body,contentType}={}){
  const headers={
    Origin:origin,
    "Sec-Fetch-Site":origin===BASE?"same-origin":"cross-site"
  };
  if(role)headers.Cookie=cookies[role];
  if(body!==undefined)headers["Content-Type"]=contentType||"application/json";
  const req=new Request(BASE+route,{method,headers,
    body:body===undefined?undefined:(typeof body==="string"?body:JSON.stringify(body))});
  return worker.fetch(req,env);
}
async function expected(route,status,opts={}){
  const res=await request(route,opts);
  assert.equal(res.status,status,(opts.method||"GET")+" "+route+": HTTP "+res.status+" (esperado "+status+")");
  assert.equal(res.headers.get("x-content-type-options"),"nosniff");
  return res;
}
const eventDraft={
  name:"Evento editado de prueba",date_label:"2027-05-01",location:"Lugar imaginario",
  description:"Solo base en memoria",start_time:"22:00",active:true,
  localized_content:{fr:{name:"Événement modifié fictif"}},image_url:""
};
test("Worker completo: salud D1 y R2 del entorno SIMULADO",async()=>{
  const res=await expected("/health",200);
  const data=await res.json();
  assert.deepEqual([data.status,data.database,data.storage],["ok","connected","configured"]);
});
test("Worker completo: entrega espejo HTML, CSS, JS y francés originales",async()=>{
  for(const [url,mime,text] of [
    ["/espejo/","text/html","Bellaquitas Fest"],
    ["/espejo/styles.css","text/css","bf-neon"],
    ["/espejo/app.js","javascript","bf-hero-video"],
    ["/espejo/locale-fr.js","javascript","Événements"]
  ]){
    const res=await expected(url,200);
    assert.match(res.headers.get("content-type")||"",new RegExp(mime));
    assert.ok((await res.text()).includes(text),url+" no contiene recurso original");
  }
});
test("Worker completo: protege SEO del espejo de ensayo",async()=>{
  const res=await expected("/espejo/",200);
  assert.match(await res.text(),/noindex,nofollow/i);
});
test("Worker completo: evento original ficticio visible sin cookie",async()=>{
  const res=await expected("/v1/events",200);
  const body=await res.json();
  assert.equal(body.items.length,1);
  assert.equal(body.items[0].id,EVENT);
  assert.equal(body.items[0].localized_content.fr.name,"Événement fictif");
});
test("Worker completo: no revela perfil al visitante sin cookie",async()=>{
  const res=await expected("/v1/auth/me",200);
  const body=await res.json();
  assert.equal(body.authenticated,false);
  assert.equal(body.profile,null);
});
test("Worker completo: roles de las tres identidades ficticias",async()=>{
  for(const [role,expectedRole] of [["admin","admin"],["door","puerta"],["member","socio"]]){
    const r=await expected("/v1/auth/me",200,{role});
    const body=await r.json();
    assert.equal(body.authenticated,true);
    assert.equal(body.profile.role,expectedRole);
  }
});
test("Worker completo: un socio no lee catálogo administrativo",async()=>{
  await expected("/v1/mirror/admin/catalog/events",403,{role:"member"});
  await expected("/v1/admin/members",403,{role:"member"});
});
test("Worker completo: personal de puerta consulta puerta, no panel",async()=>{
  await expected("/v1/door/members",200,{role:"door"});
  await expected("/v1/admin/members",403,{role:"door"});
});
test("Worker completo: administrador accede a socios y eventos",async()=>{
  const a=await expected("/v1/admin/members",200,{role:"admin"});
  assert.equal((await a.json()).items.length,3);
  const b=await expected("/v1/mirror/admin/catalog/events",200,{role:"admin"});
  assert.equal((await b.json()).items.length,1);
});
test("Worker completo: publicar nuevo evento y verlo en lectura pública",async()=>{
  const res=await expected("/v1/mirror/admin/write",200,{method:"POST",role:"admin",
    body:{kind:"catalog",table:"events",action:"insert",item:eventDraft}});
  const {id}=await res.json();assert.ok(id);
  const pub=await expected("/v1/events",200);
  const rows=(await pub.json()).items;
  assert.equal(rows.length,2);
  assert.ok(rows.find(x=>x.id===id&&x.localized_content.fr.name==="Événement modifié fictif"));
  assert.equal(DB.raw.prepare("SELECT COUNT(*) AS n FROM profiles WHERE points != 0 OR visits != 0").get().n,0);
});
test("Worker completo: socio y puerta no publican contenido",async()=>{
  for(const role of ["member","door"]){
    await expected("/v1/mirror/admin/write",403,{method:"POST",role,
      body:{kind:"catalog",table:"events",action:"insert",item:eventDraft}});
  }
});
test("Worker completo: escritura bloqueada al activar modo seguro",async()=>{
  env.STAGING_MUTATIONS="disabled";
  await expected("/v1/mirror/admin/write",423,{method:"POST",role:"admin",
    body:{kind:"catalog",table:"events",action:"insert",item:eventDraft}});
  await expected("/v1/door/checkin",423,{method:"POST",role:"door",body:{code:"MBR-QA-TESTSOCIO"}});
  env.STAGING_MUTATIONS="enabled";
});
test("Worker completo: se rechazan solicitudes de modificación desde otra web",async()=>{
  await expected("/v1/mirror/admin/write",403,{method:"POST",role:"admin",
    origin:"https://externo.invalid",
    body:{kind:"catalog",table:"events",action:"insert",item:eventDraft}});
});
test("Worker completo: error JSON en vez de divulgar datos privados",async()=>{
  const res=await expected("/v1/not-existing",404);
  const b=await res.json();
  assert.equal(typeof b.error,"string");
  assert.ok(!JSON.stringify(b).includes("MBR-QA-TESTSOCIO"));
});
test("Worker completo: los saldos de todos los usuarios ficticios continúan en cero",()=>{
  const profiles=DB.raw.prepare("SELECT role,points,lifetime_points,visits FROM profiles").all();
  assert.equal(profiles.length,3);
  assert.ok(profiles.every(p=>p.points===0&&p.lifetime_points===0&&p.visits===0));
});
