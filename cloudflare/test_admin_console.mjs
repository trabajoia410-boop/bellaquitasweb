/**
 * Administración independiente — prueba integral en D1 SQLite :memory:.
 * Credenciales y usuarios 100% sintéticos. No solicita Google, Resend ni Internet.
 * Ejecuta el código Worker candidato, no modifica producción.
 */
import assert from "node:assert/strict";
import {test,before,after} from "node:test";
import {DatabaseSync} from "node:sqlite";
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import {fileURLToPath,pathToFileURL} from "node:url";
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.join(here,"staging-source-2026-11-11","recovered-src");
const {default:worker}=await import(pathToFileURL(path.join(root,"bellaquitas-api-staging.js")).href);
const {createAuthSession}=await import(pathToFileURL(path.join(root,"auth-routes.js")).href);
const {ADMIN_JS}=await import(pathToFileURL(path.join(root,"admin-console-ui.js")).href);
const BASE="https://bellaquitas-api-staging.bellaquitas-fest-410.workers.dev";
const ADMIN="00000000-0000-4000-8000-000000000201";
const MEMBER="00000000-0000-4000-8000-000000000202";
const GOOGLE_ADMIN="00000000-0000-4000-8000-000000000203";
const ACTIVATION_EMAIL="new-admin-verified@example.test";
let freshGoogleCookie,activationToken;

const PASSWORD="ContraseñaAdminFicticia#2026";
const FAKES=[["admin@example.test",ADMIN,"admin"],["socio@example.test",MEMBER,"socio"]];
const db=new DatabaseSync(":memory:");
db.exec("PRAGMA foreign_keys=ON");
for(const file of ["0001-schema.sql","0002-auth-and-invariants.sql","0003-oauth-sessions.sql"]){
 db.exec(fs.readFileSync(path.join(here,"migrations",file),"utf8"));
}
db.exec(fs.readFileSync(path.join(here,"migrations","0004-admin-activation.sql"),"utf8"));
db.exec(fs.readFileSync(path.join(here,"migrations","0005-auth-session-method.sql"),"utf8"));
db.exec(fs.readFileSync(path.join(here,"migrations","0007-admin-sso-sessions.sql"),"utf8"));
db.exec("CREATE TABLE auth_email_credentials (email TEXT PRIMARY KEY COLLATE NOCASE,profile_id TEXT NOT NULL UNIQUE REFERENCES profiles(id),password_hash TEXT NOT NULL,password_salt TEXT NOT NULL,password_iterations INTEGER NOT NULL,verified_at INTEGER NOT NULL,created_at INTEGER NOT NULL DEFAULT (unixepoch()),updated_at INTEGER NOT NULL DEFAULT (unixepoch()));");
db.exec("CREATE TABLE auth_email_rate_limits(key_hash TEXT PRIMARY KEY,attempts INTEGER NOT NULL DEFAULT 0,expires_at INTEGER NOT NULL);");
const D1={
 prepare(sql){
  const s=db.prepare(sql);
  return {_query:sql,bind(...a){return {async first(){return s.get(...a)??null;},async all(){return {results:s.all(...a)};},async run(){return {success:true,meta:s.run(...a)};}};},
   async first(){return s.get()??null;},async all(){return {results:s.all()};},async run(){return {success:true,meta:s.run()};}};
 },
 async batch(stmts){
  const r=[];for(const stmt of stmts){
   r.push(/^\s*(select|with)\b/i.test(stmt._query)?await stmt.all():await stmt.run());
  }return r;
 }
};
const mediaObjects=new Map();
const MEDIA={
 async get(key){const v=mediaObjects.get(key);return v?{body:v.bytes,httpMetadata:v.meta}:null;},
 async put(key,bytes,options={}){
  mediaObjects.set(key,{bytes:new Uint8Array(bytes),meta:options.httpMetadata||{}});
 },
 async delete(key){mediaObjects.delete(key);}
};
const env={DB:D1,MEDIA,STAGING_MUTATIONS:"disabled",ALLOW_NEW_ACCOUNTS:"no",
 PUBLIC_ORIGIN:BASE,EMAIL_AUTH_ENABLED:"yes",EMAIL_RATE_KEY:"FAKE-KEY-WITH-AT-LEAST-32-BYTES-000000",
 ADMIN_PASSWORD_RUNTIME_APPROVED:"yes"};
