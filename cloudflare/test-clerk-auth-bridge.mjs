#!/usr/bin/env node
/* Clerk + Cloudflare, pruebas 100% sintéticas y sin Internet ni cuentas reales. */
import assert from "node:assert/strict";
import {generateKeyPairSync,createSign} from "node:crypto";
import {readFileSync} from "node:fs";
import {verifyClerkJwt,clerkIdentityRoute} from "./clerk-auth-bridge.js";
import {clerkSessionExchange} from "./clerk-session-exchange.js";
const issuer="https://qa.clerk.accounts.dev",origin="https://qa.bellaquitas.test";
const {privateKey,publicKey}=generateKeyPairSync("rsa",{modulusLength:2048,publicExponent:65537});
const jwk={...publicKey.export({format:"jwk"}),kid:"qa-clerk-kid-2026",use:"sig",alg:"RS256"};
let availableJwks=[jwk];
let fetches=0,queries=0;
const previousFetch=globalThis.fetch;
globalThis.fetch=async (url)=>{
 assert.equal(url,issuer+"/.well-known/jwks.json","JWKS no puede venir de JWT controlado por el usuario");
 fetches++;
 return new Response(JSON.stringify({keys:availableJwks}),{status:200,headers:{"content-type":"application/json"}});
};
const encode=x=>Buffer.from(JSON.stringify(x)).toString("base64url");
const now=Math.floor(Date.now()/1000);
const header={typ:"JWT",alg:"RS256",kid:jwk.kid};
const claims={iss:issuer,azp:origin,sub:"user_0123456789abcdefghijklmn",
 sid:"sess_0123456789abcdefghijklmn",iat:now-20,nbf:now-10,exp:now+80};
const make=(payload=claims,h=header,other=privateKey)=>{
 const part=encode(h)+"."+encode(payload);
 const signature=createSign("RSA-SHA256").update(part).end().sign(other).toString("base64url");
 return part+"."+signature;
};
const signed=make();
const member={id:"11111111-1111-4111-8111-111111111111",name:"Socio sintético",role:"socio",
 member_code:"MBR-EXAMPLE",points:42,lifetime_points:42,visits:0};
const env={SITE_MODE:"staging",CLERK_JWT_ENABLED:"yes",CLERK_ISSUER:issuer,
 CLERK_ALLOWED_ORIGIN:origin,
 DB:{prepare(sql){assert.match(sql,/FROM auth_clerk_links/);assert.match(sql,/migration_confirmed/);
    return {bind(sub){assert.equal(sub,claims.sub);
      return {async first(){queries++;return member;}};}};}}};
