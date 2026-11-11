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
let current={hero_text:"Bellaquitas Fest",announcement:"Vive el momento",hero_title_a:"Bellaquitas",events_title:"Eventos",faq_1_q:"¿Cómo funciona?",logo_url:"",translations:{fr:{hero_text:"Bellaquitas en français"}}};
let draft=null,authenticated=false;
function respond(res,data,status=200,extra={}){
 res.writeHead(status,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",...extra});
 res.end(JSON.stringify(data));
}
const server=createServer(async(req,res)=>{
 const url=new URL(req.url,"http://localhost"),pathname=url.pathname;
 if(pathname==="/administracion/"||pathname==="/administracion/styles.css"||pathname==="/administracion/app.js"){
  res.writeHead(200,{"Content-Type":pathname.endsWith(".css")?"text/css":pathname.endsWith(".js")?"text/javascript":"text/html"});
  res.end(pathname.endsWith(".css")?ADMIN_CSS:pathname.endsWith(".js")?ADMIN_JS:ADMIN_HTML);
  return;
 }
 if(!pathname.startsWith("/administracion/api/")){respond(res,{error:"not found"},404);return;}
 let body={};
 if(req.method!=="GET"){
  const buffers=[];for await(const b of req)buffers.push(b);
  if(buffers.length)try{body=JSON.parse(Buffer.concat(buffers).toString("utf8"));}catch{}
 }
 const suffix=pathname.slice("/administracion/api".length);
 if(suffix==="/login"){
  authenticated=body.email==="admin@example.test"&&body.password==="ContraseñaAdminFicticia#2026";
  return respond(res,authenticated?{ok:true,profile:{role:"admin",name:"Admin de ensayo"}}:{error:"Credenciales incorrectas"},authenticated?200:401);
 }
 if(suffix==="/logout"){authenticated=false;return respond(res,{ok:true});}
 if(!authenticated){respond(res,{error:"Sesión ficticia requerida"},401);return;}
 if(suffix==="/me")return respond(res,{authenticated:true,profile:{role:"admin",name:"Admin de ensayo"}});
 if(suffix==="/events")return respond(res,{items:events});
 if(suffix==="/rewards")return respond(res,{items:[]});
 if(suffix==="/promos")return respond(res,{items:[]});
 if(suffix==="/members")return respond(res,{items:members});
 if(suffix==="/community")return respond(res,{suggestions:[{id:"00000000-0000-4000-8000-000000000303",name:"Persona ficticia",message:"Buena idea",status:"nuevo"}],albums:[],photos:[]});
 if(suffix==="/site")return respond(res,{site:{hero_text:current.hero_text,announcement:current.announcement,settings:current}});
 if(suffix==="/site-drafts")return respond(res,{items:draft?[{key:"homepage",settings:draft}]:[]});
 if(suffix==="/activity"||suffix==="/changes")return respond(res,{items:[]});
 if(suffix==="/member"){
  payloads.push({path:suffix,body});Object.assign(members[0],body);
  return respond(res,{ok:true});
 }
 if(suffix==="/moments/create"){payloads.push({path:suffix,body});return respond(res,{ok:true,id:crypto.randomUUID()});}
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
page.on("console",msg=>{if(msg.type()==="error")issues.push(msg.text());});
function pass(text){tests.push(text);console.log("OK: "+text);}
async function enter(p){
 await p.locator("#admin-email").fill("admin@example.test");
 await p.locator("#admin-password").fill("ContraseñaAdminFicticia#2026");
 await p.locator("#login-submit").click();
 await p.locator("#portal").waitFor({state:"visible",timeout:15000});
}
try{
 assert.ok(PUBLIC_JS.includes('href="/administracion/" target="_blank" rel="noopener noreferrer"'));
 assert.ok(PUBLIC_JS.includes('href="/administracion/?seccion=web" target="_blank" rel="noopener noreferrer"'));
 pass("Los botones públicos apuntan a administración en otra pestaña con noopener");

 await page.goto(BASE+"/administracion/",{waitUntil:"domcontentloaded"});
 await page.locator("#login-submit").waitFor();
 assert.equal(await page.locator("#access").isVisible(),true);
 assert.equal(await page.locator("#portal").isVisible(),false);
 pass("La nueva pestaña muestra primero email y contraseña, no el panel");
 await page.screenshot({path:OUT+"/login-admin-desktop.png",animations:"disabled"});

 await enter(page);
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

 await page.screenshot({path:OUT+"/panel-comunidad.png",animations:"disabled"});
 await page.locator("#logout-top").click();
 await page.locator("#access").waitFor({state:"visible"});
 assert.equal(await page.locator("#admin-password").inputValue(),"");
 assert.equal(await page.locator("#portal").isVisible(),false);
 pass("Cerrar sesión vuelve a formulario sin guardar contraseña");

 // Un enlace nuevo abierto en otra pestaña lleva directamente al editor tras login.
 const separate=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:"block"});
 try{
  const mobile=await separate.newPage();
  mobile.on("pageerror",e=>issues.push(e.message));
  await mobile.goto(BASE+"/administracion/?seccion=web",{waitUntil:"domcontentloaded"});
  assert.equal(await mobile.locator("#access").isVisible(),true);
  await enter(mobile);
  await mobile.locator("[data-site-key='hero_text']").waitFor();
  assert.equal(await mobile.locator("#section-title").textContent(),"Editor de la web");
  pass("Editar web abre pestaña con login y llega al editor, incluso en móvil");
  await mobile.screenshot({path:OUT+"/editor-mobile.png",animations:"disabled"});
 }finally{await separate.close();}
 assert.deepEqual(issues,[]);
 pass("No hay errores JavaScript en los recorridos de escritorio y móvil");
 console.log("RESULTADO ADMIN UI: "+tests.length+" controles superados.");
}finally{
 fs.writeFileSync(OUT+"/report.json",JSON.stringify({tests,issues,actions:payloads.map(x=>x.path)},null,2));
 await context.close();await browser.close();
 await new Promise(r=>server.close(r));
}
