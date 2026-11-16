#!/usr/bin/env node
/** Solo prepara y verifica deployment Cloudflare Staging.
 * Nunca usar en bellaquitas.fr ni en main; no incluye secretos ni usuarios.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const cfg=JSON.parse(readFileSync('cloudflare/wrangler-api-staging.jsonc','utf8'));
assert.equal(cfg.name,'bellaquitas-api-staging');
assert.equal(cfg.main,'./bellaquitas-api-staging.js');
assert.equal(cfg.compatibility_date,'2026-11-10','Conservar versión de runtime');
assert.equal(cfg.workers_dev,true);
assert.equal(cfg.keep_vars,true,'No sobrescribir variables existentes');
assert.deepEqual(cfg.vars,{ADMIN_EMAIL_LINK_ENABLED:'yes'},'Solo habilitar auto-vinculación admin tras Google + correo; no versionar secretos');
assert.ok(!Object.hasOwn(cfg,'routes')&&!Object.hasOwn(cfg,'route'),'No cambiar DNS ni rutas de producción');
assert.ok(!Object.hasOwn(cfg,'assets'),'El backend no debe reemplazar ASSETS de vídeo ya publicados');
assert.ok(!Object.hasOwn(cfg,'r2_buckets'),'No volver a R2');
assert.equal(cfg.d1_databases.length,1);
assert.deepEqual(cfg.d1_databases[0],{
 binding:'DB',database_name:'bellaquitas-staging',
 database_id:'c7ada9c9-d397-4e22-b5b8-3fbd8d13e550'
});
assert.deepEqual(cfg.services,[{
 binding:'VIDEO_QA_PROXY',service:'bellaquitas-media-proxy-qa',environment:'production'
}]);
for(const k of ['GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','EMAIL_RATE_KEY','RESEND_API_KEY','TURNSTILE_SECRET']){
 assert.ok(!JSON.stringify(cfg).includes(k),'Nunca copiar secretos del Worker al repositorio');
}
const api=readFileSync('cloudflare/bellaquitas-api-staging.js','utf8');
assert.ok(api.includes("from \"./admin-console.js\""),'Bilingüismo administrativo debe formar parte del bundle');
const admin=readFileSync('cloudflare/admin-console.js','utf8');
assert.ok(admin.includes('bq-admin-language'),'Selector ES/FR ausente del código a desplegar');
console.log('OK: Worker STAGING, 1 D1, service binding original, keep_vars, 0 R2, 0 rutas DNS, admin ES/FR y secretos no versionados.');
