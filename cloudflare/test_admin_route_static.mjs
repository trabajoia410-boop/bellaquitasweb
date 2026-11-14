/**
 * Prueba SIN DNS ni despliegue: el panel debe funcionar detrás de una
 * ruta Cloudflare exclusiva /administracion/* cuando el operador la active.
 * Los archivos públicos de la web seguirán viniendo de GitHub Pages.
 */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const html=readFileSync("cloudflare/qa-candidates/admin-console.html","utf8");
const browser=readFileSync("cloudflare/qa-candidates/admin-console-browser.js","utf8");
const auth=readFileSync("cloudflare/qa-candidates/auth-routes-admin-proof.js","utf8");
const admin=readFileSync("cloudflare/qa-candidates/admin-console-routes.js","utf8");
const candidate=readFileSync("cloudflare/qa-candidates/bellaquitas-api-staging-admin.js","utf8");
const quota=readFileSync("cloudflare/qa-candidates/free-only-cost-policy.js","utf8");
const origin="https://bellaquitas.fr";

assert.doesNotMatch(html,/src="\/config\.js"/,
 "El panel ya no carga la configuración del backend anterior");
assert.match(html,/<script defer src="\/administracion\/app\.js"><\/script>/);
assert.match(html,/<link rel="stylesheet" href="\/administracion\/styles\.css">/);
assert.equal((html.match(/src="\/assets\/logo-navbar\.png"/g)||[]).length,2,
 "Los dos logos deben venir de la web oficial, fuera del Worker");
assert.doesNotMatch(html,/\/espejo\/assets\//,
 "El dominio real no tiene /espejo/assets; rompería imágenes");
assert.match(browser,/const ROOT="\/administracion\/api"/);
assert.doesNotMatch(browser,/supabase|officialToken|esm\.sh/i);
assert.doesNotMatch(admin,/verifiedSupabaseAdmin|bridgeEnabled|esm\.sh/i);
assert.match(admin,/const PUBLIC_COOKIE="__Host-bf_session"/);
assert.match(admin,/sessionCookie\(raw\)/);
assert.match(auth,/verifyGoogleJwt/);
assert.match(auth,/auth_identity_links/);
assert.doesNotMatch(html,/supabase|esm\.sh/i);
assert.match(quota,/COST_POLICY/);
assert.match(quota,/DENIED_BINDINGS/);
assert.match(quota,/"MEDIA"/);
assert.ok(candidate.includes("adminConsoleRoute(request, env)"),
 "El Worker debe servir los endpoints protegidos del panel");
assert.equal(new URL("/config.js",origin).origin,origin);
assert.equal(new URL("/assets/logo-navbar.png",origin).origin,origin);
console.log("OK: panel CSS/JS y logos usan rutas del dominio propio; sin terceros");
console.log("OK: API /administracion/api, sesiones Google-D1 y R2 inaccesible");
console.log("ESTADO: SOLO CANDIDATO; ruta/DNS no publicados y login real pendiente");
