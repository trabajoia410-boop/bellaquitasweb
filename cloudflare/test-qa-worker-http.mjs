#!/usr/bin/env node
/* QA real de Cloudflare: endpoint independiente, DB ficticia y ninguna credencial.
 * Solo solicita GET y dos POST denegados, sin enviar datos personales ni mutar D1.
 */
import assert from 'node:assert/strict';
const base='https://bellaquitas-api-qa.bellaquitas-fest-410.workers.dev';
const get=async path=>fetch(base+path,{method:'GET',cache:'no-store',signal:AbortSignal.timeout(20000),redirect:'manual'});
const post=async path=>fetch(base+path,{method:'POST',cache:'no-store',signal:AbortSignal.timeout(20000),headers:{Origin:base,'Content-Type':'application/json'},body:'{}'});
const [health,events,rewards,me,admin,loginStatus,google,panel,write,points]=await Promise.all([
 get('/health'),get('/v1/events'),get('/v1/rewards'),get('/v1/auth/me'),
 get('/v1/admin/session'),get('/v1/auth/email/status'),get('/v1/auth/google/start?return=admin'),
 get('/administracion/'),post('/v1/mirror/admin/write'),post('/v1/admin/member')
]);
assert.equal(health.status,200,'QA worker with D1 accessible');
const h=await health.json();assert.equal(h.database,'connected');assert.equal(h.storage,'not-configured');
assert.equal(events.status,200);assert.deepEqual((await events.json()).items,[],'Only empty QA events');
assert.equal(rewards.status,200);assert.deepEqual((await rewards.json()).items,[],'Only empty QA rewards');
assert.equal(me.status,200);assert.equal((await me.json()).authenticated,false);
assert.equal(admin.status,401,'No admin session');
assert.equal(loginStatus.status,200);
const features=await loginStatus.json();assert.equal(features.login,false);assert.equal(features.adminLink,false);
assert.equal(google.status,503,'Google OAuth must remain off in QA');
assert.equal(panel.status,200);assert.match(panel.headers.get('content-security-policy')||'',/script-src 'nonce-/);
const html=await panel.text();assert.ok(html.includes('id="loginForm"'));
assert.equal(write.status,401,'Anonymous editing denied');
assert.equal(points.status,401,'Anonymous points/roles editing denied');
for(const response of [health,events,rewards,me,admin,loginStatus,google,panel,write,points]){
 assert.equal(response.headers.get('set-cookie'),null,'QA must not establish sessions');
}
console.log('OK: Worker QA live + D1 vacía + 0 cuentas + autenticación y escrituras denegadas. Dominio público intacto.');
