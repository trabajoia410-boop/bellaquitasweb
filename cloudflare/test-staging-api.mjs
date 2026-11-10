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
console.log("Todas las comprobaciones no destructivas han terminado correctamente.");
