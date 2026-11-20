#!/usr/bin/env node
/* Clerk + Cloudflare, pruebas 100% sintéticas y sin Internet ni cuentas reales. */
import assert from "node:assert/strict";
import {generateKeyPairSync,createSign} from "node:crypto";
import {readFileSync} from "node:fs";
import {verifyClerkJwt,clerkIdentityRoute} from "./clerk-auth-bridge.js";
const issuer="https://qa.clerk.accounts.dev",origin="https://qa.bellaquitas.test";
const {privateKey,publicKey}=generateKeyPairSync("rsa",{modulusLength:2048,publicExponent:65537});
const jwk={...publicKey.export({format:"jwk"}),kid:"qa-clerk-kid-2026",use:"sig",alg:"RS256"};
let fetches=0,queries=0;
const previousFetch=globalThis.fetch;
globalThis.fetch=async (url)=>{
 assert.equal(url,issuer+"/.well-known/jwks.json","JWKS no puede venir de JWT controlado por el usuario");
 fetches++;
 return new Response(JSON.stringify({keys:[jwk]}),{status:200,headers:{"content-type":"application/json"}});
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
 const good=await verifyClerkJwt(request(),env);
 assert.equal(good.subject,claims.sub);
 const profile=await clerkIdentityRoute(request(),env);
 assert.equal(profile.status,200);const body=await profile.json();
 assert.equal(body.authenticated,true);assert.deepEqual(body.profile,member);
 assert.equal(body.adminSessionAuthorized,false);
 assert.equal(profile.headers.get("Cache-Control"),"no-store");
 assert.equal(profile.headers.get("Set-Cookie"),null);
 assert.ok(fetches===2&&queries===1);
 assert.equal(await clerkIdentityRoute(request(signed,"/v1/events"),env),null);
 assert.equal((await clerkIdentityRoute(request(signed,"/v1/auth/clerk/me","POST"),env)).status,405);
 const disabled={...env,CLERK_JWT_ENABLED:"no"};
 assert.equal((await clerkIdentityRoute(request(),disabled)).status,503);
 for(const modified of [
   {...claims,sub:"user_bad"}, {...claims,azp:"https://evil.test"},
   {...claims,iss:"https://evil.test"}, {...claims,exp:now-1},
   {...claims,nbf:now+120}, {...claims,iat:now+120},
   {...claims,exp:now+4000}, {...claims,sid:"invalid"},
 ]){
  assert.equal(await verifyClerkJwt(request(make(modified)),env),null,
    "Cualquier claim fuera de dominio, identidad o plazo debe rechazarse");
 }
 const fakeSignature=signed.slice(0,-6)+"xxxxxx";
 assert.equal(await verifyClerkJwt(request(fakeSignature),env),null);
 assert.equal(await verifyClerkJwt(request(make(claims,{...header,alg:"none"})),env),null);
 assert.equal(await verifyClerkJwt(request(make(claims,{...header,jku:"https://evil.test/jwks"})),env),null);
 assert.equal(await verifyClerkJwt(request(make(claims,{...header,kid:"unknown-key"})),env),null);
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
 console.log("OK: Clerk JWT RS256, origen/issuer fijos, caducidad, firma/JWKS, vínculo explícito, 0 acceso admin, 0 cambios de cuentas/puntos.");
}finally{globalThis.fetch=previousFetch;}
