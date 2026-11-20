#!/usr/bin/env node
/** CI offline: no usuarios reales, no red, sin claves de Cloudflare.
 * Demuestra que la migración NO publica con OAuth o correo incompletos.
 */
import assert from "node:assert/strict";
import {productionConfigurationReady,productionAccessGate} from "./production-auth-readiness.js";
import {googleLanding,emailLink} from "./production-auth-redirects.js";

const origin="https://bellaquitas.fr", token="A".repeat(43);
const ok={
 SITE_MODE:"production",
 PUBLISH_APPROVED:"yes",
 FINAL_ORIGIN_RECONCILED:"yes",
 BACKUP_KEY_CUSTODIED:"yes",
 FREE_TIER_BILLING_VERIFIED:"yes",
 FREE_TIER_CPU_VERIFIED:"yes",
 PUBLIC_ORIGIN:origin,
 TURNSTILE_EXPECTED_HOSTNAME:"bellaquitas.fr",
 STAGING_MUTATIONS:"enabled",
 ALLOW_NEW_ACCOUNTS:"yes",
 EMAIL_AUTH_ENABLED:"no",
 EMAIL_REGISTRATION_ENABLED:"no",
 CLERK_JWT_ENABLED:"yes",
 CLERK_EXCHANGE_ENABLED:"yes",
 CLERK_ADMIN_STEPUP_ENABLED:"yes",
 CLERK_ISSUER:"https://clerk.bellaquitas.fr",
 CLERK_ALLOWED_ORIGIN:origin,
 ADMIN_EMAIL_LINK_ENABLED:"no",
 SUGGESTIONS_ENABLED:"yes",
 DB:{prepare(){}},
 ASSETS:{fetch(){}},
 GOOGLE_CLIENT_ID:"fake-google-client-id",
 GOOGLE_CLIENT_SECRET:"fake-google-client-secret",
 EMAIL_RATE_KEY:"x".repeat(48),
 RESEND_API_KEY:"fake-resend-key",
 RESEND_FROM:"no-reply@bellaquitas.fr",
 TURNSTILE_SECRET:"fake-turnstile-secret",
 TURNSTILE_SITE_KEY:"fake-site-key"
};
const req=(url=origin+"/",method="GET")=>new Request(url,{method});
assert.equal(productionConfigurationReady(ok),true);
assert.equal(productionAccessGate(req(),ok),null);
assert.equal(ok.EMAIL_AUTH_ENABLED,"no",
 "La publicación Clerk NO debe activar PBKDF2 heredada de 600.000 iteraciones");
assert.equal(ok.EMAIL_REGISTRATION_ENABLED,"no",
 "El registro se hará en Clerk y nunca duplicando socios en D1");
// Variante segura para reutilizar Google y Resend ya configurados en
// otro Worker del mismo propietario SIN importar sus secretos.
const bridged={
 ...ok,GOOGLE_CLIENT_ID:"",GOOGLE_CLIENT_SECRET:"",RESEND_API_KEY:"",
 PROVIDER_BROKER_ENABLED:"yes",PROVIDER_BROKER_KEY:"z".repeat(64),
 PROVIDER_BROKER:{fetch(){}}
};
assert.equal(productionConfigurationReady(bridged),true,
 "Service Binding firmada reemplaza solo las credenciales de proveedores");
for(const [key,bad] of [
 ["PROVIDER_BROKER_ENABLED","no"],
 ["PROVIDER_BROKER_KEY",""],
 ["PROVIDER_BROKER",null],
 ["FINAL_ORIGIN_RECONCILED","no"],
 ["BACKUP_KEY_CUSTODIED","no"],
 ["FREE_TIER_BILLING_VERIFIED","no"],
 ["FREE_TIER_CPU_VERIFIED","no"]
]){
 const altered={...bridged,[key]:bad};
 assert.equal(productionConfigurationReady(altered),false,
  "Fallar cerrado cuando falta "+key);
 assert.equal(productionAccessGate(req(),altered)?.status,503);
}

