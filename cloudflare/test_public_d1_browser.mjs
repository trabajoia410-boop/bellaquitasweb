/**
 * Bellaquitas web REAL Chrome: app estática + API D1 totalmente FICTICIA.
 * Sin Internet de usuarios, DNS, R2 ni mutaciones. No prueba login Google real.
 */
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {once} from "node:events";
import {readFileSync,existsSync} from "node:fs";
import {join,resolve,extname} from "node:path";
import {fileURLToPath} from "node:url";
import {chromium} from "playwright-core";
const HERE=fileURLToPath(new URL(".",import.meta.url));
const ROOT=resolve(HERE,"..");
const BUILD=join(HERE,"staging-source-2026-11-11","recovered-src");
const fakeId="00000000-0000-4000-8000-000000000002";
const sampleMember={
 id:fakeId,name:"Socia inventada",role:"socio",member_code:"MBR-FAKE-12345",
 points:53,lifetime_points:72,visits:4,created_at:"2026-10-01"
};
const sampleDoor={...sampleMember,id:"00000000-0000-4000-8000-000000000003",
 name:"Puerta ficticia",role:"puerta",member_code:"MBR-FAKE-DOOR",points:0,visits:0};
const sampleEvents=[{id:"00000000-0000-4000-8000-000000000011",name:"Evento ficticio",
 date_label:"2027-01-17",location:"Sala ficticia",description:"Solo QA",
 active:true,start_time:"22:00",image_url:"",localized_content:{fr:{name:"Événement fictif"}}}];
const fakeReward={id:"00000000-0000-4000-8000-000000000012",name:"Premio inventado",
 category:"Premios",cost:20,symbol:"✦",description:"Solo QA",active:true,localized_content:{}};
const hits=[],outbound=[];
function json(res,data,status=200){res.writeHead(status,{"Content-Type":"application/json","Cache-Control":"no-store"});res.end(JSON.stringify(data));}
const files={"/":"index-cloudflare.html","/index-cloudflare.html":"index-cloudflare.html",
 "/app-cloudflare.js":"app-cloudflare.js","/sw-cloudflare.js":"sw-cloudflare.js"};
const mime={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",
 ".css":"text/css",".svg":"image/svg+xml",".png":"image/png",".webp":"image/webp",
 ".mp4":"video/mp4",".json":"application/json"};
