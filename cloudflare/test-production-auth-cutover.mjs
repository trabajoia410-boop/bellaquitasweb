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
 PUBLIC_ORIGIN:origin,
 TURNSTILE_EXPECTED_HOSTNAME:"bellaquitas.fr",
 STAGING_MUTATIONS:"enabled",
 ALLOW_NEW_ACCOUNTS:"yes",
 EMAIL_AUTH_ENABLED:"yes",
 EMAIL_REGISTRATION_ENABLED:"yes",
 ADMIN_EMAIL_LINK_ENABLED:"yes",
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
 ["EMAIL_AUTH_ENABLED","no"],
 ["EMAIL_REGISTRATION_ENABLED","no"],
 ["ADMIN_EMAIL_LINK_ENABLED","no"],
 ["SUGGESTIONS_ENABLED","no"],
 ["SITE_MODE","unknown"],
 ["PUBLISH_APPROVED","no"],
 ["TURNSTILE_EXPECTED_HOSTNAME","example.invalid"],
 ["DB",null],
 ["ASSETS",null]
]){
 const changed={...ok,[key]:bad};
 assert.equal(productionConfigurationReady(changed),false,"Bloquear "+key);
 const result=productionAccessGate(req(),changed);
 if(changed.SITE_MODE==="production"){
   assert.equal(result.status,503,"Sin "+key+" NO publicar portada ni API");
   const message=await result.text();
   assert.equal(message.includes(key),false,"No exponer nombre de secreto faltante");
   assert.equal(result.headers.get("Cache-Control"),"no-store");
 }else{
   assert.equal(result,null,"Staging no puede activarse por accidente");
 }
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
assert.equal(productionAccessGate(req(),{...ok,SITE_MODE:undefined}),null);

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
console.log("PASS: OAuth, correo y admin finales; 18 condiciones de protección y URLs canónicas, 0 credenciales/usuarios reales.");
