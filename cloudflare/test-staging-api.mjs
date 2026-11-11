/**
 * Auditoría automática de Bellaquitas Fest en Cloudflare staging.
 *
 * SOLO consultas públicas y controles de rechazo SIN cookie. No contiene
 * credenciales, no crea usuarios, no manda correos, no edita datos, no
 * registra visitas y no canjea premios.
 *
 * Node >= 20: node cloudflare/test-staging-api.mjs
 */
import assert from 'node:assert/strict';

const HOST = 'bellaquitas-api-staging.bellaquitas-fest-410.workers.dev';
const base = new URL(process.env.BELLAQUITAS_STAGING_URL || 'https://' + HOST + '/');
assert.ok(
  base.protocol === 'https:' &&
  (base.hostname === HOST || base.hostname === 'localhost'),
  'Las pruebas solo pueden ejecutarse contra Cloudflare staging o localhost'
);
const TIMEOUT_MS = 12000;
let passed = 0;

async function call(path, expectedStatus = 200, options = {}) {
  const url = new URL(path, base);
  assert.equal(url.origin, base.origin, 'No se permiten orígenes externos');
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: options.headers || {},
    redirect: 'manual',
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  const name = (options.method || 'GET') + ' ' + path;
  assert.equal(
    response.status, expectedStatus,
    name + ' debe responder HTTP ' + expectedStatus + ', respondió ' + response.status
  );
  assert.equal(
    response.headers.get('x-content-type-options'), 'nosniff',
    name + ': falta X-Content-Type-Options: nosniff'
  );
  passed++;
  console.log('OK ' + name + ' — ' + response.status);
  return response;
}

async function json(path, expectedStatus = 200, options = {}) {
  const response = await call(path, expectedStatus, options);
  assert.match(response.headers.get('content-type') || '', /application\/json/i);
  return {response, payload: await response.json()};
}

async function deny(path, options = {}) {
  const {payload} = await json(path, 401, options);
  assert.equal(typeof payload.error, 'string', path + ': debería devolver error');
  assert.ok(!Object.hasOwn(payload, 'items'), path + ': filtración de datos');
  assert.ok(!Object.hasOwn(payload, 'profile'), path + ': filtración de perfil');
}

console.log('Auditoría de staging: sin cookies, sin contraseñas, sin mutaciones.');
const {payload: health} = await json('/health');
assert.equal(health.status, 'ok');
assert.equal(health.database, 'connected');
assert.equal(health.storage, 'configured');

for (const path of ['/v1/events', '/v1/rewards', '/v1/promos', '/v1/moments',
                    '/v1/mirror/public/photos']) {
  const {payload} = await json(path);
  assert.ok(Array.isArray(payload.items), path + ': se esperaba items[]');
}

const {payload: site} = await json('/v1/site');
assert.ok(site.site && typeof site.site === 'object', 'Contenido web ausente');
assert.equal(typeof site.site.page_settings, 'object', 'Configuración de diseño ausente');

const {payload: me} = await json('/v1/auth/me');
assert.equal(me.authenticated, false, 'Nunca debería existir sesión en el runner');
assert.equal(me.profile, null, 'Nunca se debe mostrar un perfil sin cookie');

const {payload: email} = await json('/v1/auth/email/status');
assert.equal(typeof email.login, 'boolean', 'Estado de acceso correo inválido');
assert.equal(typeof email.registration, 'boolean', 'Estado de registro inválido');

for (const path of [
  '/v1/me/activity',
  '/v1/admin/members',
  '/v1/door/members',
  '/v1/mirror/me/redemptions',
  '/v1/mirror/door/redemptions',
  '/v1/mirror/admin/catalog/events',
  '/v1/mirror/admin/site-drafts',
  '/v1/mirror/admin/community'
]) {
  await deny(path);
}

// Solo solicitudes SIN sesión: el servidor devuelve 401 ANTES de escribir.
for (const path of [
  '/v1/door/checkin',
  '/v1/admin/member',
  '/v1/rewards/request',
  '/v1/mirror/admin/write'
]) {
  await deny(path, {method: 'POST'});
}

const {payload: absent} = await json('/v1/profiles', 404);
assert.equal(typeof absent.error, 'string');

const {response: cors} = await json('/health', 200, {
  headers: {Origin: 'https://bellaquitas.fr'}
});
assert.equal(cors.headers.get('access-control-allow-origin'), 'https://bellaquitas.fr');

const {response: foreign} = await json('/health', 200, {
  headers: {Origin: 'https://example.invalid'}
});
assert.equal(foreign.headers.get('access-control-allow-origin'), null);

const html = await call('/espejo/');
assert.match(html.headers.get('content-type') || '', /text\/html/i);
const markup = await html.text();
assert.match(markup, /Bellaquitas/i, 'No se muestra la marca original');
assert.ok(!/supabase\.co\/auth\/v1\//i.test(markup), 'El espejo usa Auth antiguo');

const css = await call('/espejo/styles.css');
assert.ok((await css.text()).length > 1000, 'No se ha cargado el CSS original');

const lang = await call('/espejo/locale-fr.js');
assert.ok((await lang.text()).length > 1000, 'Falta la traducción francesa');

const logo = await call('/v1/assets/logos/705cc152-5de2-407a-a880-1e78ca4b30ea.png');
assert.match(logo.headers.get('content-type') || '', /image\/png/i);
assert.ok((await logo.arrayBuffer()).byteLength > 1000, 'Logo no disponible en R2');

console.log('OK: ' + passed + ' comprobaciones no destructivas superadas.');
