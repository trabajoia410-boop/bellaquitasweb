/**
 * Bellaquitas fase 5: sesión REAL en forma, respuestas Supabase 100% SIMULADAS.
 * No importa cuentas ni tokens reales y no usa servicios externos.
 * Verifica el Worker, D1 in-memory, cookies y los dos chequeos de rol.
 */
import assert from "node:assert/strict";
import {test} from "node:test";
import {DatabaseSync} from "node:sqlite";
import {readFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath,pathToFileURL} from "node:url";
const dir=path.dirname(fileURLToPath(import.meta.url));
const built=path.join(dir,"staging-source-2026-11-11","recovered-src");
const {default:worker}=await import(pathToFileURL(path.join(built,"bellaquitas-api-staging.js")).href);
const BASE="https://bellaquitas-api-staging.bellaquitas-fest-410.workers.dev";
const AUTH="https://vlsipvngvxcgnwrhpjgg.supabase.co";
const ADMIN="00000000-0000-4000-8000-000000000301";
const MEMBER="00000000-0000-4000-8000-000000000302";
const db=new DatabaseSync(":memory:");
db.exec("PRAGMA foreign_keys=ON");
for(const file of ["0001-schema.sql","0002-auth-and-invariants.sql",
 "0003-oauth-sessions.sql","0005-auth-session-method.sql",
 "0007-admin-sso-sessions.sql"]){
 db.exec(readFileSync(path.join(dir,"migrations",file),"utf8"));
}
db.prepare("INSERT INTO profiles(id,name,role,member_code) VALUES(?,?,?,?)")
 .run(ADMIN,"Admin ficticio","admin","MBR-QA-ADMINBRIDGE");
db.prepare("INSERT INTO profiles(id,name,role,member_code) VALUES(?,?,?,?)")
 .run(MEMBER,"Socio ficticio","socio","MBR-QA-SOCIOBRIDGE");
const D1={prepare(sql){
 const statement=db.prepare(sql);
 return {bind(...args){return {
  async first(){return statement.get(...args)||null;},
  async all(){return {results:statement.all(...args)};},
  async run(){return {success:true,meta:statement.run(...args)};}
 };},async first(){return statement.get()||null;},async run(){return {success:true,meta:statement.run()};}};
 },async batch(queries){const list=[];for(const query of queries)list.push(await query.run());return list;}};
const env={DB:D1,PUBLIC_ORIGIN:BASE,STAGING_MUTATIONS:"disabled",
 COST_POLICY:"free-only",ADMIN_SSO_ENABLED:"yes",
 ADMIN_SUPABASE_BRIDGE:"yes",SUPABASE_URL:AUTH,
 SUPABASE_ANON_KEY:"PUBLIC-ANON-KEY-FOR-ISOLATED-TEST-ONLY"};
const encoded=value=>Buffer.from(JSON.stringify(value)).toString("base64url");
const token=subject=>encoded({alg:"HS256",typ:"JWT"})+"."+
 encoded({sub:subject,exp:Math.floor(Date.now()/1000)+1800})+"."+
 "SIMULATED_SIGNATURE_NOT_VERIFIED_BY_WORKER_NO_REAL_NETWORK";
const goodToken=token(ADMIN),memberToken=token(MEMBER);
const valid=new Map([[goodToken,{id:ADMIN,provider:"google"}],
 [memberToken,{id:MEMBER,provider:"email"}]]);
