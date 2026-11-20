// Ejecutar: node --test cloudflare/test-clerk-auth.mjs
// No usa la red ni modifica cuentas reales.
import { readFile } from "node:fs/promises";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, createSign, webcrypto } from "node:crypto";

globalThis.crypto ||= webcrypto;
const bridgeText = await readFile(new URL("./clerk-auth-bridge.js", import.meta.url), "utf8");
const bridge = await import("data:text/javascript;base64," +
  Buffer.from(bridgeText).toString("base64"));

const origin = "https://bellaquitas-api-staging.bellaquitas-fest-410.workers.dev";
const issuer = "https://rapid-iguana-1234.clerk.accounts.dev";
const env = {
  SITE_MODE: "staging",
  CLERK_JWT_ENABLED: "yes",
  CLERK_ISSUER: issuer,
  CLERK_ALLOWED_ORIGIN: origin
};
const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...keys.publicKey.export({ format: "jwk" }),
  kid: "testkid_123456", use: "sig", alg: "RS256" };
const originalFetch = globalThis.fetch;
let requestCount = 0;
globalThis.fetch = async url => {
  assert.equal(url, issuer + "/.well-known/jwks.json");
  requestCount++;
  return new Response(JSON.stringify({ keys: [jwk] }), { status: 200 });
};
after(() => { globalThis.fetch = originalFetch; });
const encode = v => Buffer.from(typeof v === "string" ? v : JSON.stringify(v))
  .toString("base64url");
function makeToken(overrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT", kid: jwk.kid };
  const claims = {
    iss: issuer, azp: origin,
    sub: "user_abcdefghijklmnopqrstuvwxyz123456",
    sid: "sess_abcdefghijklmnopqrstuvwxyz123456",
    iat: now - 5, nbf: now - 5, exp: now + 180,
    ...overrides
  };
  const unsigned = encode(header) + "." + encode(claims);
  const signature = createSign("RSA-SHA256").update(unsigned)
    .sign(keys.privateKey).toString("base64url");
  return unsigned + "." + signature;
}
const req = (token, method = "GET") =>
  new Request(origin + "/v1/auth/clerk/me", {
    method, headers: token ? { Authorization: "Bearer " + token } : {}
  });

test("Clerk permanece desactivado por defecto", async () => {
  const r = await bridge.clerkReadOnlyRoute(req(makeToken()),
    { ...env, CLERK_JWT_ENABLED: "no" });
  assert.equal(r.status, 503);
});

test("Sin token o token malformado: 401 y sin consulta D1", async () => {
  let usedDb = false;
  const fakeDb = { prepare() { usedDb = true; throw Error("unexpected"); } };
  assert.equal((await bridge.clerkReadOnlyRoute(req(), { ...env, DB: fakeDb })).status, 401);
  assert.equal((await bridge.clerkReadOnlyRoute(req("a.b.c"), { ...env, DB: fakeDb })).status, 401);
  assert.equal(usedDb, false);
});

test("JWT expirado, origen alterado y firma alterada: rechazados", async () => {
  const expired = makeToken({ exp: Math.floor(Date.now() / 1000) - 1 });
  const alien = makeToken({ azp: "https://example.org" });
  const token = makeToken();
  const modified = token.slice(0, -2) + "zz";
  for (const candidate of [expired, alien, modified]) {
    const r = await bridge.clerkReadOnlyRoute(req(candidate), env);
    assert.equal(r.status, 401);
  }
});

test("JWT firmado sin vinculación verificada: 403, no crea usuario", async () => {
  let writes = 0;
  const fakeDb = { prepare(sql) {
    assert.match(sql, /link_method='migration_confirmed'/);
    return { bind(id) {
      assert.match(id, /^user_/);
      return { async first() { return null; } };
    } };
  } };
  const r = await bridge.clerkReadOnlyRoute(req(makeToken()),
    { ...env, DB: fakeDb });
  assert.equal(r.status, 403);
  assert.equal(writes, 0);
});

test("JWT válido y vínculo confirmado: lectura del perfil sin permiso admin", async () => {
  const profile = {
    id: "profile-test", name: "Prueba", role: "admin",
    member_code: "QA-001", points: 25, lifetime_points: 25, visits: 0
  };
  const fakeDb = { prepare(sql) {
    assert.match(sql, /auth_clerk_links/);
    return { bind() { return { async first() { return profile; } }; } };
  } };
  const r = await bridge.clerkReadOnlyRoute(req(makeToken()),
    { ...env, DB: fakeDb });
  assert.equal(r.status, 200);
  const data = await r.json();
  assert.deepEqual(data.profile, profile);
  assert.equal(data.adminSessionAuthorized, false);
  assert.ok(requestCount >= 1);
});


test("Claims de Clerk fuera de confianza: el Worker falla cerrado", async () => {
  const now = Math.floor(Date.now() / 1000);
  const attempts = [
    { iss: "https://another-clerk.example" },
    { azp: "https://bellaquitas.fr" },
    { nbf: now + 120 },
    { iat: now + 120 },
    { exp: now + 5000 },
    { sub: "invalid-subject" },
    { sid: "invalid-session" },
    { nbf: "not-a-timestamp" },
    { exp: now - 1 },
  ];
  for (const claims of attempts) {
    const r = await bridge.clerkReadOnlyRoute(req(makeToken(claims)), env);
    assert.equal(r.status, 401, "Debe rechazarse " + Object.keys(claims).join(","));
  }
});

test("JWKS inaccesible o sin clave aceptable: ningún token autorizado", async () => {
  const token = makeToken();
  const fail = await bridge.verifyClerkToken(req(token), env, async () => {
    throw new Error("La clave no está disponible");
  });
  assert.equal(fail, null);
  const wrongKey = await bridge.verifyClerkToken(req(token), env, async () =>
    new Response(JSON.stringify({ keys: [] }), { status: 200 }));
  assert.equal(wrongKey, null);
});

test("JWT válido sin D1 disponible: 503 sin crear sesión", async () => {
  const r = await bridge.clerkReadOnlyRoute(req(makeToken()), env);
  assert.equal(r.status, 503);
  const body = await r.json();
  assert.equal(body.authenticated, undefined);
});

test("Solo GET: no admite escritura por esta ruta", async () => {
  const r = await bridge.clerkReadOnlyRoute(req(null, "POST"), env);
  assert.equal(r.status, 405);
});