const server=createServer((req,res)=>{
 const u=new URL(req.url,"http://127.0.0.1"),path=u.pathname;
 const role=req.headers.cookie?.match(/qa-role=(socio|puerta)/)?.[1]||"";
 const person=role==="puerta"?sampleDoor:role==="socio"?sampleMember:null;
 if(path.startsWith("/v1/")){
  hits.push({path,role,method:req.method});
  if(req.method!=="GET"){json(res,{error:"Prueba de lectura; escrituras inhabilitadas"},423);return;}
  if(path==="/v1/auth/me"){json(res,{authenticated:!!person,profile:person});return;}
  if(path==="/v1/me/overview"){
   if(!person){json(res,{error:"No autenticado"},401);return;}
   json(res,{profile:person,redemptions:[],activity:[]});return;
  }
  if(path==="/v1/door/overview"){
   if(!person||person.role!=="puerta"){json(res,{error:"No autorizado"},403);return;}
   json(res,{members:[sampleMember],redemptions:[]});return;
  }
  if(path==="/v1/events"){json(res,{items:sampleEvents});return;}
  if(path==="/v1/rewards"){json(res,{items:[fakeReward]});return;}
  if(path==="/v1/promos"){json(res,{items:[]});return;}
  if(path==="/v1/site"){json(res,{site:{
   key:"homepage",hero_text:"Bellaquitas Fest",announcement:"Vive el momento",
   page_settings:{}
  }});return;}
  if(path==="/v1/moments"||path==="/v1/moments/public-photos"){json(res,{items:[]});return;}
  json(res,{error:"Ruta de prueba no disponible"},404);return;
 }
 const fixed=files[path];
 const local=fixed?join(BUILD,fixed):join(ROOT,decodeURIComponent(path).replace(/^\//,""));
 if(!local.startsWith(fixed?BUILD:ROOT) || !existsSync(local)){res.writeHead(404);res.end();return;}
 const buff=readFileSync(local);
 const type=mime[extname(local)]||"application/octet-stream";
 if(type==="video/mp4"){
  const part=buff.subarray(0,Math.min(1024,buff.length));
  res.writeHead(206,{"Content-Type":type,"Content-Range":"bytes 0-"+(part.length-1)+"/"+buff.length,
   "Accept-Ranges":"bytes","Content-Length":part.length});res.end(part);return;
 }
 res.writeHead(200,{"Content-Type":type,"Content-Length":buff.length});res.end(buff);
});
server.listen(0,"127.0.0.1");await once(server,"listening");
const BASE="http://127.0.0.1:"+server.address().port;
const chrome=process.env.CHROME_BIN||["/usr/bin/google-chrome","/usr/bin/chromium"].find(existsSync);
assert.ok(chrome,"Chrome/Chromium requerido para el ensayo");
const browser=await chromium.launch({executablePath:chrome,headless:true,
 args:["--no-sandbox","--disable-dev-shm-usage"]});
const errors=[],asserted=[];
async function verify(page,description){
 await page.waitForFunction(()=>!document.documentElement.classList.contains("auth-booting"),
  {timeout:15000});
 assert.ok(await page.locator("#app").innerText());
 asserted.push(description);console.log("OK: "+description);
}
try{
 const guest=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:"block"});
 const page=await guest.newPage();
 page.on("request",r=>{if(/supabase|esm\.sh/i.test(r.url()))outbound.push(r.url());});
 page.on("pageerror",e=>errors.push(e.message));
 await page.goto(BASE+"/",{waitUntil:"domcontentloaded"});
 await verify(page,"Invitado: portada de Bellaquitas y menú original");
 assert.equal(await page.locator(".site-header").count(),1);
 assert.equal(await page.locator(".bf-hero-video").count(),1);
 await page.goto(BASE+"/#/tarjeta",{waitUntil:"domcontentloaded"});
 await verify(page,"Invitado sin acceso a tarjeta privada");
 assert.equal(await page.locator(".google-signin").count(),1);
 assert.equal(await page.locator('input[type="password"]').count(),0);
 await guest.close();

 const members=await browser.newContext({viewport:{width:390,height:844},
   isMobile:true,hasTouch:true,serviceWorkers:"block"});
 await members.addCookies([{name:"qa-role",value:"socio",url:BASE,sameSite:"Lax"}]);
 const mpage=await members.newPage();
 mpage.on("request",r=>{if(/supabase|esm\.sh/i.test(r.url()))outbound.push(r.url());});
 mpage.on("pageerror",e=>errors.push(e.message));
 await mpage.goto(BASE+"/#/mi-espacio",{waitUntil:"domcontentloaded"});
 await verify(mpage,"Móvil: inicio de socia ficticia con sesión D1");
 assert.ok((await mpage.locator("#app").innerText()).includes("Socia inventada"));
 await mpage.goto(BASE+"/#/tarjeta",{waitUntil:"domcontentloaded"});
 await verify(mpage,"Móvil: tarjeta y QR de socia ficticia");
 assert.ok((await mpage.locator("#app").innerText()).includes("MBR-FAKE-12345"));
 assert.equal(await mpage.locator("#qr-code").count(),1);
 assert.equal(await mpage.locator(".menu-toggle").count()>0,true);
 await members.close();

 const staff=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:"block"});
 await staff.addCookies([{name:"qa-role",value:"puerta",url:BASE,sameSite:"Lax"}]);
 const p=await staff.newPage();
 p.on("pageerror",e=>errors.push(e.message));
 await p.goto(BASE+"/#/puerta",{waitUntil:"domcontentloaded"});
 await verify(p,"Puerta: acceso reservado con perfil inventado");
 assert.ok((await p.locator("#app").innerText()).includes("Socia inventada"));
 await staff.close();

 assert.deepEqual(outbound,[],"El navegador ha contactado un proveedor anterior");
 assert.deepEqual(errors,[],"Excepciones del JavaScript público");
 assert.ok(hits.some(x=>x.path==="/v1/me/overview"&&x.role==="socio"));
 assert.ok(hits.some(x=>x.path==="/v1/door/overview"&&x.role==="puerta"));
 assert.ok(!hits.some(x=>x.method!=="GET"));
 console.log("OK: "+asserted.length+" comprobaciones Chrome; cero escritura, solo D1 ficticio");
}finally{await browser.close();await new Promise(r=>server.close(r));}