let officialRoles=new Map([[ADMIN,"admin"],[MEMBER,"socio"]]);
let verifiedCalls=0;
const nativeFetch=globalThis.fetch;
globalThis.fetch=async(url,opts)=>{
 const target=String(url);
 assert.ok(target.startsWith(AUTH+"/"),"No llamada externa inesperada");
 assert.equal(opts.method,"GET");
 assert.equal(opts.cache,"no-store");
 const bearer=String(opts.headers.Authorization||"").replace(/^Bearer /,"");
 const identity=valid.get(bearer);
 verifiedCalls++;
 if(!identity)return Response.json({error:"Unauthorized"},{status:401});
 if(target===AUTH+"/auth/v1/user")
   return Response.json({id:identity.id,app_metadata:{provider:identity.provider}});
 if(target.startsWith(AUTH+"/rest/v1/profiles?")){
   const uid=new URL(target).searchParams.get("id");
   assert.equal(uid,"eq."+identity.id);
   return Response.json([{id:identity.id,role:officialRoles.get(identity.id)}]);
 }
 return Response.json({error:"Unknown endpoint"},{status:404});
};
process.on("exit",()=>{globalThis.fetch=nativeFetch;try{db.close();}catch{}});
function req(path,{method="GET",token:bearer="",cookies="",origin=BASE}={}){
 const headers={Origin:origin,"Sec-Fetch-Site":origin===BASE?"same-origin":"cross-site"};
 if(bearer)headers.Authorization="Bearer "+bearer;
 if(cookies)headers.Cookie=cookies;
 return new Request(BASE+path,{method,headers});
}
async function call(path,opts={}){
 const res=await worker.fetch(req("/administracion/api"+path,opts),env);
 return {status:res.status,body:await res.json(),headers:res.headers};
}
test("puente desactivado o sin bearer falla sin escribir sesiones",async()=>{
 env.ADMIN_SUPABASE_BRIDGE="no";
 assert.equal((await call("/supabase-bridge",{method:"POST",token:goodToken})).status,503);
 env.ADMIN_SUPABASE_BRIDGE="yes";
 assert.equal((await call("/supabase-bridge",{method:"POST"})).status,401);
 assert.equal(db.prepare("SELECT count(*) AS n FROM auth_sessions").get().n,0);
});
test("token simulado no autorizado por Auth se rechaza sin confiar en el JWT",async()=>{
 const fake=token("00000000-0000-4000-8000-000000000999");
 const r=await call("/supabase-bridge",{method:"POST",token:fake});
 assert.equal(r.status,401);
});
test("socio no puede abrir panel aunque su sesión esté verificada",async()=>{
 const r=await call("/supabase-bridge",{method:"POST",token:memberToken});
 assert.equal(r.status,401);
});
test("origen web cruzado no puede intercambiar tokens",async()=>{
 const r=await call("/supabase-bridge",{method:"POST",token:goodToken,
  origin:"https://atacante.example"});
 assert.equal(r.status,403);
});
let cookies="";
test("administrador REALMENTE verificado en Auth y RLS recibe dos cookies HttpOnly",async()=>{
 const r=await call("/supabase-bridge",{method:"POST",token:goodToken});
 assert.equal(r.status,200,JSON.stringify(r.body));
 assert.equal(r.body.profile.id,ADMIN);
 const issued=r.headers.getSetCookie();
 assert.equal(issued.length,2,JSON.stringify(issued));
 for(const value of issued)assert.match(value,/Secure; HttpOnly; SameSite=/);
 cookies=issued.map(x=>x.split(";")[0]).join("; ");
 assert.match(cookies,/__Host-bf_admin=/);
 assert.match(cookies,/__Host-bf_session=/);
 assert.equal(db.prepare("SELECT count(*) AS n FROM auth_sessions WHERE auth_method='google'").get().n,1);
 assert.equal(db.prepare("SELECT count(*) AS n FROM admin_sso_sessions").get().n,1);
 const response=await call("/me",{cookies,token:goodToken});
 assert.equal(response.status,200);
 assert.equal(response.body.profile.role,"admin");
});
test("cookies D1 sin sesión pública vigente no dan acceso",async()=>{
 assert.equal((await call("/me",{cookies})).status,401);
 assert.equal((await call("/events",{cookies})).status,401);
});
test("otra identidad aunque esté autenticada no reutiliza las cookies",async()=>{
 assert.equal((await call("/me",{cookies,token:memberToken})).status,401);
});
test("si Supabase revoca rol admin, D1 no basta para permitir acceso",async()=>{
 officialRoles.set(ADMIN,"socio");
 assert.equal((await call("/me",{cookies,token:goodToken})).status,401);
 assert.equal((await call("/member",{method:"POST",cookies,token:goodToken})).status,401);
 officialRoles.set(ADMIN,"admin");
});
test("si D1 revoca admin, no basta con que Supabase aún diga admin",async()=>{
 db.prepare("UPDATE profiles SET role='socio' WHERE id=?").run(ADMIN);
 assert.equal((await call("/me",{cookies,token:goodToken})).status,401);
 db.prepare("UPDATE profiles SET role='admin' WHERE id=?").run(ADMIN);
});
test("salir del panel revoca sesión admin pero conserva sesión pública",async()=>{
 assert.equal((await call("/logout",{method:"POST",cookies,token:goodToken})).status,200);
 assert.equal((await call("/me",{cookies,token:goodToken})).status,401);
 assert.equal(db.prepare("SELECT count(*) AS n FROM auth_sessions").get().n,1);
 assert.equal(db.prepare("SELECT count(*) AS n FROM admin_sso_sessions").get().n,0);
});
test("invariantes: ningún saldo, visita o código se ha modificado",()=>{
 const rows=db.prepare("SELECT role,points,lifetime_points,visits FROM profiles").all();
 assert.equal(rows.length,2);
 assert.ok(rows.every(x=>x.points===0&&x.lifetime_points===0&&x.visits===0));
 assert.ok(verifiedCalls>4);
});
