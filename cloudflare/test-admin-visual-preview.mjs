/**
 * Smoke HTTP de vista visual externa.
 * Solo GET y POST falsos SIN credenciales; no accede a datos ni los modifica.
 * Node.js 22 o superior.
 */
import assert from "node:assert/strict";
const base=process.env.BELLAQUITAS_ADMIN_VISUAL_URL||
 "https://bellaquitas-admin-visual-preview.bellaquitas-fest-410.workers.dev";
const req=async(path,method="GET")=>fetch(new URL(path,base),{
 method,redirect:"manual",signal:AbortSignal.timeout(15000),
 headers:{"Accept":"application/json,text/html","Cache-Control":"no-store"}
});
const home=await req("/");
assert.equal(home.status,302);
assert.equal(new URL(home.headers.get("location")).pathname,"/administracion/");
const page=await req("/administracion/");
assert.equal(page.status,200);
assert.match(page.headers.get("content-type")||"",/text\/html/);
assert.match(page.headers.get("content-security-policy")||"",/script-src 'nonce-/);
assert.match(page.headers.get("x-robots-tag")||"",/noindex/);
const html=await page.text();
assert.ok(html.includes('id="loginForm"'));
assert.ok(html.includes("Panel de administrador"));
assert.ok(!html.includes("supabase.co"),"La vista aislada no debe incluir Supabase");
const status=await req("/v1/auth/email/status");
assert.equal(status.status,200);
const enabled=await status.json();
assert.equal(enabled.login,false);
assert.equal(enabled.registration,false);
const me=await req("/v1/auth/me");
assert.equal(me.status,200);
assert.deepEqual((await me.json()).authenticated,false);
const admin=await req("/v1/admin/session");
assert.equal(admin.status,401);
assert.equal((await admin.json()).authorized,false);
const google=await req("/v1/auth/google/start?return=admin");
assert.equal(google.status,503);
const email=await req("/v1/auth/email/login","POST");
assert.equal(email.status,503);
for(const response of [home,page,status,me,admin,google,email])
 assert.equal(response.headers.get("set-cookie"),null,"La vista no debe crear sesiones");
console.log("OK: HTML renderizado, CSP, ninguna autenticación real y sin cookies. No se alteraron datos.");
