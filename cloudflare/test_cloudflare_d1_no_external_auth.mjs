/**
 * Bellaquitas Fest — control de salida del proveedor antiguo.
 * 100 % offline. Falla si el Worker candidato, el panel o el ensamblaje
 * introducen servicios de autenticación externos no autorizados.
 * No solicita credenciales, no toca D1 real ni despliega.
 */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
const qa=p=>readFileSync("cloudflare/qa-candidates/"+p,"utf8");
const worker=qa("bellaquitas-api-staging-admin.js");
const admin=qa("admin-console-routes.js");
const browser=qa("admin-console-browser.js");
const html=qa("admin-console.html");
const auth=qa("auth-routes-admin-proof.js");
const assembler=readFileSync("cloudflare/assemble-admin-candidate.mjs","utf8");
const cost=qa("free-only-cost-policy.js");

test("candidato y ensamblaje sin importaciones externas de identidad",()=>{
 for(const [label,source] of [
  ["worker",worker],["admin",admin],["browser",browser],
  ["html",html],["assembler",assembler]
 ]){
  assert.doesNotMatch(source,/supabase-js|supabase-admin-bridge\.js|verifiedSupabaseAdmin|esm\.sh|supabase\.co/i,label);
 }
 assert.doesNotMatch(assembler,/\["supabase-admin-bridge\.js"/);
 assert.doesNotMatch(html,/src="\/config\.js"/);
 assert.doesNotMatch(browser,/officialToken\s*\(/);
});
test("el panel solo acepta cookie pública Cloudflare-D1 y rol admin actual",()=>{
 assert.match(admin,/const PUBLIC_COOKIE="__Host-bf_session"/);
 assert.match(admin,/const COOKIE="__Host-bf_admin"/);
 assert.match(admin,/auth_method IN \('google','email'\) AND p\.role='admin'/);
 assert.match(admin,/JOIN admin_sso_sessions|JOIN auth_sessions s/);
 assert.match(admin,/const parent=tokenFrom\(request,PUBLIC_COOKIE\)/);
 assert.match(admin,/DELETE FROM admin_sso_sessions WHERE token_hash/);
 assert.match(admin,/SameSite=Strict/);
 assert.match(browser,/response=await api\("\/sso"/);
 assert.doesNotMatch(browser,/Authorization\s*=|\.headers\.Authorization/);
});
test("Google OAuth independiente comprueba token firmado y vinculación por subject",()=>{
 assert.match(auth,/verifyGoogleJwt/);
 assert.match(auth,/RS256/);
 assert.match(auth,/claims\.nonce!==expectedNonce/);
 assert.match(auth,/claims\.aud!==env\.GOOGLE_CLIENT_ID/);
 assert.match(auth,/provider_subject=\?/);
 assert.match(auth,/ALLOW_NEW_ACCOUNTS!=="yes"/);
 assert.match(auth,/const publicHome=base\(env\)==="https:\/\/bellaquitas\.fr"/);
 assert.doesNotMatch(auth,/supabase/);
});
test("política Free-only bloquea R2 y configuración de identidad retirada",()=>{
 assert.match(cost,/DENIED_BINDINGS/);
 assert.match(cost,/"MEDIA"/);
 assert.match(cost,/COST_POLICY!=="free-only"/);
 assert.match(cost,/if\(env\.ADMIN_SUPABASE_BRIDGE==="yes"\)/);
 assert.match(cost,/bloqueada|prohibida|prohibido/i);
});
test("el candidato no activa automáticamente registros ni modifica la web publicada",()=>{
 assert.doesNotMatch(assembler,/wrangler.*deploy|cf\s+deploy|git push|supabase/);
 assert.match(worker,/adminConsoleRoute\(request, env\)/);
 assert.match(html,/\/administracion\/app\.js/);
});
console.log("OK: candidato de Google OAuth + Cloudflare D1 sin backend anterior.");
console.log("Solo comprobaciones estáticas de candidato; sin activar dominio ni cuenta.");
