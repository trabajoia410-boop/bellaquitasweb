#!/usr/bin/env node
import assert from "node:assert/strict";
import worker from "./bellaquitas-api-staging.js";
import {authRoute} from "./auth-routes.js";
import {emailAuthRoute} from "./email-auth-routes.js";
// Never use real credentials, D1, cookies, emails or writable APIs.
const base="https://bellaquitas.fr";
const guarded={SITE_MODE:"production",CLERK_JWT_ENABLED:"yes",EMAIL_AUTH_ENABLED:"no",EMAIL_REGISTRATION_ENABLED:"no",ADMIN_EMAIL_LINK_ENABLED:"no",ALLOW_NEW_ACCOUNTS:"yes"};
const forbidden=["/v1/auth/google/start","/v1/auth/google/callback"];
for(const path of forbidden) {
 const r=await authRoute(new Request(base+path,{method:"GET"}),guarded);
 assert.equal(r.status,410,path+" cannot create a legacy session");
 assert.equal(r.headers.get("Set-Cookie"),null);
}
const emailLegacy=["/v1/auth/email/register","/v1/auth/email/login","/v1/auth/email/forgot","/v1/auth/email/reset","/v1/auth/email/verify",
 "/v1/auth/admin/email/link/start","/v1/auth/admin/email/link/confirm"];
for(const path of emailLegacy){
 const response=await emailAuthRoute(new Request(base+path,{method:"POST",headers:{"Origin":base,"Content-Type":"application/json"},body:"{}"}),guarded);
 assert.equal(response.status,410,path+" legacy KDF must not execute");
 assert.equal(response.headers.get("Set-Cookie"),null);
}
const status=await emailAuthRoute(new Request(base+"/v1/auth/email/status"),guarded);
assert.equal(status.status,200);
assert.deepEqual(await status.json(),{login:false,registration:false,adminLink:false,turnstileSiteKey:null});
const unsafe={...guarded,ADMIN_EMAIL_LINK_ENABLED:"yes",EMAIL_AUTH_ENABLED:"yes",EMAIL_REGISTRATION_ENABLED:"yes"};
for(const path of [...forbidden,...emailLegacy]){
 const request=new Request(base+path,{method:path.startsWith("/v1/auth/google")?"GET":"POST",
  ...(path.startsWith("/v1/auth/google")?{}:{headers:{"Origin":base},body:"{}"})});
 const response=path.startsWith("/v1/auth/google")?await authRoute(request,unsafe):await emailAuthRoute(request,unsafe);
 assert.equal(response.status,410,"Production must not re-enable legacy auth even if flags mistakenly flip");
}
const blocked=await worker.fetch(new Request(base+"/v1/auth/email/login",{method:"POST",headers:{"Origin":base},body:"{}"}),guarded);
assert.equal(blocked.status,503,"Production fails closed before all other checks");
console.log("OK: Clerk-only mode prevents 2 legacy Google, 7 email/admin-link endpoints even with unsafe flags; no CPU-heavy KDF or cookies.");
