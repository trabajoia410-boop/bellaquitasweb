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
const stage=await worker.fetch(preflight(),{SITE_MODE:undefined,PUBLISH_APPROVED:"no"});
assert.equal(stage.status,204,"No cambiar el preflight de staging");
console.log("OK: 10 rutas y preflight CORS fail-closed; staging intacto; cero datos, usuarios y credenciales usados.");
