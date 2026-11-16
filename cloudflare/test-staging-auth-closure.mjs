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
assert.equal(features.adminLink,true,'Vinculación disponible SOLO tras reautenticación del administrador y confirmación email');
assert.equal(features.login,true,'No cortar el login existente involuntariamente');
assert.ok([200,404].includes(panel.status),'El staging legado no debe devolver error 500 del panel');
if(panel.status===200){
 assert.match(panel.headers.get('content-security-policy')||'',/script-src 'nonce-/);
 const html=await panel.text();
 assert.ok(html.includes('id="loginForm"'),'Formulario email debe existir');
 assert.ok(html.includes('Google'),'Ingreso con Google sigue presente');
}
assert.ok([401,404].includes(session.status),'No existe una sesión admin sin reautenticación');
assert.ok([200,404].includes(profile.status),'El perfil anónimo no debe lanzar 500');
if(profile.status===200)assert.equal((await profile.json()).authenticated,false);
assert.equal(registration.status,503,'No permitir crear nuevas cuentas por correo');
assert.equal(linkStart.status,401,'Ningún visitante anónimo puede iniciar vinculación de credenciales admin');
assert.ok([401,403,404,405].includes(unauthorizedEdit.status),'Edición de socios requiere admin');
for(const item of [health,status,panel,session,profile,registration,linkStart,unauthorizedEdit]){
 assert.equal(item.headers.get('set-cookie'),null,'Un visitante anónimo no debe recibir sesión');
}
console.log('OK: staging real con alta email desactivada, admin sin autorización, sin cookies. Estados HTTP:',JSON.stringify({panel:panel.status,session:session.status,profile:profile.status,registration:registration.status,linkStart:linkStart.status,edit:unauthorizedEdit.status}));
