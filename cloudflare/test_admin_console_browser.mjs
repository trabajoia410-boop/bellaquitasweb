/**
 * Bellaquitas Fest — prueba de la interfaz WordPress-like con Chrome real.
 * Todas las respuestas API son inventadas y locales. NUNCA usa cuentas
 * Cloudflare, Supabase, socios ni medios de pago.
 */
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {once} from "node:events";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath,pathToFileURL} from "node:url";
import {chromium} from "playwright-core";

const HERE=path.dirname(fileURLToPath(import.meta.url));
const recovered=path.join(HERE,"staging-source-2026-11-11","recovered-src");
const {ADMIN_HTML,ADMIN_CSS,ADMIN_JS}=await import(pathToFileURL(path.join(recovered,"admin-console-ui.js")).href);
const PUBLIC_JS=fs.readFileSync(path.join(HERE,"..","app.js"),"utf8");
const OUT="browser-admin-console-evidence";fs.mkdirSync(OUT,{recursive:true});
const events=[{id:"00000000-0000-4000-8000-000000000301",name:"Fiesta ficticia",date_label:"2027-01-20",start_time:"21:00",location:"Sala inventada",description:"Solo QA",active:true,localized_content:{fr:{name:"Soirée fictive"}}}];
const members=[{id:"00000000-0000-4000-8000-000000000302",name:"Socio inventado",member_code:"MBR-FAKE-QA",role:"socio",points:0,lifetime_points:0,visits:0}];
const payloads=[];

