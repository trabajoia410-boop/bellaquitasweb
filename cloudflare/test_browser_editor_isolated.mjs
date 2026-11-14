/**
 * QA visual del panel/editor REAL del Worker en Chrome, con D1 :memory:.
 *
 * - El servidor local de prueba inyecta exclusivamente una sesión admin ficticia.
 * - Ningún login externo, correo, cuenta, punto, QR real ni servicio de pago.
 * - El Worker se importa desde su snapshot desplegado (17 módulos).
 * - Las escrituras se permiten SOLO en esta base SQLite temporal.
 */
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {createServer} from "node:http";
import {once} from "node:events";
import {readFileSync,existsSync,mkdirSync,writeFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath,pathToFileURL} from "node:url";
import {chromium} from "playwright-core";

const HERE=path.dirname(fileURLToPath(import.meta.url));
const recovered=path.join(HERE,"staging-source-2026-11-11","recovered-src");
const {default:worker}=await import(pathToFileURL(path.join(recovered,"bellaquitas-api-staging.js")).href);
const {createAuthSession}=await import(pathToFileURL(path.join(recovered,"auth-routes.js")).href);
const {SITE_MEDIA}=await import(pathToFileURL(path.join(recovered,"site-media-manifest.js")).href);
const ADMIN="00000000-0000-4000-8000-000000000111";
const USER="00000000-0000-4000-8000-000000000112";
const OUT="browser-editor-evidence";mkdirSync(OUT,{recursive:true});
const DB=new DatabaseSync(":memory:");
DB.exec("PRAGMA foreign_keys=ON");
for(const file of ["0001-schema.sql","0002-auth-and-invariants.sql","0003-oauth-sessions.sql"]){
  DB.exec(readFileSync(path.join(HERE,"migrations",file),"utf8"));
}
DB.prepare("INSERT INTO profiles(id,name,role,member_code) VALUES (?,?,?,?)").run(
  ADMIN,"Administrador totalmente ficticio","admin","MBR-QA-ADMIN-0001"
);
DB.prepare("INSERT INTO profiles(id,name,role,member_code) VALUES (?,?,?,?)").run(
  USER,"Socio totalmente ficticio","socio","MBR-QA-USER-0002"
);
const D1={
  prepare(sql){
    const s=DB.prepare(sql);
    return {
      bind(...args){return {
        async first(){return s.get(...args)??null;},
        async all(){return {results:s.all(...args)};},
        async run(){return {success:true,meta:s.run(...args)};}
      };},
      async first(){return s.get()??null;},
      async all(){return {results:s.all()};},
      async run(){return {success:true,meta:s.run()};}
    };
  },
  async batch(stmts){const rows=[];for(const s of stmts)rows.push(await s.run());return rows;}
};
const R2={
  async get(key,options={}){
    if(!key.startsWith("site-original/"))return null;
    const name=key.slice("site-original/".length);
    const expected=SITE_MEDIA.find(f=>f.path===name);
    if(!expected)return null;
    const disk=path.join(HERE,"..","assets",name);
    if(!existsSync(disk))return null;
    const bytes=readFileSync(disk);
    if(bytes.length!==expected.bytes)throw Error("Archivo Git inesperado: "+name);
    const requested=options.range?.get?.("Range")||"";
    const range=/^bytes=(\d+)-(\d*)$/.exec(requested);
    let offset=0,length=bytes.length;
    if(range){offset=Number(range[1]);length=Math.min(bytes.length-offset,range[2]?Number(range[2])-offset+1:bytes.length-offset);}
    return {
      size:bytes.length,customMetadata:{gitSha1:expected.gitSha1},httpEtag:'"'+expected.gitSha1+'"',
      range:range?{offset,length}:null,body:bytes.subarray(offset,offset+length),
      writeHttpMetadata(headers){headers.set("Content-Type",expected.type);}
    };
  },
  async head(key){const object=await this.get(key);if(!object)return null;return {...object,body:null};},
  async put(){throw Error("No se suben archivos en la prueba del editor");},
  async delete(){throw Error("No se borran archivos en la prueba del editor");}
};
const env={DB:D1,MEDIA:R2,STAGING_MUTATIONS:"enabled",ALLOW_NEW_ACCOUNTS:"no"};
const cookie=(await createAuthSession(ADMIN,env)).split(";")[0];
const server=createServer(async(req,res)=>{
  try{
    const host="http://127.0.0.1:"+server.address().port;
    env.PUBLIC_ORIGIN=host;
    const body=[];
    for await(const part of req)body.push(part);
    const raw=Buffer.concat(body);
    const h=new Headers();
    for(const [key,value] of Object.entries(req.headers))if(value!==undefined)h.set(key,Array.isArray(value)?value.join(","):value);
    // Nunca use cookies del navegador de un usuario: forzamos identidad FICTICIA.
    h.set("Cookie",cookie);
    const pathname=new URL(req.url,host);
    const wr=new Request(pathname.toString(),{
      method:req.method,headers:h,
      ...(raw.length?{body:raw,duplex:"half"}:{})
    });
    const response=await worker.fetch(wr,env);
    const headers={};for(const [key,val] of response.headers.entries())headers[key]=val;
    res.writeHead(response.status,headers);
    const output=new Uint8Array(await response.arrayBuffer());
    res.end(Buffer.from(output));
  }catch(error){console.error("Simulated Worker HTTP error:",error.message);res.writeHead(500);res.end("Simulated worker error");}
});
server.listen(0,"127.0.0.1");await once(server,"listening");
const host="http://127.0.0.1:"+server.address().port;
const chrome=process.env.CHROME_BIN||["/usr/bin/google-chrome","/usr/bin/chromium"].find(p=>existsSync(p));
assert.ok(chrome,"Chrome not found");
const browser=await chromium.launch({executablePath:chrome,headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
const ctx=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:"block"});
const page=await ctx.newPage();
const javascriptErrors=[],httpErrors=[],completed=[];
page.on("pageerror",e=>javascriptErrors.push(e.message.slice(0,250)));
page.on("response",r=>{if(r.url().startsWith(host)&&r.status()>=500)httpErrors.push({path:new URL(r.url()).pathname,status:r.status()});});
await page.route("**/*",async route=>{
  if(route.request().url().startsWith(host+"/"))return route.continue();
  return route.abort("blockedbyclient"); // no emails, auth, fonts or external requests
});
function pass(text){completed.push(text);console.log("OK: "+text);}
try{
  const health=await fetch(host+"/health");
  assert.equal(health.status,200);
  pass("Servidor Worker completo funciona en localhost, sin Cloudflare real");

  await page.goto(host+"/espejo/#/panel",{waitUntil:"domcontentloaded",timeout:40000});
  await page.locator("a[href='#/editor']").first().waitFor({state:"attached",timeout:30000});
  assert.equal(await page.locator("body .app-shell").count()>0,true);
  pass("Inicio de sesión admin FICTICIO carga el panel original");

  await page.goto(host+"/espejo/#/editor",{waitUntil:"domcontentloaded",timeout:40000});
  await page.locator("#editor-hero_text").waitFor({state:"attached",timeout:30000});
  assert.equal(await page.locator("[data-action='editor-save']").count()>0,true);
  assert.equal(await page.locator("[data-action='editor-publish']").count()>0,true);
  pass("Editor visual muestra textos, controles de guardado y publicación");

  const original=DB.prepare("SELECT hero_text FROM site_content WHERE key='homepage'").get()?.hero_text??null;
  await page.locator("#editor-hero_text").fill("Texto ficticio para comprobar Bellaquitas QA");
  await page.locator("[data-action='editor-save']").first().click();
  await page.waitForFunction(()=>{
    const state=document.querySelector("#editor-status");
    return state?.textContent?.includes("Borrador guardado");
  },null,{timeout:15000});
  const draft=DB.prepare("SELECT settings FROM site_drafts WHERE key='homepage'").get();
  assert.ok(draft);
  assert.equal(JSON.parse(draft.settings).hero_text,"Texto ficticio para comprobar Bellaquitas QA");
  assert.equal(DB.prepare("SELECT hero_text FROM site_content WHERE key='homepage'").get()?.hero_text??null,original);
  pass("Guardar borrador no cambia la versión publicada");

  page.on("dialog",d=>d.accept());
  await page.locator("[data-action='editor-publish']").first().click();
  await page.waitForFunction(()=>document.querySelector("#editor-status")?.textContent?.includes("Publicado para todos"),
    null,{timeout:15000});
  assert.equal(DB.prepare("SELECT hero_text FROM site_content WHERE key='homepage'").get().hero_text,
    "Texto ficticio para comprobar Bellaquitas QA");
  pass("Publicar desde interfaz modifica SOLO la base ficticia en memoria");

  const pub=await fetch(host+"/v1/site");
  assert.equal(pub.status,200);
  assert.equal((await pub.json()).site.hero_text,"Texto ficticio para comprobar Bellaquitas QA");
  pass("El contenido publicado aparece en el endpoint del Worker ficticio");

  // Cambiar idioma de edición NO puede sobrescribir el contenido español publicado.
  await page.locator("[data-action='editor-lang'][data-lang='fr']").click();
  await page.locator("#editor-hero_text").waitFor({state:"visible",timeout:10000});
  await page.locator("#editor-hero_text").fill("Texte fictif uniquement pour les tests Bellaquitas");
  await page.locator("[data-action='editor-save']").first().click();
  await page.waitForFunction(()=>document.querySelector("#editor-status")?.textContent?.includes("Borrador guardado"),
    null,{timeout:15000});
  const localizedDraft=JSON.parse(DB.prepare("SELECT settings FROM site_drafts WHERE key='homepage'").get().settings);
  assert.equal(localizedDraft.translations.fr.hero_text,"Texte fictif uniquement pour les tests Bellaquitas");
  assert.equal(localizedDraft.hero_text,"Texto ficticio para comprobar Bellaquitas QA");
  pass("Borrador en francés se guarda sin sobrescribir español");

  await page.locator("[data-action='editor-publish']").first().click();
  await page.waitForFunction(()=>document.querySelector("#editor-status")?.textContent?.includes("Publicado para todos"),
    null,{timeout:15000});
  const localizedPublished=JSON.parse(DB.prepare("SELECT page_settings FROM site_content WHERE key='homepage'").get().page_settings);
  assert.equal(localizedPublished.hero_text,"Texto ficticio para comprobar Bellaquitas QA");
  assert.equal(localizedPublished.translations.fr.hero_text,"Texte fictif uniquement pour les tests Bellaquitas");
  pass("Publicación ES/FR preserva ambos idiomas en D1 aislada");

  await page.locator("[data-action='editor-device'][data-device='mobile']").click();
  const preview=page.locator("#editor-preview");
  await preview.waitFor({state:"attached"});
  assert.ok(await preview.evaluate(el=>el.classList.contains("mobile")));
  assert.equal(await page.locator("[data-action='editor-device'][data-device='mobile']").getAttribute("aria-pressed"),"true");
  pass("Vista previa móvil del editor se activa correctamente");

  const totals=DB.prepare("SELECT COUNT(*) AS n, SUM(points) AS points,SUM(visits) AS visits FROM profiles").get();
  assert.equal(totals.n,2);
  assert.equal(totals.points,0);assert.equal(totals.visits,0);
  pass("Ninguna cuenta ficticia ha cambiado puntos ni visitas");

  assert.deepEqual(javascriptErrors,[],"Errores JS");
  assert.deepEqual(httpErrors,[],"Errores servidor");
  pass("Sin errores JS ni HTTP 5xx en flujos de editor");
  await page.screenshot({path:OUT+"/editor-publicado-ficticio.png",animations:"disabled",timeout:15000});
  console.log("RESULTADO: "+completed.length+" controles de interfaz admin aprobados");
}finally{
  writeFileSync(OUT+"/result.json",JSON.stringify({completed,javascriptErrors,httpErrors},null,2));
  await page.close();await ctx.close();await browser.close();
  await new Promise(r=>server.close(r));
  DB.close();
}
