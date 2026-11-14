/**
 * Bellaquitas Fest, fase 5: integración del editor sobre SQLite aislado.
 *
 * Usa los módulos del Worker desplegado y sus migraciones SQL reales.
 * NO CREA recursos Cloudflare, NO se conecta a la red, NO usa datos de socios.
 * Ejecutar solo en GitHub Actions o local:
 *   node --experimental-sqlite cloudflare/staging-source-2026-11-11/extract-modules.mjs
 *   node --experimental-sqlite --experimental-default-type=module --test cloudflare/test_staging_editor.mjs
 */
import assert from "node:assert/strict";
import {test} from "node:test";
import {DatabaseSync} from "node:sqlite";
import {readFileSync} from "node:fs";
import {fileURLToPath,pathToFileURL} from "node:url";
import path from "node:path";
import {webcrypto} from "node:crypto";

const here=path.dirname(fileURLToPath(import.meta.url));
const src=path.join(here,"staging-source-2026-11-11","recovered-src");
const {mirrorWriteRoute}=await import(pathToFileURL(path.join(src,"mirror-write-routes.js")).href);
const {mirrorDataRoute}=await import(pathToFileURL(path.join(src,"mirror-data-routes.js")).href);
const {createAuthSession}=await import(pathToFileURL(path.join(src,"auth-routes.js")).href);
const BASE="https://bellaquitas-api-staging.bellaquitas-fest-410.workers.dev";
const ADMIN="00000000-0000-4000-8000-000000000011";
const SOCIO="00000000-0000-4000-8000-000000000012";
const DOOR="00000000-0000-4000-8000-000000000013";
const EVENT="00000000-0000-4000-8000-000000000014";
const validEvent={name:"Fiesta ficticia",date_label:"2027-01-10",location:"Sala de pruebas",
  description:"Evento completamente ficticio",active:true,start_time:"21:30",
  image_url:"",localized_content:{fr:{name:"Soirée fictive"}}};
const statCount=(db,table)=>db.prepare("SELECT COUNT(*) AS n FROM "+table).get().n;