const request=(token=signed,path="/v1/auth/clerk/me",method="GET")=>new Request(origin+path,{method,headers:{"Authorization":"Bearer "+token}});
try{
 // JWKS no es fiable: Content-Length ausente NO autoriza descargar JSON
 // excesivo. El token de prueba está firmado, así que la única barrera debe
 // ser el límite real de bytes, no una firma incorrecta.
 const overflowIssuer="https://qa-overflow.clerk.accounts.dev";
 const overflowEnv={...env,CLERK_ISSUER:overflowIssuer};
 const overflowToken=make({...claims,iss:overflowIssuer});
 const huge=JSON.stringify({keys:[jwk],payload:"x".repeat(70000)});
 assert.equal(await verifyClerkJwt(request(overflowToken),overflowEnv,
  async()=>new Response(huge,{status:200})),null,
  "JWKS debe rechazar payloads mayores a 64 KiB sin Content-Length");
 const fakeLength=String(Buffer.byteLength(JSON.stringify({keys:[jwk]})));
 const lengthIssuer="https://qa-length.clerk.accounts.dev";
 const lengthEnv={...env,CLERK_ISSUER:lengthIssuer};
 const lengthToken=make({...claims,iss:lengthIssuer});
 const validJWKS=await verifyClerkJwt(request(lengthToken),lengthEnv,
  async()=>new Response(JSON.stringify({keys:[jwk]}),{status:200,
   headers:{"Content-Length":fakeLength}}));
 assert.equal(validJWKS.subject,claims.sub,
  "El límite JWKS no debe romper respuestas legales con Content-Length");
 const streamIssuer="https://qa-streaming.clerk.accounts.dev";
 const streamEnv={...env,CLERK_ISSUER:streamIssuer};
 const streamToken=make({...claims,iss:streamIssuer});
 let chunks=0;
 const stream=new ReadableStream({pull(controller){
  chunks++;
  controller.enqueue(new Uint8Array(8192).fill(0x20));
  if(chunks>=20)controller.close();
 }});
 assert.equal(await verifyClerkJwt(request(streamToken),streamEnv,
  async()=>new Response(stream,{status:200})),null,
  "El límite funciona en streaming");
 assert.ok(chunks<20,"No consumir cuerpo completo tras exceder 64 KiB");
 // JWKS concurrente: una ráfaga no debe iniciar 20 subrequests hacia
 // el emisor real. La simulación utiliza firmas y rutas puramente sintéticas.
 const burstIssuer="https://qa-burst.clerk.accounts.dev";
 const burstEnv={...env,CLERK_ISSUER:burstIssuer};
 let burstCalls=0;
 const burstNetwork=async url=>{
  assert.equal(url,burstIssuer+"/.well-known/jwks.json");
  burstCalls++;
  await new Promise(resolve=>setImmediate(resolve));
  return new Response(JSON.stringify({keys:[jwk]}),{status:200});
 };
 const burst=await Promise.all(Array.from({length:20},(_,i)=>
  verifyClerkJwt(request(make({...claims,iss:burstIssuer},
   {...header,kid:"qa-burst-unknown-"+String(i).padStart(4,"0")})),
   burstEnv,burstNetwork)));
 assert.ok(burst.every(result=>result===null),
  "Las veinte firmas con KID desconocido deben rechazarse");
 assert.equal(burstCalls,1,
  "JWKS concurrente: debe haber una sola descarga y no veinte");

 // Dos claves legítimas simultáneas: no perder ninguna por carreras entre
 // importación y actualización de la caché del mismo isolate.
 const parallelIssuer="https://qa-parallel.clerk.accounts.dev";
 const parallelEnv={...env,CLERK_ISSUER:parallelIssuer};
 const parallelPair=generateKeyPairSync("rsa",{modulusLength:2048,publicExponent:65537});
 const parallelJwk={...parallelPair.publicKey.export({format:"jwk"}),
  kid:"qa-clerk-parallel-key",use:"sig",alg:"RS256"};
 let parallelCalls=0;
 const parallelNetwork=async url=>{
  assert.equal(url,parallelIssuer+"/.well-known/jwks.json");
  parallelCalls++;
  await new Promise(resolve=>setImmediate(resolve));
  return new Response(JSON.stringify({keys:[jwk,parallelJwk]}),{status:200});
 };
 const oldParallel=make({...claims,iss:parallelIssuer});
 const newParallel=make({...claims,iss:parallelIssuer},
  {...header,kid:parallelJwk.kid},parallelPair.privateKey);
 const both=await Promise.all([
  verifyClerkJwt(request(oldParallel),parallelEnv,parallelNetwork),
  verifyClerkJwt(request(newParallel),parallelEnv,parallelNetwork)]);
 assert.equal(both[0]?.subject,claims.sub);
 assert.equal(both[1]?.subject,claims.sub);
 assert.equal(parallelCalls,1,"Solo una descarga de dos claves");
 assert.equal((await verifyClerkJwt(request(oldParallel),parallelEnv,
  async()=>{throw Error("No debe recargar JWKS");}))?.subject,claims.sub);
 assert.equal((await verifyClerkJwt(request(newParallel),parallelEnv,
  async()=>{throw Error("No debe recargar JWKS");}))?.subject,claims.sub);


 // Ante fallo externo, la primera solicitud falla cerrada y durante 30s no
 // se repite el subrequest para cada token potencialmente malicioso.
 const brokenIssuer="https://qa-provider-down.clerk.accounts.dev";
 const brokenEnv={...env,CLERK_ISSUER:brokenIssuer};
 const brokenToken=make({...claims,iss:brokenIssuer});
 let providerAttempts=0;
 const brokenNetwork=async (url,opts)=>{
  assert.equal(url,brokenIssuer+"/.well-known/jwks.json");
  assert.ok(opts.signal instanceof AbortSignal,
   "Cada consulta externa debe tener plazo de 5 segundos");
  providerAttempts++;
  throw Error("JWKS provider unavailable");
 };
 assert.equal(await verifyClerkJwt(request(brokenToken),brokenEnv,brokenNetwork),null);
 for(let i=0;i<25;i++)
  assert.equal(await verifyClerkJwt(request(brokenToken),brokenEnv,brokenNetwork),null);
 assert.equal(providerAttempts,1,
  "JWKS fallido no debe crear miles de subrequests externos");

 // Una vez transcurrido el cooldown, un emisor recuperado vuelve a admitir
 // la firma legítima sin intervención ni falsificar identidades.
 const oldNow=Date.now;
 try{
  Date.now=()=>oldNow()+31_000;
  const recovered=await verifyClerkJwt(request(brokenToken),brokenEnv,
   async (url,opts)=>{
    assert.equal(url,brokenIssuer+"/.well-known/jwks.json");
    assert.equal(opts.signal.aborted,false);
    return new Response(JSON.stringify({keys:[jwk]}),{status:200});
   });
  assert.equal(recovered?.subject,claims.sub);
 }finally{Date.now=oldNow;}

 const good=await verifyClerkJwt(request(),env);
 assert.equal(good.subject,claims.sub);
 const profile=await clerkIdentityRoute(request(),env);
 assert.equal(profile.status,200);const body=await profile.json();
 assert.equal(body.authenticated,true);assert.deepEqual(body.profile,member);
 assert.equal(body.adminSessionAuthorized,false);
 assert.equal(profile.headers.get("Cache-Control"),"no-store");
 assert.equal(profile.headers.get("Set-Cookie"),null);
 assert.ok(fetches===1&&queries===1,
 "JWKS key import should be reused in one Worker isolate");
 assert.equal(await clerkIdentityRoute(request(signed,"/v1/events"),env),null);
 assert.equal((await clerkIdentityRoute(request(signed,"/v1/auth/clerk/me","POST"),env)).status,405);
 const disabled={...env,CLERK_JWT_ENABLED:"no"};
 assert.equal((await clerkIdentityRoute(request(),disabled)).status,503);
 for(const modified of [
   {...claims,sub:"user_bad"}, {...claims,azp:"https://evil.test"},
   {...claims,iss:"https://evil.test"}, {...claims,exp:now-1},
   {...claims,nbf:now+120}, {...claims,iat:now+120},
   {...claims,exp:now+4000}, {...claims,sid:"invalid"},
   {...claims,sts:"pending"}, {...claims,sts:"ended"},
   {...claims,sts:"suspended"}, {...claims,act:{sub:"user_other123456789"}},
 ]){
  assert.equal(await verifyClerkJwt(request(make(modified)),env),null,
    "Cualquier claim fuera de dominio, identidad o plazo debe rechazarse");
 }
 const fakeSignature=signed.slice(0,-6)+"xxxxxx";
 assert.equal(await verifyClerkJwt(request(fakeSignature),env),null);
 assert.equal(await verifyClerkJwt(request(make(claims,{...header,alg:"none"})),env),null);
 assert.equal(await verifyClerkJwt(request(make(claims,{...header,jku:"https://evil.test/jwks"})),env),null);
 assert.equal(await verifyClerkJwt(request(make(claims,{...header,kid:"unknown-key"})),env),null);
 const priorMisses=fetches;
 for(let n=0;n<30;n++)
  assert.equal(await verifyClerkJwt(request(make(claims,{...header,kid:"unknown-"+n})),env),null);
 assert.equal(fetches,priorMisses,
 "Unknown KID flood must not trigger unbounded JWKS requests");

 // Si pasan 30s, un KID desconocido puede refrescar JWKS UNA vez,
 // pero NUNCA borrar la clave legítima ya importada y vigente.
 const originalClock=Date.now;
 try{
  const baseClock=originalClock();
  Date.now=()=>baseClock+31_000;
  assert.equal(await verifyClerkJwt(
    request(make(claims,{...header,kid:"qa-key-unknown-after-30s"})),env),null);
  assert.equal(fetches,priorMisses+1,"Una sola recarga JWKS tras el cooldown");
  assert.equal((await verifyClerkJwt(request(),env))?.subject,claims.sub,
    "Un KID inventado NO puede invalidar una sesión válida");
  assert.equal(fetches,priorMisses+1,
    "La clave conocida debe seguir cacheada sin más subrequests");

  // Simular rotación con dos claves firmantes. La firma anterior debe seguir
  // verificándose mientras el JWT esté vivo, sin reimportación costosa.
  const rotated=generateKeyPairSync("rsa",{modulusLength:2048,publicExponent:65537});
  const rotatedJwk={...rotated.publicKey.export({format:"jwk"}),
    kid:"qa-clerk-kid-2026-rotated",use:"sig",alg:"RS256"};
  availableJwks=[jwk,rotatedJwk];
  Date.now=()=>baseClock+62_000;
  const rotatedToken=make(claims,{...header,kid:rotatedJwk.kid},rotated.privateKey);
  assert.equal((await verifyClerkJwt(request(rotatedToken),env))?.subject,claims.sub);
  assert.equal((await verifyClerkJwt(request(),env))?.subject,claims.sub,
    "La nueva clave no debe desplazar la antigua válida");
  assert.equal(fetches,priorMisses+2,
    "La caché mantiene las dos claves sin recargar JWKS otra vez");
 }finally{
  Date.now=originalClock;
  availableJwks=[jwk];
 }

 assert.equal(await verifyClerkJwt(request(),{...env,CLERK_ISSUER:"http://qa.clerk.accounts.dev"}),null);
 assert.equal(await verifyClerkJwt(request(),{...env,CLERK_ISSUER:"https://evil.test"}),null);
 assert.equal(await verifyClerkJwt(request(),{...env,SITE_MODE:"production"}),null);
 const dbReturning=value=>({prepare:()=>({bind:()=>({first:async()=>value})})});
 assert.equal((await clerkIdentityRoute(request(),{...env,DB:dbReturning(null)})).status,403,
   "Clerk válido pero sin vinculación NO puede crear perfil o acceder");
 const admin={...member,role:"admin"};
 const adminRes=await clerkIdentityRoute(request(),{...env,DB:dbReturning(admin)});
 assert.equal(adminRes.status,200);
 assert.equal((await adminRes.json()).adminSessionAuthorized,false,
   "Clerk no sustituye segundo factor admin");
 const missingSchema=await clerkIdentityRoute(request(),{...env,DB:{prepare(){throw Error("missing table");}}});
 assert.equal(missingSchema.status,503);
 const config=JSON.parse(readFileSync("cloudflare/wrangler-api-preproduccion.jsonc","utf8"));
 assert.equal(config.vars?.CLERK_JWT_ENABLED,"no");
 assert.equal(config.vars?.PUBLISH_APPROVED,"no");
 const migration=readFileSync("cloudflare/migrations/0008-clerk-verified-links.sql","utf8");
 assert.match(migration,/CREATE TABLE IF NOT EXISTS auth_clerk_links/);
 assert.doesNotMatch(migration,/\b(?:UPDATE|DELETE)\s+profiles\b|\bINSERT\s+INTO\s+profiles\b/i);
 assert.doesNotMatch(migration,/password_hash|email\s*=/i);
 const exchangeRequest=(token=signed,withOrigin=true)=>new Request(origin+"/v1/auth/clerk/exchange",{
   method:"POST",headers:{"Authorization":"Bearer "+token,
     ...(withOrigin?{"Origin":origin,"Sec-Fetch-Site":"same-origin"}:{})}
 });
 assert.equal((await clerkSessionExchange(exchangeRequest(),env)).status,503,
   "No activar intercambio sin bandera adicional");
 let inserted=0;
 const sessionDB={
   prepare(sql){
     if(sql.includes("FROM auth_clerk_links"))return {bind(value){
       assert.equal(value,claims.sub);return {first:async()=>({id:member.id,role:"socio"})};}};
     if(sql.includes("SELECT role FROM profiles WHERE id=?"))return {bind(value){
       assert.equal(value,member.id);return {first:async()=>({role:"socio"})};}};
     if(sql.startsWith("INSERT INTO auth_sessions"))return {bind(...params){
       assert.equal(params[1],member.id);
       assert.equal(params[2],12*60*60);
       return {run:async()=>{inserted++;return {success:true};}};}};
     throw Error("Unexpected SQL - no points/visits/role changes permitted");
   }
 };
 const exchangeEnv={...env,CLERK_EXCHANGE_ENABLED:"yes",DB:sessionDB};
 const exchanged=await clerkSessionExchange(exchangeRequest(),exchangeEnv);
 assert.equal(exchanged.status,200);
 assert.equal(inserted,1);
 assert.match(exchanged.headers.get("Set-Cookie")||"",/^__Host-bf_session=/);
 assert.match(exchanged.headers.get("Set-Cookie")||"",/Max-Age=43200;/,
  "Una sesión obtenida de Clerk no puede heredar los 30 días antiguos");
 assert.equal((await exchanged.json()).adminStepUpRequired,false);
 assert.equal((await clerkSessionExchange(exchangeRequest(signed,false),exchangeEnv)).status,403);
 assert.equal((await clerkSessionExchange(exchangeRequest(make({...claims,sub:"user_unknown1234567890"})),exchangeEnv)).status,503);
 assert.equal((await clerkSessionExchange(exchangeRequest(),{...exchangeEnv,CLERK_EXCHANGE_ENABLED:"no"})).status,503);
 // En ningún caso Clerk abre la cookie __Host-bf_admin de step-up.
 const adminDb={prepare(sql){
   if(sql.includes("FROM auth_clerk_links"))return {bind:()=>({first:async()=>({id:member.id,role:"admin"})})};
   if(sql.includes("SELECT role FROM profiles"))return {bind:()=>({first:async()=>({role:"admin"})})};
   if(sql.startsWith("INSERT INTO auth_sessions"))return {bind:()=>({run:async()=>({success:true})})};
   throw Error("SQL no autorizado");
 }};
 const adminExchange=await clerkSessionExchange(exchangeRequest(),{...exchangeEnv,DB:adminDb});
 assert.equal(adminExchange.status,200);
 assert.equal((await adminExchange.json()).adminStepUpRequired,true);
 assert.doesNotMatch(adminExchange.headers.get("Set-Cookie")||"",/__Host-bf_admin/);
 // Reautenticación del panel administrativo: JWT reciente NO prueba MFA.
 // Solo el claim fva firmado con dos factores recientes es suficiente.
 const adminFresh=make({...claims,fva:[0,0]});
 const adminMissingMfa=make({...claims,fva:[0,-1]});
 const adminStale=make({...claims,fva:[0,6]});
 const bfCookie="B".repeat(43);
 const stepRequest=(jwt=adminFresh,cookie=bfCookie)=>
  new Request(origin+"/v1/auth/clerk/admin/step-up",{method:"POST",headers:{
   Origin:origin,"Sec-Fetch-Site":"same-origin",
   Authorization:"Bearer "+jwt,...(cookie?{Cookie:"__Host-bf_session="+cookie}:{})
  }});
 let adminWrites=0,adminDbReads=0;
 const adminStepDb={
  prepare(sql){
   adminDbReads++;
   if(sql.includes("FROM auth_clerk_links"))return {bind:()=>({
    first:async()=>({id:member.id,role:"admin"})})};
   if(sql.includes("FROM auth_sessions s JOIN profiles p"))return {bind:()=>({
    first:async()=>({...member,role:"admin"})})};
   if(sql.includes("SELECT role FROM profiles WHERE id=?"))return {bind:()=>({
    first:async()=>({role:"admin"})})};
   if(sql.startsWith("INSERT INTO auth_sessions")||
      sql.startsWith("INSERT INTO auth_admin_sessions"))
    return {bind:()=>({query:sql})};
   throw Error("Consulta inesperada: ningún cambio de puntos permitido");
  },
  async batch(commands){
   assert.equal(commands.length,2);
   assert.match(commands[0].query,/^INSERT INTO auth_sessions/);
   assert.match(commands[1].query,/^INSERT INTO auth_admin_sessions/);
   adminWrites++;return [];
  }
 };
 const stepEnv={...exchangeEnv,DB:adminStepDb,
  CLERK_ADMIN_STEPUP_ENABLED:"yes"};
 assert.equal((await clerkSessionExchange(stepRequest(),{
  ...stepEnv,CLERK_ADMIN_STEPUP_ENABLED:"no"})).status,503);
 assert.equal((await clerkSessionExchange(stepRequest(adminMissingMfa),stepEnv)).status,403);
 assert.equal((await clerkSessionExchange(stepRequest(adminStale),stepEnv)).status,403);
 assert.equal((await clerkSessionExchange(stepRequest(signed),stepEnv)).status,403);
 assert.equal((await clerkSessionExchange(stepRequest(make({...claims,sts:"pending",fva:[0,0]})),stepEnv)).status,401);
 assert.equal((await clerkSessionExchange(stepRequest(make({...claims,act:{sub:"user_impersonator"},fva:[0,0]})),stepEnv)).status,401);
 assert.equal(adminWrites,0,"Sin verificación MFA no se crean sesiones admin");
 assert.equal((await clerkSessionExchange(stepRequest(adminFresh,null),stepEnv)).status,403);
 assert.equal(adminWrites,0);
 const freshAdmin=await clerkSessionExchange(stepRequest(),stepEnv);
 assert.equal(freshAdmin.status,200);
 assert.equal(adminWrites,1);
 assert.equal((await freshAdmin.json()).stepUp,true);
 const cookies=freshAdmin.headers.get("Set-Cookie")||"";
 assert.match(cookies,/__Host-bf_session=/);
 assert.match(cookies,/__Host-bf_admin=/);
 assert.match(cookies,/Max-Age=7200/);
 const mismatchedDb={...adminStepDb,prepare(sql){
  if(sql.includes("FROM auth_sessions s JOIN profiles p"))return {bind:()=>({
   first:async()=>({...member,role:"admin",id:"22222222-2222-4222-8222-222222222222"})})};
  return adminStepDb.prepare(sql);
 }};
 assert.equal((await clerkSessionExchange(stepRequest(),{...stepEnv,DB:mismatchedDb})).status,403,
  "No conceder privilegios con cookie de otro perfil");
 assert.equal(adminWrites,1);
 assert.ok(adminDbReads>0);
 console.log("OK: Clerk JWT firmado, sesiones pendientes/impersonadas bloqueadas, MFA admin y perfil coincidente.");

}finally{globalThis.fetch=previousFetch;}