const albums=[],photos=[],photoBytes=new Map();
let current={hero_text:"Bellaquitas Fest",announcement:"Vive el momento",hero_title_a:"Bellaquitas",events_title:"Eventos",faq_1_q:"¿Cómo funciona?",logo_url:"",translations:{fr:{hero_text:"Bellaquitas en français"}}};
let draft=null;
function respond(res,data,status=200,extra={}){
 res.writeHead(status,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",...extra});
 res.end(JSON.stringify(data));
}
const server=createServer(async(req,res)=>{
 const url=new URL(req.url,"http://localhost"),pathname=url.pathname;
 if(pathname==="/espejo/assets/logo-navbar.png"){
  const image=fs.readFileSync(path.join(HERE,"..","assets","logo-navbar.png"));
  res.writeHead(200,{"Content-Type":"image/png"});res.end(image);return;
 }
 if(pathname==="/favicon.ico"){res.writeHead(204);res.end();return;}
 if(pathname==="/administracion/"||pathname==="/administracion/styles.css"||pathname==="/administracion/app.js"){
  res.writeHead(200,{"Content-Type":pathname.endsWith(".css")?"text/css":pathname.endsWith(".js")?"text/javascript":"text/html"});
  res.end(pathname.endsWith(".css")?ADMIN_CSS:pathname.endsWith(".js")?ADMIN_JS:ADMIN_HTML);
  return;
 }
 if(!pathname.startsWith("/administracion/api/")){respond(res,{error:"not found"},404);return;}
 let body={},rawBuffers=[];
 if(req.method!=="GET"){
  for await(const b of req)rawBuffers.push(b);
  if(rawBuffers.length&&String(req.headers["content-type"]||"").includes("application/json"))
   try{body=JSON.parse(Buffer.concat(rawBuffers).toString("utf8"));}catch{}
 }
 const suffix=pathname.slice("/administracion/api".length);
 // Prueba offline: la cookie de sesión PÚBLICA ya fue verificada fuera
 // del panel; en el Worker real la firma se comprueba contra D1.
 if(suffix==="/sso"){
  const siteLoggedIn=(req.headers.cookie||"").includes("qa_public_session=admin");
  return respond(res,siteLoggedIn?{ok:true,profile:{role:"admin",name:"Admin de ensayo"}}:
   {error:"No tienes una sesión administradora en la web"},siteLoggedIn?200:403,
   siteLoggedIn?{"Set-Cookie":"qa_admin=yes; HttpOnly; SameSite=Strict; Path=/"}:{});
 }
 if(suffix==="/login")return respond(res,{error:"No se solicita otra contraseña"},410);
 if(suffix==="/logout")return respond(res,{ok:true},200,
  {"Set-Cookie":"qa_admin=; Max-Age=0; HttpOnly; SameSite=Strict; Path=/"});
 const authenticated=(req.headers.cookie||"").includes("qa_admin=yes")&&
  (req.headers.cookie||"").includes("qa_public_session=admin");
 if(!authenticated){respond(res,{error:"Sesión administrativa no autorizada"},401);return;}
 if(suffix==="/me")return respond(res,{authenticated:true,profile:{role:"admin",name:"Admin de ensayo"}});
 if(suffix==="/events")return respond(res,{items:events});
 if(suffix==="/rewards")return respond(res,{items:[]});
 if(suffix==="/promos")return respond(res,{items:[]});
 if(suffix==="/members")return respond(res,{items:members});
 if(suffix==="/community")return respond(res,{suggestions:[{id:"00000000-0000-4000-8000-000000000303",name:"Persona ficticia",message:"Buena idea",status:"nuevo"}],albums,photos});
 if(suffix==="/site")return respond(res,{site:{hero_text:current.hero_text,announcement:current.announcement,settings:current}});
 if(suffix==="/site-drafts")return respond(res,{items:draft?[{key:"homepage",settings:draft}]:[]});
 if(suffix==="/activity"||suffix==="/changes")return respond(res,{items:[]});
 if(suffix==="/member"){
  payloads.push({path:suffix,body});Object.assign(members[0],body);
  return respond(res,{ok:true});
 }
 if(suffix==="/moments/create"){
  const id=crypto.randomUUID();albums.push({id,title:body.title,event_date:body.event_date,published:false});
  payloads.push({path:suffix,body});return respond(res,{ok:true,id});
 }
 if(suffix==="/moments/publish"){
  const x=albums.find(a=>a.id===body.album_id);
  if(x)x.published=!!body.published;
  payloads.push({path:suffix,body});return respond(res,{ok:true});
 }
 const photoUpload=suffix.match(/^\/moments\/([0-9a-f-]{36})\/photo$/);
 if(photoUpload&&req.method==="POST"){
  const id=crypto.randomUUID(),album_id=photoUpload[1],chunks=[];
  // body is raw bytes, not JSON.
  for(const b of rawBuffers)chunks.push(b);
  photoBytes.set(id,Buffer.concat(chunks));
  photos.push({id,album_id,caption:""});
  payloads.push({path:suffix,id});return respond(res,{ok:true,id});
 }
 const photoGet=suffix.match(/^\/photos\/([0-9a-f-]{36})$/);
 if(photoGet&&req.method==="GET"){
  const file=photoBytes.get(photoGet[1]);
  if(!file){res.writeHead(404);res.end();return;}
  res.writeHead(200,{"Content-Type":"image/png"});res.end(file);return;
 }
 if(suffix==="/write"){
  payloads.push({path:suffix,body});
  if(body.kind==="site_drafts")draft=JSON.parse(JSON.stringify(body.settings));
  if(body.kind==="site_content")current=JSON.parse(JSON.stringify(body.settings));
  if(body.kind==="catalog"&&body.action==="insert"){
   events.push({...body.item,id:crypto.randomUUID()});
  }
  if(body.kind==="catalog"&&body.action==="toggle"){
   const item=events.find(x=>x.id===body.id);
   if(item)item.active=body.active;
  }
  if(body.kind==="moments_photos"&&body.action==="delete"){
   const index=photos.findIndex(p=>p.id===body.id);
   if(index>=0)photos.splice(index,1);photoBytes.delete(body.id);
  }
  if(body.kind==="moments_albums"&&body.action==="delete"){
   const index=albums.findIndex(a=>a.id===body.id);
   if(index>=0)albums.splice(index,1);
   for(let i=photos.length-1;i>=0;i--)if(photos[i].album_id===body.id){
    photoBytes.delete(photos[i].id);photos.splice(i,1);
   }
  }
  return respond(res,{ok:true});
 }
 respond(res,{error:"Ruta ficticia no definida"},404);
});
server.listen(0,"127.0.0.1");await once(server,"listening");
const BASE="http://127.0.0.1:"+server.address().port;
const chrome=process.env.CHROME_BIN||["/usr/bin/google-chrome","/usr/bin/chromium"].find(p=>fs.existsSync(p));
assert.ok(chrome,"Chrome debe estar instalado en GitHub Actions");
const browser=await chromium.launch({executablePath:chrome,headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
const context=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:"block"});
const page=await context.newPage();
const issues=[],tests=[];
page.on("pageerror",e=>issues.push(e.message));
page.on("console",msg=>{
 // Chrome informa HTTP 401/403 como errores de consola incluso cuando
 // son denegaciones ESPERADAS al visitar el panel sin ser administrador.
 if(msg.type()==="error"&&!/Failed to load resource: the server responded with a status of (401|403) \(/.test(msg.text()))
  issues.push(msg.text());
});
function pass(text){tests.push(text);console.log("OK: "+text);}
try{
 assert.ok(PUBLIC_JS.includes('href="/administracion/" target="_blank" rel="noopener noreferrer"'));
 assert.ok(PUBLIC_JS.includes('href="/administracion/?seccion=web" target="_blank" rel="noopener noreferrer"'));
 pass("Los botones públicos apuntan a administración en otra pestaña con noopener");

 // Sin una sesión pública autorizada el formulario no aparece y no entra.
 await page.goto(BASE+"/administracion/",{waitUntil:"domcontentloaded"});
 await page.locator("#retry-sso").waitFor();
 assert.equal(await page.locator("#access").isVisible(),true);
 assert.equal(await page.locator("#portal").isVisible(),false);
 assert.equal(await page.locator("input[type='email'], input[type='password']").count(),0);
 pass("Sin sesión pública no hay panel ni formulario de email/contraseña");
 await page.screenshot({path:OUT+"/acceso-admin-sin-sesion.png",animations:"disabled"});
 // Simular login ya efectuado en la web principal, sin contraseña nueva.
 await context.addCookies([{name:"qa_public_session",value:"admin",url:BASE}]);
 await page.reload({waitUntil:"domcontentloaded"});
 await page.locator("#portal").waitFor({state:"visible",timeout:15000});
 pass("El administrador entra automáticamente al panel desde su sesión pública");
 assert.equal(await page.locator("#admin-nav button[data-tab]").count(),7);
 assert.equal(await page.locator("#section-title").textContent(),"Escritorio");
 pass("Login ficticio abre escritorio privado con 7 secciones");
 await page.screenshot({path:OUT+"/escritorio-admin.png",animations:"disabled"});

 await page.locator("#admin-nav button[data-tab='web']").click();
 await page.locator("[data-site-key='hero_text']").waitFor();
 await page.locator("[data-site-key='hero_text']").fill("Texto ficticio de Bellaquitas");
 await page.locator("[data-action='save-draft']").click();
 await page.waitForFunction(()=>document.querySelector("#work-feedback")?.textContent?.includes("Borrador guardado"));
 assert.equal(draft.hero_text,"Texto ficticio de Bellaquitas");
 assert.equal(current.hero_text,"Bellaquitas Fest");
 pass("Editor independiente guarda borrador sin alterar versión publicada");

 await page.locator("[data-site-lang='fr']").click();
 await page.locator("[data-site-key='hero_text']").fill("Soirée de test Bellaquitas");
 page.on("dialog",dialog=>dialog.accept());
 await page.locator("[data-action='publish']").click();
 await page.waitForFunction(()=>document.querySelector("#work-feedback")?.textContent?.includes("Cambios publicados"));
 assert.equal(current.hero_text,"Texto ficticio de Bellaquitas");
 assert.equal(current.translations.fr.hero_text,"Soirée de test Bellaquitas");
 pass("Publicación conserva español y francés");

 await page.locator("#admin-nav button[data-tab='eventos']").click();
 await page.locator("[data-action='create-item']").waitFor();
 await page.locator("[data-action='create-item']").click();
 await page.locator("#f-name").fill("Evento inventado nuevo");
 await page.locator("#f-date_label").fill("2027-03-21");
 await page.locator("#f-location").fill("Lugar ficticio");
 await page.locator("#catalog-form button[type='submit']").click();
 await page.waitForFunction(()=>document.body.textContent.includes("Evento inventado nuevo"));
 assert.equal(events.length,2);
 pass("Crear evento desde otra pestaña llama al catálogo de ensayo");

 await page.locator("#admin-nav button[data-tab='socios']").click();
 await page.locator("[data-edit-member]").first().click();
 await page.locator("#f-points").fill("25");
 await page.locator("#f-lifetime_points").fill("25");
 await page.locator("#f-reason").fill("Ajuste completamente ficticio de ensayo");
 await page.locator("#member-form button[type='submit']").click();
 await page.waitForFunction(()=>document.body.textContent.includes("Socio actualizado y cambio auditado"));
 assert.equal(members[0].points,25);
 pass("Administrador edita socio ficticio con motivo obligatorio");

 await page.locator("#admin-nav button[data-tab='comunidad']").click();
 await page.locator("#album-form").waitFor();
 assert.ok((await page.locator("#work-content").textContent()).includes("Sugerencias recibidas"));
 pass("Comunidad muestra sugerencias y gestión de galerías");

 await page.locator("#f-title").fill("Galería ficticia del evento");
 await page.locator("#f-event_date").fill("2027-08-21");
 await page.locator("#album-form button[type='submit']").click();
 await page.locator("[data-upload-album]").waitFor({state:"visible",timeout:12000});
 assert.equal(albums.length,1);
 pass("Crear galería ficticia desde el panel");

 const fakePng=Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0,1,2,3,4]);
 await page.locator("[data-file-album]").setInputFiles({name:"foto-ficticia.png",mimeType:"image/png",buffer:fakePng});
 await page.locator("[data-upload-album]").click();
 await page.locator(".photo-tile img").first().waitFor({state:"visible",timeout:12000});
 assert.equal(photos.length,1);
 assert.equal(photoBytes.size,1);
 pass("Subir PNG ficticio y visualizar miniatura de Moments");

 await page.locator("[data-delete-photo]").first().click();
 await page.waitForFunction(()=>document.querySelectorAll(".photo-tile").length===0);
 assert.equal(photos.length,0);assert.equal(photoBytes.size,0);
 pass("Borrar fotografía elimina el archivo de ensayo");

 await page.locator("[data-album-id]").first().click();
 await page.waitForFunction(()=>document.querySelector("[data-album-id]")?.textContent?.includes("Ocultar"));
 assert.equal(albums[0].published,true);
 pass("Publicar álbum de Moments desde el panel");

 await page.screenshot({path:OUT+"/panel-comunidad.png",animations:"disabled"});
 await page.locator("#logout-top").click();
 await page.locator("#access").waitFor({state:"visible"});
 assert.equal(await page.locator("#portal").isVisible(),false);
 assert.equal(await page.locator("input[type='password'],input[type='email']").count(),0);
 pass("Salir del panel no pide credenciales ni cierra la sesión principal");
 // Un enlace nuevo abierto en otra pestaña lleva directamente al editor tras login.
 const separate=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:"block"});
 try{
  await separate.addCookies([{name:"qa_public_session",value:"admin",url:BASE}]);
  const mobile=await separate.newPage();
  mobile.on("pageerror",e=>issues.push(e.message));
  await mobile.goto(BASE+"/administracion/?seccion=web",{waitUntil:"domcontentloaded"});
  await mobile.locator("[data-site-key='hero_text']").waitFor();
  assert.equal(await mobile.locator("#section-title").textContent(),"Editor de la web");
  pass("Editar web abre una nueva pestaña y llega directamente al editor en móvil");
  await mobile.screenshot({path:OUT+"/editor-mobile.png",animations:"disabled"});
 }finally{await separate.close();}
 // Un socio, aunque tenga sesión propia, NO ve el panel de administrador.
 const notAdmin=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:"block"});
 try{
  await notAdmin.addCookies([{name:"qa_public_session",value:"socio",url:BASE}]);
  const memberPage=await notAdmin.newPage();
  memberPage.on("pageerror",e=>issues.push(e.message));
  await memberPage.goto(BASE+"/administracion/",{waitUntil:"domcontentloaded"});
  await memberPage.locator("#retry-sso").waitFor();
  await memberPage.waitForFunction(()=>document.querySelector("#login-feedback")?.textContent?.length>0);
  assert.equal(await memberPage.locator("#access").isVisible(),true);
  assert.equal(await memberPage.locator("#portal").isVisible(),false);
  pass("Un socio no recibe el panel; no existe contraseña de administrador");
 }finally{await notAdmin.close();}
 assert.deepEqual(issues,[]);
 pass("No hay errores JavaScript en los recorridos de escritorio y móvil");
 console.log("RESULTADO ADMIN UI: "+tests.length+" controles superados.");
}finally{
 fs.writeFileSync(OUT+"/report.json",JSON.stringify({tests,issues,actions:payloads.map(x=>x.path)},null,2));
 await context.close();await browser.close();
 await new Promise(r=>server.close(r));
}