class D1Memory{
  constructor(){this.raw=new DatabaseSync(":memory:");this.raw.exec("PRAGMA foreign_keys=ON");
    for(const file of ["0001-schema.sql","0002-auth-and-invariants.sql","0003-oauth-sessions.sql"])
      this.raw.exec(readFileSync(path.join(here,"migrations",file),"utf8"));
    this.raw.prepare("INSERT INTO profiles(id,name,role,member_code) VALUES (?,?,?,?)")
      .run(ADMIN,"Administrador ficticio","admin","MBR-QA-ADMIN");
    this.raw.prepare("INSERT INTO profiles(id,name,role,member_code) VALUES (?,?,?,?)")
      .run(SOCIO,"Socio ficticio","socio","MBR-QA-SOCIO");
    this.raw.prepare("INSERT INTO profiles(id,name,role,member_code) VALUES (?,?,?,?)")
      .run(DOOR,"Personal ficticio","puerta","MBR-QA-PUERTA");
  }
  prepare(sql){
    const s=this.raw.prepare(sql);
    return {
      bind(...params){
        return {
          async first(){return s.get(...params)??null;},
          async all(){return {results:s.all(...params)};},
          async run(){return {success:true,meta:s.run(...params)};}
        };
      },
      async first(){return s.get()??null;},
      async all(){return {results:s.all()};},
      async run(){return {success:true,meta:s.run()};}
    };
  }
  async batch(stmts){return await Promise.all(stmts.map(s=>s.run()));}
  close(){this.raw.close();}
}
class R2Memory{
  constructor(){this.items=new Map();}
  async put(key,content,options){
    this.items.set(key,{body:new Uint8Array(content),httpMetadata:options?.httpMetadata||{}});
  }
  async get(key){const v=this.items.get(key);return v?{body:v.body,httpMetadata:v.httpMetadata}:null;}
  async delete(key){this.items.delete(key);}
}
async function fixture(){
  const DB=new D1Memory(),MEDIA=new R2Memory();
  const env={DB,MEDIA,PUBLIC_ORIGIN:BASE,STAGING_MUTATIONS:"enabled"};
  const cookieFor={};
  for(const [key,id] of [["admin",ADMIN],["socio",SOCIO],["puerta",DOOR]]){
    const full=await createAuthSession(id,env);
    cookieFor[key]=full.split(";")[0];
  }
  return {env,db:DB.raw,DB,MEDIA,cookieFor,close:()=>DB.close()};
}
function request(route,{role="admin",cookieFor,method="POST",data,origin=BASE,body,mime}={}){
  const headers={"Origin":origin,"Sec-Fetch-Site":origin===BASE?"same-origin":"cross-site"};
  if(role!=="none"&&cookieFor)headers.Cookie=cookieFor[role];
  if(data!==undefined){headers["Content-Type"]="application/json";body=JSON.stringify(data);}
  if(mime)headers["Content-Type"]=mime;
  return new Request(BASE+route,{method,headers,body});
}
async function write(f,data,{role="admin",origin=BASE}={}){
  const r=await mirrorWriteRoute(request("/v1/mirror/admin/write",{
    cookieFor:f.cookieFor,role,origin,data
  }),f.env);
  const obj=await r.json();return {status:r.status,body:obj};
}
async function read(f,route,role="admin"){
  const r=await mirrorDataRoute(request(route,{cookieFor:f.cookieFor,role,method:"GET"}),f.env);
  const obj=await r.json();return {status:r.status,body:obj};
}
async function withFixture(fn){
  const f=await fixture();
  try{await fn(f);}finally{f.close();}
}
test("admin puede crear evento y leerlo desde catálogo, socio no puede",async()=>{
  await withFixture(async f=>{
    const inserted=await write(f,{kind:"catalog",table:"events",action:"insert",item:validEvent});
    assert.equal(inserted.status,200,JSON.stringify(inserted));
    assert.match(inserted.body.id,/^[a-f0-9-]{36}$/);
    const r=await read(f,"/v1/mirror/admin/catalog/events");
    assert.equal(r.status,200);
    assert.equal(r.body.items.length,1);
    assert.equal(r.body.items[0].name,validEvent.name);
    assert.deepEqual(r.body.items[0].localized_content,validEvent.localized_content);
    const denied=await read(f,"/v1/mirror/admin/catalog/events","socio");
    assert.equal(denied.status,403);
  });
});
test("admin puede actualizar, desactivar y borrar evento aislado",async()=>{
  await withFixture(async f=>{
    const inserted=await write(f,{kind:"catalog",table:"events",action:"insert",item:validEvent});
    const id=inserted.body.id;
    const updated=await write(f,{kind:"catalog",table:"events",action:"update",id,
      item:{...validEvent,name:"Evento editado"}});
    assert.equal(updated.status,200);
    assert.equal(f.db.prepare("SELECT name FROM events WHERE id=?").get(id).name,"Evento editado");
    assert.equal((await write(f,{kind:"catalog",table:"events",action:"toggle",id,active:false})).status,200);
    assert.equal(f.db.prepare("SELECT active FROM events WHERE id=?").get(id).active,0);
    assert.equal((await write(f,{kind:"catalog",table:"events",action:"delete",id})).status,200);
    assert.equal(statCount(f.db,"events"),0);
  });
});
test("admin puede crear y desactivar premios y promociones sin afectar puntos",async()=>{
  await withFixture(async f=>{
    const prize=await write(f,{kind:"catalog",table:"rewards",action:"insert",item:{
      name:"Premio de ensayo",description:"Ficticio",category:"Premios",cost:15,
      active:true,localized_content:{fr:{name:"Lot de test"}}
    }});
    assert.equal(prize.status,200,JSON.stringify(prize));
    const promo=await write(f,{kind:"catalog",table:"promos",action:"insert",item:{
      name:"Promoción ficticia",description:"Ficticia",bonus:10,active:true
    }});
    assert.equal(promo.status,200,JSON.stringify(promo));
    const res=await read(f,"/v1/mirror/admin/catalog/rewards");
    assert.equal(res.body.items.length,1);
    const rows=f.db.prepare("SELECT points,visits FROM profiles ORDER BY id").all();
    assert.ok(rows.every(x=>x.points===0&&x.visits===0));
  });
});
test("borrador editable y publicación reflejan textos y traducción",async()=>{
  await withFixture(async f=>{
    const original={hero_text:"Bellaquitas Fest ficticio",announcement:"Prueba aislada",
      ui_copy:{es:{nav:"Eventos"},fr:{nav:"Événements"}},logo_url:"/v1/assets/logos/ficticio.png"};
    const saved=await write(f,{kind:"site_drafts",action:"save",settings:original});
    assert.equal(saved.status,200,JSON.stringify(saved));
    const drafts=await read(f,"/v1/mirror/admin/site-drafts");
    assert.equal(drafts.status,200);
    assert.equal(drafts.body.items[0].settings.ui_copy.fr.nav,"Événements");
    const published=await write(f,{kind:"site_content",action:"publish",settings:original});
    assert.equal(published.status,200,JSON.stringify(published));
    const row=f.db.prepare("SELECT hero_text,page_settings FROM site_content WHERE key='homepage'").get();
    assert.equal(row.hero_text,original.hero_text);
    assert.equal(JSON.parse(row.page_settings).announcement,original.announcement);
  });
});
test("guardado de texto de portada no elimina configuración de diseño",async()=>{
  await withFixture(async f=>{
    const original={hero_text:"Bellaquitas Fest ficticio",announcement:"Una noche de fiesta",
      theme:"classic",ui_copy:{fr:{title:"Soirée"}}};
    assert.equal((await write(f,{kind:"site_content",action:"publish",settings:original})).status,200);
    assert.equal((await write(f,{kind:"site_content",action:"save_text",hero_text:"Bellaquitas Fiesta Nueva",
      announcement:"Anuncio nuevo"})).status,200);
    const s=f.db.prepare("SELECT page_settings,hero_text FROM site_content").get();
    assert.equal(s.hero_text,"Bellaquitas Fiesta Nueva");
    assert.equal(JSON.parse(s.page_settings).ui_copy.fr.title,"Soirée");
  });
});
test("socio y puerta no pueden modificar borradores ni catálogo",async()=>{
  await withFixture(async f=>{
    for(const role of ["socio","puerta"]){
      assert.equal((await write(f,{kind:"site_drafts",action:"save",settings:{hero_text:"X"}},{role})).status,403);
      assert.equal((await write(f,{kind:"catalog",table:"events",action:"insert",item:validEvent},{role})).status,403);
    }
    assert.equal(statCount(f.db,"events"),0);
    assert.equal(statCount(f.db,"site_drafts"),0);
  });
});
test("un admin no puede editar desde origen ajeno ni con staging bloqueado",async()=>{
  await withFixture(async f=>{
    assert.equal((await write(f,{kind:"catalog",table:"events",action:"insert",item:validEvent},
      {origin:"https://malicioso.invalid"})).status,403);
    f.env.STAGING_MUTATIONS="disabled";
    assert.equal((await write(f,{kind:"catalog",table:"events",action:"insert",item:validEvent})).status,423);
    assert.equal(statCount(f.db,"events"),0);
  });
});
test("rechazo de tablas, fechas, precios y URLs fuera de contrato",async()=>{
  await withFixture(async f=>{
    const samples=[
      {kind:"catalog",table:"profiles",action:"delete",id:EVENT},
      {kind:"catalog",table:"events",action:"insert",item:{...validEvent,date_label:"mal"}},
      {kind:"catalog",table:"events",action:"insert",item:{...validEvent,image_url:"javascript:alert(1)"}},
      {kind:"catalog",table:"rewards",action:"insert",item:{name:"Premio",description:"",cost:-1}},
      {kind:"catalog",table:"promos",action:"insert",item:{name:"Bono",description:"",bonus:-5}}
    ];
    for(const body of samples){
      const r=await write(f,body);
      assert.equal(r.status,409,JSON.stringify({body,status:r.status,result:r.body}));
    }
    assert.equal(statCount(f.db,"events"),0);
    assert.equal(statCount(f.db,"rewards"),0);
    assert.equal(statCount(f.db,"promos"),0);
  });
});
test("no se puede borrar contenido audiovisual original desde el editor",async()=>{
  await withFixture(async f=>{
    const orig="site-original/bellaquitas fiesta portada.mp4";
    await f.MEDIA.put(orig,new Uint8Array([1,2,3]),{httpMetadata:{contentType:"video/mp4"}});
    const result=await write(f,{kind:"media",action:"remove",keys:[orig]});
    assert.equal(result.status,409);
    assert.ok(f.MEDIA.items.has(orig));
  });
});
test("subida PNG ficticia a R2 y acceso de administrador",async()=>{
  await withFixture(async f=>{
    const png=new Uint8Array([137,80,78,71,13,10,26,10,1,2,3,4]);
    const upload=await mirrorWriteRoute(request("/v1/mirror/admin/media/upload?category=events",{
      cookieFor:f.cookieFor,method:"PUT",body:png,mime:"image/png"
    }),f.env);
    assert.equal(upload.status,200);
    const obj=await upload.json();
    assert.ok(obj.key.startsWith("media/events/"));
    assert.ok(f.MEDIA.items.has(obj.key));
    const full="/v1/mirror/"+obj.key;
    const response=await mirrorWriteRoute(request(full,{cookieFor:f.cookieFor,method:"GET"}),f.env);
    assert.equal(response.status,200);
    assert.equal(response.headers.get("content-type"),"image/png");
    assert.equal((await response.arrayBuffer()).byteLength,png.length);
    assert.equal((await write(f,{kind:"media",action:"remove",keys:[obj.key]})).status,200);
    assert.equal(f.MEDIA.items.size,0);
  });
});
test("subida con firma falsa queda rechazada y R2 permanece vacío",async()=>{
  await withFixture(async f=>{
    const upload=await mirrorWriteRoute(request("/v1/mirror/admin/media/upload?category=events",{
      cookieFor:f.cookieFor,method:"PUT",body:new Uint8Array([1,2,3,4]),mime:"image/png"
    }),f.env);
    assert.equal(upload.status,409);
    assert.equal(f.MEDIA.items.size,0);
  });
});
test("la edición nunca altera puntos, visitas ni identidades",async()=>{
  await withFixture(async f=>{
    const before=f.db.prepare("SELECT id,points,visits FROM profiles ORDER BY id").all();
    await write(f,{kind:"catalog",table:"events",action:"insert",item:validEvent});
    await write(f,{kind:"site_drafts",action:"save",settings:{hero_text:"Fiesta ficticia"}});
    await write(f,{kind:"site_content",action:"publish",settings:{hero_text:"Fiesta ficticia"}});
    assert.deepEqual(f.db.prepare("SELECT id,points,visits FROM profiles ORDER BY id").all(),before);
    assert.equal(statCount(f.db,"auth_identity_links"),0);
  });
});
