#!/usr/bin/env node
import assert from "node:assert/strict";
import {studioSandboxRoute} from "./studio-sandbox.js";
const origin="https://bellaquitas-api-staging.bellaquitas-fest-410.workers.dev";
const good={SITE_MODE:"staging",STAGING_MUTATIONS:"disabled",ALLOW_NEW_ACCOUNTS:"no"};
const req=(url=origin+"/laboratorio/",method="GET")=>new Request(url,{method});
const ok=studioSandboxRoute(req(),good);
assert.equal(ok.status,200);
const html=await ok.text();
assert.match(html,/Laboratorio visual|Laboratorio</);
assert.match(html,/id="site"/);
assert.match(html,/admin_embed=1#\//);
assert.match(html,/Guardar borrador local/);
assert.match(html,/data-page="\/eventos"/);
assert.match(html,/data-theme="minimal"/);
assert.match(html,/localStorage\.setItem\(KEY,json\)/);
assert.match(html,/event\.target\?\.nodeType===1/,
 "Cross-frame click-to-edit must work even when Element constructors differ");
assert.doesNotMatch(html,/auth_sessions|auth_clerk_links|passwordHash\(/);
assert.equal(ok.headers.get("X-Frame-Options"),"DENY");
assert.match(ok.headers.get("Content-Security-Policy"),/frame-src 'self'/);
assert.match(ok.headers.get("Content-Security-Policy"),/connect-src 'none'/);
assert.equal(ok.headers.get("Set-Cookie"),null);
for(const invalid of [
 {...good,STAGING_MUTATIONS:"enabled"},
 {...good,ALLOW_NEW_ACCOUNTS:"yes"},
 {...good,SITE_MODE:"production"},
 {...good,SITE_MODE:"preproduction"},
])assert.equal(studioSandboxRoute(req(),invalid).status,503);
assert.equal(studioSandboxRoute(req("https://bellaquitas.fr/laboratorio/"),good).status,503);
assert.equal(studioSandboxRoute(req(origin+"/laboratorio/","POST"),good).status,405);
assert.equal(studioSandboxRoute(req(origin+"/laboratorio/","HEAD"),good).status,200);
console.log("OK: laboratorio visual solo staging read-only, guardado local sin D1/auth, ruta production bloqueada, iframe y CSP.");
