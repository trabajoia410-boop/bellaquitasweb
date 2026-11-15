#!/usr/bin/env node
/**
 * Bellaquitas Fest /administracion/ staging deployed contract.
 * Real HTTPS requests only; zero credentials, zero user profiles and no mutation payloads.
 * Running this against production is explicitly forbidden.
 */
import assert from 'node:assert/strict';
const BASE='https://bellaquitas-api-staging.bellaquitas-fest-410.workers.dev';
const request=(path,options={})=>fetch(BASE+path,{
 cache:'no-store',redirect:'manual',signal:AbortSignal.timeout(25000),...options
});
const post=(path,origin=BASE)=>request(path,{
 method:'POST',headers:{'Origin':origin,'Content-Type':'application/json','Sec-Fetch-Site':origin===BASE?'same-origin':'cross-site'},
 body:'{}'
});
const [health,admin,adminHead,redirect,adminPost,session,me,status,signup,link,member,write,foreignPost,mirror,app,events]=await Promise.all([
 request('/health'),request('/administracion/'),request('/administracion/',{method:'HEAD'}),
 request('/administracion'),post('/administracion/'),request('/v1/admin/session'),
 request('/v1/auth/me'),request('/v1/auth/email/status'),post('/v1/auth/email/register'),
 post('/v1/auth/admin/email/link/start'),post('/v1/admin/member'),
 post('/v1/mirror/admin/write'),post('/v1/admin/member','https://untrusted.example'),
 request('/espejo/'),request('/espejo/app.js'),request('/v1/events')
]);
assert.equal(health.status,200,'La D1 debe continuar accesible');
const alive=await health.json();
assert.equal(alive.database,'connected');
assert.equal(alive.storage,'not-configured','No declarar vídeos R2 inexistentes');
assert.equal(admin.status,200,'El panel de administración DEBE estar publicado en staging');
assert.equal(adminHead.status,200,'HEAD del panel');
assert.equal(redirect.status,308,'/administracion redirige a /administracion/');
assert.ok((redirect.headers.get('location')||'').endsWith('/administracion/'));
assert.equal(adminPost.status,405,'No permitir escritura sobre HTML del panel');
assert.match(admin.headers.get('content-type')||'',/text\/html/);
assert.match(admin.headers.get('content-security-policy')||'',/script-src 'nonce-[^']+'/);
assert.match(admin.headers.get('content-security-policy')||'',/frame-ancestors 'none'/);
assert.equal(admin.headers.get('x-frame-options'),'DENY');
assert.match(admin.headers.get('x-robots-tag')||'',/noindex/);
assert.match(admin.headers.get('cache-control')||'',/no-store/);
const html=await admin.text();
for(const text of ['id="loginForm"','/v1/auth/google/start?return=admin','data-tab="site"','data-tab="events"','data-tab="members"','data-tab="rewards"','data-tab="security"','Reautenticación']){
 assert.ok(html.includes(text),'Falta sección del panel '+text);
}
assert.ok(!html.includes('supabase.co'),'No exponer conexión a producción desde panel');
assert.equal(session.status,401,'El endpoint de admin debe requerir step-up');
assert.equal(me.status,200,'Estado de sesión anónimo');
assert.equal((await me.json()).authenticated,false);
assert.equal(status.status,200);
const features=await status.json();
assert.equal(features.login,true,'No romper login de cuentas existentes');
assert.equal(features.registration,false,'Altas cerradas');
assert.equal(features.adminLink,false,'No vincular correo admin hasta verificación');
assert.equal(signup.status,503,'Altas de email denegadas antes de D1');
assert.equal(link.status,503,'Enlace admin cerrado');
assert.equal(member.status,401,'Usuarios sin login no cambian socios');
assert.equal(write.status,401,'Sin admin no se edita la web');
// El backend exige sesión primero (401), y verifica Origin (403) cuando la sesión es válida.
assert.ok([401,403].includes(foreignPost.status),'Una petición de otro origen sin credenciales debe rechazarse');
assert.equal(mirror.status,200,'El espejo visual de staging debe mantenerse');
assert.equal(app.status,200,'El código del espejo debe cargarse');
const js=await app.text();
assert.ok(js.includes('Fuente original correcta bajo la banda amarilla'),
 'El cambio de vídeo móvil Safari debe permanecer en el espejo');
assert.equal(events.status,200);
const eventList=await events.json();
assert.ok(Array.isArray(eventList.items),'Conservar API de eventos');
for(const r of [health,admin,adminHead,redirect,adminPost,session,me,status,signup,link,member,write,foreignPost,mirror,app,events]){
 assert.equal(r.headers.get('set-cookie'),null,'Una llamada anónima no debe crear sesiones');
}
console.log('OK: staging /administracion/ PUBLICADO, CSP nonce, vista editor/eventos/socios, Google y email visibles, alta cerrada, admin 401, origen cruzado denegado, espejo y vídeo iPhone, sin escrituras.');
