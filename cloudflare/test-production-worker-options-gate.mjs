#!/usr/bin/env node
/**
 * Bellaquitas Fest — test del Worker real (no solo funciones aisladas).
 * Ningún preflight CORS debe responder éxito si se activa producción sin
 * la aprobación/credenciales necesarias. No conecta D1 ni OAuth.
 */
import assert from "node:assert/strict";
import worker from "./bellaquitas-api-staging.js";

const DOMAIN="https://bellaquitas.fr";
const preflight=(url=DOMAIN+"/v1/auth/email/login")=>new Request(url,{
 method:"OPTIONS",
 headers:{"Origin":DOMAIN,"Access-Control-Request-Method":"POST",
 "Access-Control-Request-Headers":"Content-Type"}
});
const noSecrets={SITE_MODE:"production",PUBLISH_APPROVED:"no"};
for(const path of ["/","/v1/auth/email/login","/v1/auth/google/start","/v1/admin/member","/administracion/"]){
 const url=DOMAIN+path;
 for(const method of ["GET","OPTIONS"]){
  const response=await worker.fetch(method==="OPTIONS"?preflight(url):new Request(url),noSecrets);
  assert.equal(response.status,503,"El Worker no puede revelar rutas mientras la publicación no esté autorizada");
  assert.equal(response.headers.get("Cache-Control"),"no-store");
  assert.equal(response.headers.get("Access-Control-Allow-Origin"),null,
    "No conceder CORS cuando falta autorización de producción");
  assert.equal(response.headers.get("Set-Cookie"),null);
 }
}
const withFakeSecrets={SITE_MODE:"production",PUBLISH_APPROVED:"yes",FINAL_ORIGIN_RECONCILED:"no",BACKUP_KEY_CUSTODIED:"no"};
assert.equal((await worker.fetch(preflight(),withFakeSecrets)).status,503,
 "Sin conciliación y clave bajo custodia, incluso una aprobación no habilita CORS");
const noApproval=await worker.fetch(preflight(),{SITE_MODE:"production",PUBLISH_APPROVED:"yes"});
assert.equal(noApproval.status,503,"Una aprobación sin claves completas también debe bloquear");

for(const path of ["/","/v1/auth/me","/administracion/","/v1/events"]){
 for(const method of ["GET","OPTIONS"]){
  const request=method==="OPTIONS"?preflight(DOMAIN+path):new Request(DOMAIN+path);
  const response=await worker.fetch(request,{SITE_MODE:"preproduction",PUBLISH_APPROVED:"no"});
  assert.equal(response.status,503,"No exponer el Worker privado por accidente");
  assert.equal(response.headers.get("Access-Control-Allow-Origin"),null);
  assert.equal(response.headers.get("X-Robots-Tag"),"noindex,nofollow");
 }
}
const safeProduction={
 SITE_MODE:"production",PUBLISH_APPROVED:"yes",
 FINAL_ORIGIN_RECONCILED:"yes",BACKUP_KEY_CUSTODIED:"yes",
 PUBLIC_ORIGIN:DOMAIN,TURNSTILE_EXPECTED_HOSTNAME:"bellaquitas.fr",
 STAGING_MUTATIONS:"enabled",ALLOW_NEW_ACCOUNTS:"yes",
 EMAIL_AUTH_ENABLED:"yes",EMAIL_REGISTRATION_ENABLED:"yes",
 ADMIN_EMAIL_LINK_ENABLED:"yes",SUGGESTIONS_ENABLED:"yes",
 DB:{prepare(){}},ASSETS:{fetch(){}},
 GOOGLE_CLIENT_ID:"fake-google-client-id",GOOGLE_CLIENT_SECRET:"fake-google-client-secret",
 EMAIL_RATE_KEY:"x".repeat(48),RESEND_API_KEY:"fake-resend-key",
 RESEND_FROM:"no-reply@bellaquitas.fr",
 TURNSTILE_SECRET:"fake-turnstile-secret",TURNSTILE_SITE_KEY:"fake-site-key"
};
// La API final no autoriza al origen GitHub Pages ni a www a
// inspeccionar respuestas con CORS; staging conserva esas excepciones.
for(const origin of ["https://trabajoia410-boop.github.io","https://www.bellaquitas.fr","https://example.invalid"]){
 const r=await worker.fetch(new Request(DOMAIN+"/v1/events",{
   method:"OPTIONS",headers:{"Origin":origin,
     "Access-Control-Request-Method":"GET"}
 }),safeProduction);
 assert.equal(r.status,204);
 assert.equal(r.headers.get("Access-Control-Allow-Origin"),null,
  "Producción no debe reutilizar CORS de "+origin);
 assert.equal(r.headers.get("Vary"),"Origin");
}
const canonical=await worker.fetch(new Request(DOMAIN+"/v1/events",{
 method:"OPTIONS",headers:{"Origin":DOMAIN,"Access-Control-Request-Method":"GET"}
}),safeProduction);
assert.equal(canonical.status,204);
assert.equal(canonical.headers.get("Access-Control-Allow-Origin"),DOMAIN);
const legacyStaging=await worker.fetch(new Request(
 "https://bellaquitas-api-staging.bellaquitas-fest-410.workers.dev/v1/events",{
 method:"OPTIONS",headers:{"Origin":"https://trabajoia410-boop.github.io",
 "Access-Control-Request-Method":"GET"}
}),{SITE_MODE:undefined,PUBLISH_APPROVED:"no"});
assert.equal(legacyStaging.status,204);
assert.equal(legacyStaging.headers.get("Access-Control-Allow-Origin"),
 "https://trabajoia410-boop.github.io","Staging debe mantener integración heredada");
// Si el DNS definitivo se conectara por error a un Worker que todavía
// carga configuración staging, responder 503 en TODAS las rutas/métodos.
for(const host of [DOMAIN,"https://www.bellaquitas.fr","https://bellaquitas.fr.","https://www.bellaquitas.fr."]){
 for(const mode of [undefined,"staging","invalid"]){
  for(const pathname of ["/","/administracion/","/v1/auth/me","/v1/events"]){
   for(const method of ["GET","OPTIONS"]){
    const url=host+pathname;
    const request=method==="OPTIONS"?preflight(url):new Request(url);
    const result=await worker.fetch(request,{SITE_MODE:mode,PUBLISH_APPROVED:"no"});
    assert.equal(result.status,503,"No exponer "+host+pathname+" en "+mode);
    assert.equal(result.headers.get("Access-Control-Allow-Origin"),null);
    assert.equal(result.headers.get("Set-Cookie"),null);
    assert.equal(result.headers.get("Cache-Control"),"no-store");
   }
  }
 }
}
const stageUrl="https://bellaquitas-api-staging.bellaquitas-fest-410.workers.dev/v1/auth/email/login";
const stage=await worker.fetch(preflight(stageUrl),{SITE_MODE:undefined,PUBLISH_APPROVED:"no"});
assert.equal(stage.status,204,"No cambiar el preflight de staging");
assert.equal(stage.headers.get("Access-Control-Allow-Origin"),DOMAIN);
console.log("OK: 10 rutas, preflight fail-closed y CORS canónico final; staging sigue intacto; sin datos ni cuentas reales.");
