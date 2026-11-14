/**
 * Prueba SIN DNS ni despliegue: el panel debe funcionar detrás de una
 * ruta Cloudflare exclusiva /administracion/* cuando el operador la active.
 * Los archivos públicos de la web seguirán viniendo de GitHub Pages.
 */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const html=readFileSync("cloudflare/qa-candidates/admin-console.html","utf8");
const browser=readFileSync("cloudflare/qa-candidates/admin-console-browser.js","utf8");
const bridge=readFileSync("cloudflare/qa-candidates/supabase-admin-bridge.js","utf8");
const candidate=readFileSync("cloudflare/qa-candidates/bellaquitas-api-staging-admin.js","utf8");
const quota=readFileSync("cloudflare/qa-candidates/free-only-cost-policy.js","utf8");
const origin="https://bellaquitas.fr";

assert.match(html,/<script defer src="\/config\.js"><\/script>/);
assert.match(html,/<script defer src="\/administracion\/app\.js"><\/script>/);
assert.match(html,/<link rel="stylesheet" href="\/administracion\/styles\.css">/);
assert.equal((html.match(/src="\/assets\/logo-navbar\.png"/g)||[]).length,2,
 "Los dos logos deben venir de la web oficial, fuera del Worker");
assert.doesNotMatch(html,/\/espejo\/assets\//,
 "El dominio real no tiene /espejo/assets; rompería imágenes");
assert.match(browser,/const ROOT="\/administracion\/api"/);
assert.match(browser,/location\.origin!=="https:\/\/bellaquitas\.fr"/);
assert.match(bridge,/const CANONICAL_SITE_ORIGIN="https:\/\/bellaquitas\.fr"/);
assert.match(bridge,/sameSiteOrigin\(request,env\)/);
assert.match(quota,/COST_POLICY/);
assert.match(quota,/DENIED_BINDINGS/);
assert.match(quota,/"MEDIA"/);
assert.ok(candidate.includes("adminConsoleRoute(request, env)"),
 "El Worker debe servir los endpoints protegidos del panel");
assert.equal(new URL("/config.js",origin).origin,origin);
assert.equal(new URL("/assets/logo-navbar.png",origin).origin,origin);
console.log("OK: panel, CSS, JS, config y logos usan rutas correctas de bellaquitas.fr");
console.log("OK: API en /administracion/api, sesión solo mismo origen y R2 denegado");
console.log("ESTADO: SOLO CANDIDATO; ruta/DNS no publicados y login real pendiente");