for(const [key,bad] of [
 ["PUBLIC_ORIGIN","https://example.invalid"],
 ["GOOGLE_CLIENT_ID",""],
 ["GOOGLE_CLIENT_SECRET",""],
 ["EMAIL_RATE_KEY","x"],
 ["RESEND_API_KEY",""],
 ["RESEND_FROM","not-an-email"],
 ["TURNSTILE_SECRET",""],
 ["TURNSTILE_SITE_KEY",""],
 ["STAGING_MUTATIONS","disabled"],
 ["ALLOW_NEW_ACCOUNTS","no"],
 ["EMAIL_AUTH_ENABLED","yes"],
 ["EMAIL_REGISTRATION_ENABLED","yes"],
 ["CLERK_JWT_ENABLED","no"],
 ["CLERK_EXCHANGE_ENABLED","no"],
 ["CLERK_ADMIN_STEPUP_ENABLED","no"],
 ["CLERK_ISSUER","https://qa.clerk.accounts.dev"],
 ["CLERK_ALLOWED_ORIGIN","https://wrong.invalid"],
 ["ADMIN_EMAIL_LINK_ENABLED","yes"],
 ["SUGGESTIONS_ENABLED","no"],
 ["SITE_MODE","unknown"],
 ["PUBLISH_APPROVED","no"],
 ["FINAL_ORIGIN_RECONCILED","no"],
 ["BACKUP_KEY_CUSTODIED","no"],
 ["FREE_TIER_BILLING_VERIFIED","no"],
 ["FREE_TIER_CPU_VERIFIED","no"],
 ["TURNSTILE_EXPECTED_HOSTNAME","example.invalid"],
 ["DB",null],
 ["ASSETS",null]
]){
 const changed={...ok,[key]:bad};
 assert.equal(productionConfigurationReady(changed),false,"Bloquear "+key);
 const result=productionAccessGate(req(),changed);
 assert.equal(result?.status,503,"Sin "+key+" NO publicar portada ni API");
 const message=await result.text();
 assert.equal(message.includes(key),false,"No exponer nombre de secreto faltante");
 assert.equal(result.headers.get("Cache-Control"),"no-store");
}
assert.equal(productionAccessGate(req("http://bellaquitas.fr/"),ok).status,403);
assert.equal(productionAccessGate(req("https://example.com/"),ok).status,403);
assert.equal(productionAccessGate(req("https://www.bellaquitas.fr/v1/auth/me?x=1"),ok).status,308);
assert.equal(productionAccessGate(req("https://www.bellaquitas.fr/v1/auth/me?x=1"),ok).headers.get("Location"),
 origin+"/v1/auth/me?x=1");
assert.equal(productionAccessGate(req("https://www.bellaquitas.fr/v1/auth/logout","POST"),ok).status,403);
const privateResponse=productionAccessGate(req(),{...ok,SITE_MODE:"preproduction"});
assert.equal(privateResponse.status,503,'Preproducción cerrada incluso con credenciales sintéticas');
assert.equal(privateResponse.headers.get('X-Robots-Tag'),'noindex,nofollow');
// Un DNS apuntado accidentalmente al Worker con SITE_MODE ausente
// NUNCA puede servir el backend antiguo de staging desde el dominio final.
for(const mode of [undefined,"staging","invalid","preproduction"]){
 for(const host of ["bellaquitas.fr","www.bellaquitas.fr","bellaquitas.fr.","www.bellaquitas.fr."]){
   const result=productionAccessGate(req("https://"+host+"/v1/auth/me"),{...ok,SITE_MODE:mode});
   assert.equal(result?.status,503,"Modo "+mode+" en "+host+" debe cerrar API");
   assert.equal(result.headers.get("Access-Control-Allow-Origin"),null);
   assert.equal(result.headers.get("Set-Cookie"),null);
 }
}
assert.equal(productionAccessGate(
 req("https://bellaquitas-api-staging.bellaquitas-fest-410.workers.dev/"),
 {...ok,SITE_MODE:undefined}),null,
 "Staging real debe conservarse funcional fuera del dominio canónico");

// Google nunca debe volver al /preview cerrado tras el cambio de dominio.
assert.equal(googleLanding("P"+token.slice(1),ok),"/#/mi-espacio");
assert.equal(googleLanding("M"+token.slice(1),ok),"/#/mi-espacio");
assert.equal(googleLanding("A"+token.slice(1),ok),"/administracion/");
assert.equal(googleLanding("P"+token.slice(1),{SITE_MODE:"preproduction"}),"/preview");
assert.equal(googleLanding("M"+token.slice(1),{SITE_MODE:"preproduction"}),"/espejo/#/mi-espacio");

for(const purpose of ["verify","reset"]){
 const expected=purpose==="verify"?origin+"/?verify="+token+"#/acceso":
    origin+"/?reset_token="+token+"#/restablecer";
 assert.equal(emailLink(origin,token,purpose,undefined,ok),expected);
 assert.equal(emailLink(origin,token,purpose,"espejo",ok),expected,
  "Parámetro heredado no puede enviar emails al staging");
 const url=new URL(expected);
 assert.equal(url.origin,origin);
 assert.ok(!url.pathname.includes("preview"));
 assert.equal(new URLSearchParams(url.search).get(purpose==="verify"?"verify":"reset_token"),token);
}
assert.equal(emailLink(origin,token,"verify","espejo",{SITE_MODE:"preproduction"}),
 origin+"/espejo/?verify="+token+"#/acceso");
assert.equal(emailLink(origin,token,"verify",undefined,{SITE_MODE:"preproduction"}),
 origin+"/preview#verify="+token);
assert.equal(emailLink(origin,token,"reset",undefined,{SITE_MODE:"preproduction"}),
 origin+"/preview#reset="+token);
assert.throws(()=>emailLink(origin,"invalid","reset","",ok));
console.log("PASS: OAuth, correo, origen y custodia; 20 condiciones de protección y URLs canónicas sin usuarios ni secretos reales.");
