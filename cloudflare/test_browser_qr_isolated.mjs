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
const OUT="browser-qr-evidence";mkdirSync(OUT,{recursive:true});
const DB=new DatabaseSync(":memory:");
DB.exec("PRAGMA foreign_keys=ON");
for(const file of ["0001-schema.sql","0002-auth-and-invariants.sql","0003-oauth-sessions.sql"]){
  DB.exec(readFileSync(path.join(HERE,"migrations",file),"utf8"));
}
DB.prepare("INSERT INTO profiles(id,name,role,member_code) VALUES (?,?,?,?)").run(
  ADMIN,"Empleado de puerta ficticio","puerta","MBR-QA-DOOR-0001"
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
  assert.equal((await fetch(host+"/health")).status,200);
  pass("Servidor de ensayo con Worker completo y SQLite temporal funciona");

  await page.goto(host+"/espejo/#/puerta",{waitUntil:"domcontentloaded",timeout:40000});
  await page.locator("#checkin-form").waitFor({state:"attached",timeout:30000});
  assert.equal(await page.locator("[data-action='scan']").count(),1);
  pass("Personal ficticio puede abrir el control de puerta original");

  const front=await page.addScriptTag({url:host+"/espejo/assets/qr-local.js"});
  assert.ok(front);
  const code="MBR-QA-USER-0002";
  const camera=await page.evaluate(async code=>{
    if(typeof window.BellaQR?.render!=="function")throw Error("Generador QR no cargado");
    const holder=document.createElement("div");
    holder.style.cssText="position:absolute;left:-9000px;top:-9000px";
    document.body.appendChild(holder);
    const svg=window.BellaQR.render(holder,code,{label:"Socio ficticio"});
    const xml=new XMLSerializer().serializeToString(svg);
    const blob=new Blob([xml],{type:"image/svg+xml"});
    const url=URL.createObjectURL(blob);
    const image=new Image();image.src=url;await image.decode();URL.revokeObjectURL(url);
    const canvas=document.createElement("canvas");canvas.width=720;canvas.height=720;
    const ctx=canvas.getContext("2d",{alpha:false});
    const draw=()=>{
      ctx.fillStyle="white";ctx.fillRect(0,0,720,720);
      ctx.imageSmoothingEnabled=false;
      ctx.drawImage(image,150,150,420,420);
    };
    draw();
    const timer=setInterval(draw,80);
    let calls=0;
    Object.defineProperty(window,"BarcodeDetector",{configurable:true,value:undefined});
    Object.defineProperty(navigator,"mediaDevices",{
      configurable:true,
      value:{getUserMedia:async()=>{
        calls++;
        return canvas.captureStream(15);
      }}
    });
    window.__bfQrTest={canvas,timer,getCalls:()=>calls,stop:()=>clearInterval(timer)};
    return {w:canvas.width,h:canvas.height};
  },code);
  assert.deepEqual(camera,{w:720,h:720});
  pass("QR generado con la biblioteca original y cámara sintética local preparada");

  await page.locator("[data-action='scan']").click();
  await page.locator("#camera-wrap.active").waitFor({state:"attached",timeout:15000});
  pass("Botón Activar cámara QR abre el vídeo simulado");

  const firstVisit=await page.waitForResponse(r=>
    r.url().includes("/v1/door/checkin")&&r.status()===200,{timeout:25000});
  assert.equal((await firstVisit.json()).points_awarded,10);
  let member=DB.prepare("SELECT points,lifetime_points,visits FROM profiles WHERE id=?").get(USER);
  assert.deepEqual({...member},{points:10,lifetime_points:10,visits:1});
  const activity=DB.prepare("SELECT type,delta,staff_id FROM activity WHERE user_id=?").get(USER);
  assert.deepEqual({...activity},{type:"visita",delta:10,staff_id:ADMIN});
  pass("jsQR detecta fotogramas falsos y añade solo +10 puntos / una visita");

  // Esperar a que el refresco de pantalla producido por la primera visita
  // haya acabado; iniciar la cámara mientras se re-renderiza la ruta la cierra.
  await page.waitForFunction(()=>document.body.innerText.includes("Visita validada: +10 puntos."),
    null,{timeout:20000});
  await page.waitForTimeout(850);
  await page.locator("[data-action='scan']").waitFor({state:"visible"});
  const secondResponses=[];
  page.on("response",r=>{
    if(r.url().includes("/v1/door/checkin"))secondResponses.push({status:r.status(),url:r.url()});
  });
  const secondResponse=page.waitForResponse(r=>
    r.url().includes("/v1/door/checkin")&&r.status()===409,{timeout:20000});
  await page.locator("[data-action='scan']").click();
  const second=await secondResponse;
  assert.equal(secondResponses.some(r=>r.status===409),true);

  assert.match((await second.json()).error,/ya se ha validado hoy/i);
  member=DB.prepare("SELECT points,lifetime_points,visits FROM profiles WHERE id=?").get(USER);
  assert.deepEqual({...member},{points:10,lifetime_points:10,visits:1});
  assert.equal(DB.prepare("SELECT COUNT(*) AS n FROM activity WHERE user_id=? AND type='visita'").get(USER).n,1);
  pass("Segundo escaneo del mismo QR devuelve 409 y no duplica puntos");

  const cameraOpened=await page.evaluate(()=>window.__bfQrTest.getCalls());
  assert.equal(cameraOpened,2);
  await page.evaluate(()=>window.__bfQrTest.stop());
  pass("Se abrieron dos cámaras de prueba, sin permisos ni dispositivos reales");

  assert.deepEqual(javascriptErrors,[]);
  assert.deepEqual(httpErrors,[]);
  pass("El recorrido QR no provocó errores JavaScript ni HTTP 5xx");

  await page.screenshot({path:OUT+"/puerta-qr-ficticio.png",animations:"disabled",timeout:15000});
  console.log("RESULTADO QR BROWSER: "+completed.length+" controles aprobados");
}finally{
  writeFileSync(OUT+"/result.json",JSON.stringify({completed,javascriptErrors,httpErrors},null,2));
  await page.close();await ctx.close();await browser.close();
  await new Promise(r=>server.close(r));
  DB.close();
}
