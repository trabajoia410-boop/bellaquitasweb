#!/usr/bin/env node
import assert from "node:assert/strict";
import {clerkQaPreview} from "./clerk-qa-preview.js";
import worker from "./bellaquitas-api-staging.js";
const domain="qa.clerk.accounts.dev";
const pub="pk_test_"+Buffer.from(domain+"$").toString("base64").replace(/=+$/,"");
const host="https://bellaquitas-api-staging.bellaquitas-fest-410.workers.dev";
const req=(url=host+"/__qa/clerk/",method="GET")=>new Request(url,{method});
const env={SITE_MODE:"staging",CLERK_QA_PREVIEW:"yes",CLERK_JWT_ENABLED:"yes",
 CLERK_ISSUER:"https://"+domain,CLERK_PUBLISHABLE_KEY:pub};
assert.equal(clerkQaPreview(req(host+"/v1/events"),env),null);
for(const changed of [
 {...env,CLERK_QA_PREVIEW:"no"},{...env,CLERK_JWT_ENABLED:"no"},
 {...env,SITE_MODE:"production"},{...env,SITE_MODE:"preproduction"}
]){
 const r=clerkQaPreview(req(),changed);assert.equal(r.status,404);
 assert.equal(r.headers.get("Set-Cookie"),null);
}
assert.equal(clerkQaPreview(req("https://bellaquitas.fr/__qa/clerk/"),env).status,404);
assert.equal(clerkQaPreview(req(),{...env,CLERK_ISSUER:"https://evil.example"}).status,503);
assert.equal(clerkQaPreview(req(),{...env,CLERK_PUBLISHABLE_KEY:"invalid"}).status,503);
assert.equal(clerkQaPreview(req(host+"/__qa/clerk/","POST"),env).status,405);
const response=clerkQaPreview(req(),env);
assert.equal(response.status,200);
const html=await response.text();
assert.match(html,/data-clerk-publishable-key=/);
assert.match(html,/@clerk\/ui@1\/dist\/ui\.browser\.js/);
assert.match(html,/@clerk\/clerk-js@6\/dist\/clerk\.browser\.js/);
assert.match(html,/mountSignIn/);
assert.match(html,/Authorization:"Bearer "\+token/);
assert.doesNotMatch(html,/secret_key|sk_test_|passwordHash|600000|role=["']admin["']/);
assert.match(response.headers.get("Content-Security-Policy")||"",/base-uri 'none'/);
assert.equal(response.headers.get("Set-Cookie"),null);
const privateRes=await worker.fetch(req("https://bellaquitas.fr/__qa/clerk/"),{...env,SITE_MODE:"preproduction"});
assert.equal(privateRes.status,503,"No habilitar dominio real desde QA");
console.log("PASS: ClerkJS QA con triple opt-in, CSP, sin panel, sin cookies ni acceso a producción.");
