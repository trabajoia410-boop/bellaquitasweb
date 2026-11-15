#!/usr/bin/env node
/* Bellaquitas Fest: ensayo HTTP REAL del staging, sin credenciales ni escrituras.
 * No se intentan cuentas existentes; JSON {} se rechaza incluso sin flags.
 */
import assert from 'node:assert/strict';
const BASE='https://bellaquitas-api-staging.bellaquitas-fest-410.workers.dev';
const req=async(path,init={})=>fetch(BASE+path,{redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(20000),...init});
const post=async path=>req(path,{method:'POST',headers:{Origin:BASE,'Content-Type':'application/json','Sec-Fetch-Site':'same-origin'},body:'{}'});
const [health,status,panel,session,profile,registration,linkStart,unauthorizedEdit]=await Promise.all([
 req('/health'),req('/v1/auth/email/status'),req('/administracion/'),req('/v1/admin/session'),
 req('/v1/auth/me'),post('/v1/auth/email/register'),post('/v1/auth/admin/email/link/start'),
 post('/v1/admin/member')
]);
assert.equal(health.status,200,'El staging debe seguir conectado a D1');
assert.equal((await health.json()).database,'connected');
assert.equal(status.status,200);
const features=await status.json();
assert.equal(features.registration,false,'Registro en staging TIENE QUE estar cerrado');
assert.equal(features.adminLink,false,'Vinculación de administrador debe seguir cerrada');
assert.equal(features.login,true,'No cortar el login existente involuntariamente');
assert.equal(panel.status,200,'Panel independiente debe permanecer disponible');
assert.match(panel.headers.get('content-security-policy')||'',/script-src 'nonce-/);
const html=await panel.text();
assert.ok(html.includes('id="loginForm"'),'Formulario email debe existir');
assert.ok(html.includes('Google'),'Ingreso con Google sigue presente');
assert.equal(session.status,401,'No existe una sesión admin sin reautenticación');
assert.equal(profile.status,200);
assert.equal((await profile.json()).authenticated,false);
assert.equal(registration.status,503,'No permitir crear nuevas cuentas por correo');
assert.equal(linkStart.status,503,'No permitir activar credenciales admin sin autorización');
assert.equal(unauthorizedEdit.status,401,'Edición de socios requiere admin');
for(const item of [health,status,panel,session,profile,registration,linkStart,unauthorizedEdit]){
 assert.equal(item.headers.get('set-cookie'),null,'Un visitante anónimo no debe recibir sesión');
}
console.log('OK: staging real con alta email y vinculación admin desactivadas, 401 sin admin, panel aislado/CSP, login existente intacto, sin cookies.');