const enc=x=>Buffer.from(x).toString("base64url");
async function issueVerifiedGoogleSession(){
 // ENSAYO: representa exclusivamente la emisión de sesión por el callback
 // que ya ha validado ID token firmado, audiencia, nonce y Google sub.
 const cookie=(await createAuthSession(GOOGLE_ADMIN,env)).split(";")[0];
 const raw=cookie.split("=")[1];
 const digest=enc(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(raw)));
 const result=db.prepare("UPDATE auth_sessions SET auth_method='google' WHERE token_hash=?").run(digest);
 assert.equal(result.changes,1);
 return cookie;
}

async function hashPassword(password,salt){
 const b=Buffer.from(salt,"base64url");
 let material=new TextEncoder().encode(password);
 for(let i=0;i<6;i++){
  const saltBytes=new Uint8Array(33);saltBytes.set(b);saltBytes[32]=i;
  const k=await crypto.subtle.importKey("raw",material,"PBKDF2",false,["deriveBits"]);
  material=new Uint8Array(await crypto.subtle.deriveBits({name:"PBKDF2",salt:saltBytes,iterations:100000,hash:"SHA-256"},k,256));
 }
 return "pbkdf2-chain6-sha256-v1$"+enc(material);
}
let publicCookie="";
before(async()=>{
 for(const [mail,id,role] of FAKES){
  db.prepare("INSERT INTO profiles(id,name,role,member_code) VALUES (?,?,?,?)")
    .run(id,role==="admin"?"Administrador ficticio":"Socio ficticio",role,"MBR-TEST-"+role.toUpperCase());
  const salt=enc(Buffer.alloc(32,role==="admin"?7:8));
  const hash=await hashPassword(PASSWORD,salt);
  db.prepare("INSERT INTO auth_email_credentials(email,profile_id,password_hash,password_salt,password_iterations,verified_at) VALUES (?,?,?,?,600000,unixepoch())")
    .run(mail,id,hash,salt);
 }
 db.prepare("INSERT INTO profiles(id,name,role,member_code) VALUES (?,?,?,?)")
  .run(GOOGLE_ADMIN,"Administrador Google ficticio","admin","MBR-TEST-GOOGLE");
 db.prepare("INSERT INTO auth_identity_links(id,provider,provider_subject,profile_id) VALUES (?,?,?,?)")
  .run(crypto.randomUUID(),"google","123456789123456789",GOOGLE_ADMIN);
 freshGoogleCookie=await issueVerifiedGoogleSession();
 publicCookie=(await createAuthSession(ADMIN,env)).split(";")[0];
});
after(()=>db.close());
function req(route,{method="GET",cookie,origin=BASE,body}={}){
 const headers={Origin:origin,"Sec-Fetch-Site":origin===BASE?"same-origin":"cross-site"};
 if(cookie)headers.Cookie=cookie;
 if(body!==undefined)headers["Content-Type"]="application/json";
 return new Request(BASE+route,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
}
async function call(route,opts){
 const response=await worker.fetch(req(route,opts),env);
 const obj=response.headers.get("content-type")?.includes("application/json")?await response.json():null;
 return {response,obj,status:response.status,cookie:response.headers.get("set-cookie")};
}
const sign=async(email,password=PASSWORD)=>call("/administracion/api/login",{method:"POST",body:{email,password}});
let adminCookie;
test("HTML, CSS, JS admin son páginas separadas y no indexables",async()=>{
 for(const [url,type] of [["/administracion/","text/html"],["/administracion/styles.css","text/css"],["/administracion/app.js","javascript"]]){
  const {response,status}=await call(url);
  assert.equal(status,200,url);
  assert.match(response.headers.get("content-type"),new RegExp(type));
  assert.match(response.headers.get("x-robots-tag"),/noindex/i);
  assert.match(response.headers.get("content-security-policy"),/frame-ancestors 'none'/);
  assert.equal(response.headers.get("set-cookie"),null);
 }
 new vm.Script(ADMIN_JS);
});
test("cookie pública del administrador NO abre la consola independiente",async()=>{
 const res=await call("/administracion/api/me",{cookie:publicCookie});
 assert.equal(res.status,401);assert.equal(res.cookie,null);
 const members=await call("/administracion/api/members",{cookie:publicCookie});
 assert.equal(members.status,401);
});
test("no acepta acceso sin contraseña ni origen ajeno",async()=>{
 assert.equal((await call("/administracion/api/login",{method:"POST",body:{email:"admin@example.test"}})).status,401);
 assert.equal((await call("/administracion/api/login",{method:"POST",origin:"https://externo.invalid",
  body:{email:"admin@example.test",password:PASSWORD}})).status,403);
});
test("no permite a un socio abrir la consola aunque conozca su contraseña",async()=>{
 const out=await sign("socio@example.test");
 assert.equal(out.status,401);assert.equal(out.cookie,null);
 const count=db.prepare("SELECT COUNT(*) AS n FROM auth_sessions WHERE profile_id=?").get(MEMBER).n;
 assert.equal(count,0,"Una sesión de socio fallida no queda abierta");
});
test("login administrativo bloqueado si no se valida CPU en Workers Free",async()=>{
 env.ADMIN_PASSWORD_RUNTIME_APPROVED="no";
 assert.equal((await sign("admin@example.test")).status,503);
 env.ADMIN_PASSWORD_RUNTIME_APPROVED="yes";
});
test("contraseña incorrecta de administrador rechazada",async()=>{
 const out=await sign("admin@example.test","ContraseñaFicticiaIncorrecta!");
 assert.equal(out.status,401);assert.equal(out.cookie,null);
});
test("contraseña correcta y rol admin crean cookie INDEPENDIENTE y una hora en DB",async()=>{
 const out=await sign("admin@example.test");
 assert.equal(out.status,200,JSON.stringify(out.obj));
 assert.equal(out.obj.profile.role,"admin");
 assert.match(out.cookie,/__Host-bf_admin=[A-Za-z0-9_-]{43}/);
 assert.match(out.cookie,/Secure; HttpOnly; SameSite=Strict/);
 assert.match(out.cookie,/Max-Age=3600/);
 assert.ok(!out.cookie.includes("__Host-bf_session"));
 adminCookie=out.cookie.split(";")[0];
 const dbRecord=db.prepare("SELECT MIN(expires_at-unixepoch()) AS ttl FROM auth_sessions WHERE profile_id=?").get(ADMIN);
 assert.ok(dbRecord.ttl>0&&dbRecord.ttl<=3600);
});
test("sesión admin permite datos privados y rol comprobado desde el servidor",async()=>{
 const me=await call("/administracion/api/me",{cookie:adminCookie});
 assert.equal(me.status,200);assert.equal(me.obj.profile.role,"admin");
 const members=await call("/administracion/api/members",{cookie:adminCookie});
 assert.equal(members.status,200);assert.equal(members.obj.items.length,3);
});
test("una sesión de socio renombrada a cookie admin NO supera verificación rol",async()=>{
 const socioToken=(await createAuthSession(MEMBER,env)).match(/__Host-bf_session=([A-Za-z0-9_-]{43})/)[1];
 const attempt=await call("/administracion/api/me",{cookie:"__Host-bf_admin="+socioToken});
 assert.equal(attempt.status,401);
});
test("lectura de eventos, editor y sugerencias desde consola independiente",async()=>{
 for(const route of ["/events","/rewards","/promos","/site","/site-drafts","/community","/activity","/changes"]){
  const result=await call("/administracion/api"+route,{cookie:adminCookie});
  assert.equal(result.status,200,route+": "+JSON.stringify(result.obj));
 }
});
test("publicar NO escribe mientras STAGING_MUTATIONS está desactivado",async()=>{
 const body={kind:"catalog",table:"events",action:"insert",item:{
  name:"Evento ficticio",date_label:"2027-01-15",location:"Sala ficticia",description:"Test",start_time:"21:00",active:true
 }};
 assert.equal((await call("/administracion/api/write",{method:"POST",cookie:adminCookie,body})).status,423);
 assert.equal(db.prepare("SELECT COUNT(*) AS n FROM events").get().n,0);
});
test("escritura real en SQLite aislada, sin tocar socios",async()=>{
 env.STAGING_MUTATIONS="enabled";
 const body={kind:"catalog",table:"events",action:"insert",item:{
  name:"Evento ficticio",date_label:"2027-01-15",location:"Sala ficticia",description:"Test",start_time:"21:00",active:true,
  localized_content:{fr:{name:"Soirée fictive"}}
 }};
 const out=await call("/administracion/api/write",{method:"POST",cookie:adminCookie,body});
 assert.equal(out.status,200,JSON.stringify(out.obj));
 assert.equal(db.prepare("SELECT COUNT(*) AS n FROM events").get().n,1);
 assert.equal((await call("/administracion/api/events",{cookie:adminCookie})).obj.items.length,1);
 assert.equal(db.prepare("SELECT COALESCE(SUM(points),0) AS n FROM profiles").get().n,0);
 env.STAGING_MUTATIONS="disabled";
});
test("galerías Moments: admin crea álbum y socio no puede subir fotografías",async()=>{
 env.STAGING_MUTATIONS="enabled";
 const res=await call("/administracion/api/moments/create",{method:"POST",cookie:adminCookie,
  body:{title:"Álbum totalmente ficticio",event_date:"2027-07-01"}});
 assert.equal(res.status,200,JSON.stringify(res.obj));
 assert.match(res.obj.id,/^[0-9a-f-]{36}$/);
 globalThis.__fakeAlbumId=res.obj.id;
 const data=await call("/administracion/api/community",{cookie:adminCookie});
 assert.ok(data.obj.albums.find(x=>x.id===res.obj.id));
 // La sesión de socio, aun renombrando la cookie, no accede al album privado.
 const socioToken=(await createAuthSession(MEMBER,env)).match(/__Host-bf_session=([A-Za-z0-9_-]{43})/)[1];
 const response=await call("/administracion/api/community",{cookie:"__Host-bf_admin="+socioToken});
 assert.equal(response.status,401);
});
test("R2 cerrado: editar eventos sigue permitido, pero no subir ni borrar archivos",async()=>{
 env.STAGING_MUTATIONS="enabled";
 env.R2_MUTATIONS_APPROVED="no";
 const event={kind:"catalog",table:"events",action:"insert",item:{
  name:"Otro evento ficticio",date_label:"2027-08-02",location:"Club inventado",
  description:"Prueba segura sin R2",start_time:"22:00",active:true
 }};
 const writing=await call("/administracion/api/write",{cookie:adminCookie,method:"POST",body:event});
 assert.equal(writing.status,200,JSON.stringify(writing.obj));
 const photo=new Request(BASE+"/administracion/api/moments/"+globalThis.__fakeAlbumId+"/photo",{
  method:"POST",headers:{Origin:BASE,"Sec-Fetch-Site":"same-origin",Cookie:adminCookie,
   "Content-Type":"image/png"},body:new Uint8Array([137,80,78,71,13,10,26,10])
 });
 assert.equal((await worker.fetch(photo,env)).status,423);
 const mediaPut=new Request(BASE+"/administracion/api/upload?category=events",{
  method:"PUT",headers:{Origin:BASE,"Sec-Fetch-Site":"same-origin",Cookie:adminCookie,
   "Content-Type":"image/png"},body:new Uint8Array([137,80,78,71,13,10,26,10])
 });
 assert.equal((await worker.fetch(mediaPut,env)).status,423);
 const directPut=new Request(BASE+"/v1/mirror/admin/media/upload?category=events",{
  method:"PUT",headers:{Origin:BASE,"Sec-Fetch-Site":"same-origin",Cookie:publicCookie,
   "Content-Type":"image/png"},body:new Uint8Array([137,80,78,71,13,10,26,10])
 });
 assert.equal((await worker.fetch(directPut,env)).status,423);
 const r2Delete=await call("/administracion/api/write",{cookie:adminCookie,method:"POST",
  body:{kind:"media",action:"remove",keys:[]}});
 assert.equal(r2Delete.status,423);
 const photoDelete=await call("/administracion/api/write",{cookie:adminCookie,method:"POST",
  body:{kind:"moments_photos",action:"delete",id:crypto.randomUUID()}});
 assert.equal(photoDelete.status,423);
 const albumDelete=await call("/administracion/api/write",{cookie:adminCookie,method:"POST",
  body:{kind:"moments_albums",action:"delete",id:globalThis.__fakeAlbumId}});
 assert.equal(albumDelete.status,423);
 assert.equal(mediaObjects.size,0,"No se escribió un objeto R2");
 assert.equal(db.prepare("SELECT COUNT(*) AS n FROM moments_albums WHERE id=?").get(globalThis.__fakeAlbumId).n,1);
 env.R2_MUTATIONS_APPROVED=undefined; // Ausencia de bandera también cierra.
 const absent=await call("/administracion/api/write",{cookie:adminCookie,method:"POST",
  body:{kind:"media",action:"remove",keys:[]}});
 assert.equal(absent.status,423);
 env.STAGING_MUTATIONS="disabled";
});
test("foto real PNG ficticia: upload, imagen privada y borrado R2 por la consola",async()=>{
 env.STAGING_MUTATIONS="enabled";
 env.R2_MUTATIONS_APPROVED="yes"; // Solo datos y archivos ficticios en SQLite/R2 de memoria.
 const png=new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,1,2,3,4,5]);
 const uploadRoute="/administracion/api/moments/"+globalThis.__fakeAlbumId+"/photo";
 const request=new Request(BASE+uploadRoute,{method:"POST",headers:{
  Origin:BASE,"Sec-Fetch-Site":"same-origin","Cookie":adminCookie,"Content-Type":"image/png"
 },body:png});
 const response=await worker.fetch(request,env);
 assert.equal(response.status,200,await response.clone().text());
 const payload=await response.json();
 assert.match(payload.id,/^[0-9a-f-]{36}$/);
 const result=await call("/administracion/api/community",{cookie:adminCookie});
 assert.equal(result.status,200);
 assert.ok(result.obj.photos.some(x=>x.id===payload.id));
 const saved=db.prepare("SELECT storage_path FROM moments_photos WHERE id=?").get(payload.id);
 assert.ok(saved.storage_path.startsWith("moments/"));
 assert.equal(mediaObjects.get(saved.storage_path).bytes.length,png.length);
 // El archivo no se entrega anónimamente ni usando la cookie pública.
 assert.equal((await call("/administracion/api/photos/"+payload.id)).status,401);
 assert.equal((await call("/administracion/api/photos/"+payload.id,{cookie:publicCookie})).status,401);
 const image=await worker.fetch(req("/administracion/api/photos/"+payload.id,{cookie:adminCookie}),env);
 assert.equal(image.status,200);
 assert.equal(image.headers.get("content-type"),"image/png");
 assert.deepEqual(new Uint8Array(await image.arrayBuffer()),png);
 // El panel elimina también el objeto R2 de prueba.
 env.R2_MUTATIONS_APPROVED="no";
 const denied=await call("/administracion/api/write",{cookie:adminCookie,method:"POST",
  body:{kind:"moments_photos",action:"delete",id:payload.id}});
 assert.equal(denied.status,423);
 assert.equal(mediaObjects.has(saved.storage_path),true);
 assert.equal(db.prepare("SELECT COUNT(*) AS n FROM moments_photos WHERE id=?").get(payload.id).n,1);
 env.R2_MUTATIONS_APPROVED="yes";
 const deleted=await call("/administracion/api/write",{cookie:adminCookie,method:"POST",
  body:{kind:"moments_photos",action:"delete",id:payload.id}});
 assert.equal(deleted.status,200);
 assert.equal(mediaObjects.has(saved.storage_path),false);
 assert.equal(db.prepare("SELECT COUNT(*) AS n FROM moments_photos WHERE id=?").get(payload.id).n,0);
 env.STAGING_MUTATIONS="disabled";
});
test("archivos falsos, intentos externos y bloqueo de staging no pueden alterar galerías",async()=>{
 env.STAGING_MUTATIONS="enabled";
 const uploadRoute="/administracion/api/moments/"+globalThis.__fakeAlbumId+"/photo";
 const fake=new Uint8Array([1,2,3,4,5]);
 const external=new Request(BASE+uploadRoute,{method:"POST",headers:{
  Origin:"https://malicioso.invalid","Sec-Fetch-Site":"cross-site",Cookie:adminCookie,"Content-Type":"image/png"
 },body:fake});
 assert.equal((await worker.fetch(external,env)).status,403);
 const invalid=new Request(BASE+uploadRoute,{method:"POST",headers:{
  Origin:BASE,"Sec-Fetch-Site":"same-origin",Cookie:adminCookie,"Content-Type":"image/png"
 },body:fake});
 assert.equal((await worker.fetch(invalid,env)).status,415);
 env.STAGING_MUTATIONS="disabled";
 const blocked=new Request(BASE+uploadRoute,{method:"POST",headers:{
  Origin:BASE,"Sec-Fetch-Site":"same-origin",Cookie:adminCookie,"Content-Type":"image/png"
 },body:new Uint8Array([137,80,78,71,1,2,3,4])});
 assert.equal((await worker.fetch(blocked,env)).status,423);
 assert.equal(mediaObjects.size,0);
});
test("activación admin falla cerrada sin permiso explícito o con staging bloqueado",async()=>{
 const body={email:ACTIVATION_EMAIL};
 env.STAGING_MUTATIONS="disabled";
 assert.equal((await call("/administracion/api/activar/solicitar",{
  method:"POST",cookie:freshGoogleCookie,body})).status,423);
 env.STAGING_MUTATIONS="enabled";
 assert.equal((await call("/administracion/api/activar/solicitar",{
  method:"POST",cookie:freshGoogleCookie,body})).status,503);
 env.STAGING_MUTATIONS="disabled";
 assert.equal(db.prepare("SELECT COUNT(*) AS n FROM auth_admin_activation_tokens").get().n,0);
});
test("activación admin exige sesión reciente Google y no acepta cookies admin ni socio",async()=>{
 env.STAGING_MUTATIONS="enabled";env.ADMIN_EMAIL_ACTIVATION_ENABLED="yes";
 env.ADMIN_PASSWORD_RUNTIME_APPROVED="yes";env.RESEND_API_KEY="fake-example-api-key";
 env.RESEND_FROM="notificaciones@example.test";
 const body={email:ACTIVATION_EMAIL};
 // La cookie privada admin NO sustituye a la sesión pública Google.
 assert.equal((await call("/administracion/api/activar/solicitar",{
  method:"POST",cookie:adminCookie,body})).status,403);
 assert.equal((await call("/administracion/api/activar/solicitar",{
  method:"POST",cookie:publicCookie,body})).status,403);
 db.prepare("UPDATE auth_sessions SET created_at=unixepoch()-1000 WHERE profile_id=?").run(GOOGLE_ADMIN);
 assert.equal((await call("/administracion/api/activar/solicitar",{
  method:"POST",cookie:freshGoogleCookie,body})).status,403);
 freshGoogleCookie=await issueVerifiedGoogleSession();
 assert.equal(db.prepare("SELECT COUNT(*) AS n FROM auth_admin_activation_tokens").get().n,0);
});
test("rechaza email o sesión antigua incluso si el administrador tiene identidad Google vinculada",async()=>{
 // Primera comprobación después de habilitar flags (solo D1 ficticia).
 const rawUnknown=(await createAuthSession(GOOGLE_ADMIN,env)).split(";")[0];
 const request={email:ACTIVATION_EMAIL};
 let result=await call("/administracion/api/activar/solicitar",{
  method:"POST",cookie:rawUnknown,body:request});
 assert.equal(result.status,403);
 // Simular login por contraseña en el MISMO perfil Google-administrador.
 const raw=rawUnknown.split("=")[1];
 const digest=enc(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(raw)));
 db.prepare("UPDATE auth_sessions SET auth_method='email' WHERE token_hash=?").run(digest);
 result=await call("/administracion/api/activar/solicitar",{
  method:"POST",cookie:rawUnknown,body:request});
 assert.equal(result.status,403);
 // Una sesión Google de más de cinco minutos también se rechaza.
 const expired=(await createAuthSession(GOOGLE_ADMIN,env)).split(";")[0];
 const expiredRaw=expired.split("=")[1];
 const expiredDigest=enc(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(expiredRaw)));
 db.prepare("UPDATE auth_sessions SET auth_method='google',created_at=unixepoch()-301 WHERE token_hash=?").run(expiredDigest);
 assert.equal((await call("/administracion/api/activar/solicitar",{
  method:"POST",cookie:expired,body:request})).status,403);
 assert.equal(db.prepare("SELECT COUNT(*) AS n FROM auth_admin_activation_tokens").get().n,0);
});
test("un Google-admin existente recibe un enlace de un solo uso sin nuevo perfil",async()=>{
 const oldFetch=globalThis.fetch;
 let mail=null;
 globalThis.fetch=async(url,opts)=>{
  assert.equal(String(url),"https://api.resend.com/emails");
  mail=JSON.parse(opts.body);
  return new Response('{"id":"mail-ficticio"}',{status:200});
 };
 try{
  const r=await call("/administracion/api/activar/solicitar",{
   method:"POST",cookie:freshGoogleCookie,body:{email:ACTIVATION_EMAIL}});
  assert.equal(r.status,200,JSON.stringify(r.obj));
 }finally{globalThis.fetch=oldFetch;}
 assert.ok(mail);
 assert.deepEqual(mail.to,[ACTIVATION_EMAIL]);
 const match=mail.text.match(/\/administracion\/\?activar=([A-Za-z0-9_-]{43})/);
 assert.ok(match,"Correo de verificación sin token");
 activationToken=match[1];
 const pending=db.prepare("SELECT profile_id,email,expires_at-unixepoch() AS remaining FROM auth_admin_activation_tokens").get();
 assert.equal(pending.profile_id,GOOGLE_ADMIN);
 assert.equal(pending.email,ACTIVATION_EMAIL);
 assert.ok(pending.remaining>0&&pending.remaining<=900);
 assert.equal(db.prepare("SELECT COUNT(*) AS n FROM profiles").get().n,3);
 assert.equal(db.prepare("SELECT COUNT(*) AS n FROM auth_email_credentials").get().n,2);
});
test("activación: cooldown, correo ocupado y origen externo rechazados",async()=>{
 assert.equal((await call("/administracion/api/activar/solicitar",{
  method:"POST",cookie:freshGoogleCookie,body:{email:ACTIVATION_EMAIL}})).status,429);
 assert.equal((await call("/administracion/api/activar/solicitar",{
  method:"POST",cookie:freshGoogleCookie,body:{email:"admin@example.test"}})).status,409);
 assert.equal((await call("/administracion/api/activar/confirmar",{
  method:"POST",origin:"https://externo.invalid",body:{token:activationToken,password:PASSWORD}})).status,403);
});
test("activación admin rechaza claves débiles, token falso y conserva puntos",async()=>{
 for(const body of [
  {token:activationToken,password:"123"},
  {token:"x".repeat(43),password:PASSWORD}
 ]){
  assert.equal((await call("/administracion/api/activar/confirmar",{
   method:"POST",body})).status,400);
 }
 assert.equal(db.prepare("SELECT SUM(points) AS total FROM profiles").get().total,0);
 assert.equal(db.prepare("SELECT COUNT(*) AS n FROM auth_email_credentials").get().n,2);
});
test("el administrador establece su contraseña y se vincula al MISMO ID Google",async()=>{
 const r=await call("/administracion/api/activar/confirmar",{
  method:"POST",body:{token:activationToken,password:PASSWORD}});
 assert.equal(r.status,200,JSON.stringify(r.obj));
 const linked=db.prepare("SELECT c.profile_id,c.verified_at,c.password_hash,l.provider "+
  "FROM auth_email_credentials c JOIN auth_identity_links l "+
  "ON l.profile_id=c.profile_id AND l.provider='email' WHERE c.email=?").get(ACTIVATION_EMAIL);
 assert.equal(linked.profile_id,GOOGLE_ADMIN);
 assert.equal(linked.provider,"email");
 assert.match(linked.password_hash,/^pbkdf2-chain6-sha256-v1\$/);
 assert.ok(linked.verified_at>0);
 assert.equal(db.prepare("SELECT COUNT(*) AS n FROM profiles").get().n,3);
 const login=await sign(ACTIVATION_EMAIL);
 assert.equal(login.status,200,JSON.stringify(login.obj));
 assert.equal(login.obj.profile.role,"admin");
 // Nunca duplicar visitas/puntos al vincular otra forma de acceso.
 assert.equal(db.prepare("SELECT COUNT(*) AS n FROM activity").get().n,0);
 assert.equal(db.prepare("SELECT COALESCE(SUM(points),0) AS n FROM profiles").get().n,0);
});
test("el enlace se consume una sola vez; no cambia roles ni saldos",async()=>{
 const again=await call("/administracion/api/activar/confirmar",{
  method:"POST",body:{token:activationToken,password:PASSWORD}});
 assert.equal(again.status,400);
 assert.equal(db.prepare("SELECT COUNT(*) AS n FROM profiles WHERE role='admin'").get().n,2);
 assert.equal(db.prepare("SELECT COUNT(*) AS n FROM auth_identity_links WHERE provider='email' AND profile_id=?").get(GOOGLE_ADMIN).n,1);
 env.STAGING_MUTATIONS="disabled";
 env.ADMIN_EMAIL_ACTIVATION_ENABLED="no";
 env.ADMIN_PASSWORD_RUNTIME_APPROVED="no";
});
test("CSRF bloquea modificaciones desde sitios ajenos",async()=>{
 const r=await call("/administracion/api/write",{method:"POST",cookie:adminCookie,
  origin:"https://malicioso.invalid",body:{kind:"catalog",table:"events",action:"delete",id:"00000000-0000-4000-8000-000000000111"}});
 assert.equal(r.status,403);
});
test("cerrar sesión admin revoca credencial y deja la cookie pública intacta",async()=>{
 const out=await call("/administracion/api/logout",{method:"POST",cookie:adminCookie,body:{}});
 assert.equal(out.status,200);assert.match(out.cookie,/__Host-bf_admin=; Path=\/; Max-Age=0/);
 assert.equal((await call("/administracion/api/me",{cookie:adminCookie})).status,401);
 const check=await call("/v1/auth/me",{cookie:publicCookie});
 assert.equal(check.obj.authenticated,true);
});

