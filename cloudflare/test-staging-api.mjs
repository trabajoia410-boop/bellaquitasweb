/**
 * Pruebas no destructivas de la API Cloudflare Bellaquitas de pruebas.
 * Node.js 18+: node cloudflare/test-staging-api.mjs
 * No prueba ni modifica cuentas, puntos, visitas ni QR.
 */
import assert from "node:assert/strict";

const base = process.env.BELLAQUITAS_STAGING_URL ||
  "https://bellaquitas-api-staging.bellaquitas-fest-410.workers.dev";

async function check(path, expectedStatus = 200, options = {}) {
  const response = await fetch(new URL(path, base), {
    redirect: "error",
    signal: AbortSignal.timeout(10000),
    ...options
  });
  assert.equal(response.status, expectedStatus, `${path} debe devolver ${expectedStatus}`);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  const payload = await response.json();
  console.log(`✓ ${path} — HTTP ${response.status}`);
  return {response, payload};
}

const {payload: health} = await check("/health");
assert.equal(health.status, "ok");
assert.equal(health.database, "connected");
assert.equal(health.storage, "configured");
for (const path of ["/v1/events", "/v1/rewards", "/v1/promos", "/v1/moments"]) {
  const {payload} = await check(path);
  assert.ok(Array.isArray(payload.items), `${path} debe devolver items[]`);
}
const {payload: site} = await check("/v1/site");
assert.ok(site.site && typeof site.site === "object");
await check("/v1/profiles", 404);
await check("/v1/moments/photos/00000000-0000-0000-0000-000000000000", 404);
await check("/v1/events", 405, {method:"POST"});
const {response: cors} = await check("/health", 200, {
  headers: {Origin: "https://bellaquitas.fr"}
});
assert.equal(cors.headers.get("access-control-allow-origin"), "https://bellaquitas.fr");

const emailStatus = await check("/v1/auth/email/status");
assert.equal(emailStatus.payload.login,false,"No activar login email sin configuración y pruebas");
assert.equal(emailStatus.payload.registration,false,"No activar registro email sin correo y Turnstile");
await check("/v1/auth/email/register",405);
await check("/v1/auth/email/verify",405);
for (const path of ["/preview/qr-local.js","/preview/jsqr-local.js","/preview/extras.js","/preview/email.js"]) {
  const response = await fetch(new URL(path,base), {redirect:"error",signal:AbortSignal.timeout(10000)});
  assert.equal(response.status,200, `${path} debe servirse desde el mismo origen`);
  assert.match(response.headers.get("content-type")||"",/javascript/);
  assert.equal(response.headers.get("x-content-type-options"),"nosniff");
  console.log(`✓ ${path} — librería local cargable`);
}

console.log("Todas las comprobaciones no destructivas han terminado correctamente.");

const preview = await fetch(new URL("/preview", base), {redirect:"error"});
assert.equal(preview.status,200);
assert.match(preview.headers.get("content-type")||"",/text\/html/);
assert.match(preview.headers.get("content-security-policy")||"",/script-src 'self'/);
const previewHTML = await preview.text();
assert.match(previewHTML,/\/preview\/app\.js/);
console.log("✓ /preview — interfaz de acceso segura");
const previewScript = await fetch(new URL("/preview/app.js", base));
assert.equal(previewScript.status,200);
assert.match(previewScript.headers.get("content-type")||"",/javascript/);
assert.match(await previewScript.text(),/\/v1\/auth\/logout/);
console.log("✓ /preview/app.js — sesión, perfil, cierre de sesión");
await check("/v1/auth/me", 200);
await check("/v1/auth/logout", 405);
await check("/v1/auth/logout", 403, {method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});