test("SSO: no exige otra contraseña ni permite socio o sesión sin verificar",async()=>{
 env.ADMIN_SSO_ENABLED="yes";
 const blank=await call("/administracion/api/sso",{method:"POST",body:{}});
 assert.equal(blank.status,401);
 const unknown=await call("/administracion/api/sso",{method:"POST",cookie:publicCookie,body:{}});
 assert.equal(unknown.status,403);
 const memberSession=(await createAuthSession(MEMBER,env)).split(";")[0];
 assert.equal((await call("/administracion/api/sso",{method:"POST",cookie:memberSession,body:{}})).status,403);
 assert.equal((await call("/administracion/api/sso",{method:"POST",cookie:freshGoogleCookie,
   origin:"https://externo.invalid",body:{}})).status,403);
 assert.equal((await call("/administracion/api/login",{method:"POST",cookie:freshGoogleCookie,
   body:{email:"admin@example.test",password:PASSWORD}})).status,410);
 assert.equal((await call("/administracion/api/activar/solicitar",{method:"POST",
   cookie:freshGoogleCookie,body:{email:ACTIVATION_EMAIL}})).status,404);
 assert.equal(db.prepare("SELECT COUNT(*) AS n FROM admin_sso_sessions").get().n,0);
});
let ssoCookie,ssoBoth;
test("SSO: admin con Google verificado entra directamente, sin alterar puntos o perfiles",async()=>{
 const totalBefore=db.prepare("SELECT COUNT(*) AS n,COALESCE(SUM(points),0) AS points,COALESCE(SUM(visits),0) AS visits FROM profiles").get();
 const sso=await call("/administracion/api/sso",{method:"POST",cookie:freshGoogleCookie,body:{}});
 assert.equal(sso.status,200,JSON.stringify(sso.obj));
 assert.equal(sso.obj.profile.id,GOOGLE_ADMIN);
 assert.equal(sso.obj.profile.role,"admin");
 assert.match(sso.cookie,/__Host-bf_admin=[A-Za-z0-9_-]{43}/);
 assert.match(sso.cookie,/HttpOnly; SameSite=Strict/);
 assert.match(sso.cookie,/Max-Age=3600/);
 ssoCookie=sso.cookie.split(";")[0];
 ssoBoth=freshGoogleCookie+"; "+ssoCookie;
 const data=db.prepare("SELECT expires_at-unixepoch() AS ttl FROM admin_sso_sessions LIMIT 1").get();
 assert.ok(data.ttl>0&&data.ttl<=3600);
 assert.equal((await call("/administracion/api/me",{cookie:freshGoogleCookie})).status,401);
 assert.equal((await call("/administracion/api/me",{cookie:ssoCookie})).status,401);
 assert.equal((await call("/administracion/api/me",{cookie:ssoBoth})).status,200);
 assert.equal((await call("/administracion/api/members",{cookie:ssoBoth})).status,200);
 assert.deepEqual(db.prepare("SELECT COUNT(*) AS n,COALESCE(SUM(points),0) AS points,COALESCE(SUM(visits),0) AS visits FROM profiles").get(),totalBefore);
});
test("SSO: comprobación de rol real, cookie ajena y padre revocado",async()=>{
 const forged=(await createAuthSession(MEMBER,env)).split(";")[0];
 assert.equal((await call("/administracion/api/me",{cookie:forged+"; "+ssoCookie})).status,401);
 db.prepare("UPDATE profiles SET role='socio' WHERE id=?").run(GOOGLE_ADMIN);
 try{
   assert.equal((await call("/administracion/api/me",{cookie:ssoBoth})).status,401);
   assert.equal((await call("/administracion/api/members",{cookie:ssoBoth})).status,401);
 }finally{db.prepare("UPDATE profiles SET role='admin' WHERE id=?").run(GOOGLE_ADMIN);}
 assert.equal((await call("/administracion/api/me",{cookie:ssoBoth})).status,200);
});
test("SSO: cerrar solo el panel revoca admin y conserva login público",async()=>{
 const loggedOut=await call("/administracion/api/logout",{method:"POST",cookie:ssoBoth,body:{}});
 assert.equal(loggedOut.status,200);
 assert.match(loggedOut.cookie,/__Host-bf_admin=; Path=\/; Max-Age=0/);
 assert.equal((await call("/administracion/api/me",{cookie:ssoBoth})).status,401);
 assert.equal((await call("/v1/auth/me",{cookie:freshGoogleCookie})).obj.authenticated,true);
 const back=await call("/administracion/api/sso",{method:"POST",cookie:freshGoogleCookie,body:{}});
 assert.equal(back.status,200);
 const cookies=freshGoogleCookie+"; "+back.cookie.split(";")[0];
 assert.equal((await call("/administracion/api/me",{cookie:cookies})).status,200);
 // El cierre de sesión en la WEB revoca también el panel (FK ON DELETE CASCADE).
 const webLogout=await call("/v1/auth/logout",{method:"POST",cookie:freshGoogleCookie,body:{}});
 assert.equal(webLogout.status,200);
 assert.equal((await call("/administracion/api/me",{cookie:cookies})).status,401);
 assert.equal(db.prepare("SELECT COUNT(*) AS n FROM admin_sso_sessions").get().n,0);
 env.ADMIN_SSO_ENABLED="no";
});
