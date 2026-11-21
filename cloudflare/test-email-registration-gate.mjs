#!/usr/bin/env node
/* Guardia de alta por correo: el bloqueo global se impone aunque el propio
 * flag EMAIL_REGISTRATION_ENABLED sea 'yes'. No usa D1, red, cuentas ni email.
 */
import assert from 'node:assert/strict';
import {emailAuthRoute} from './email-auth-routes.js';
const BASE='https://bellaquitas-api-qa.bellaquitas-fest-410.workers.dev';
const features={
 EMAIL_AUTH_ENABLED:'yes',
 EMAIL_RATE_KEY:'only-test-rate-key-abcdefghijklmno123456789',
 RESEND_API_KEY:'resend_test_key_xxxx',
 RESEND_FROM:'qa@example.test',
 TURNSTILE_SECRET:'turnstile-test-secret-xxxx',
 TURNSTILE_SITE_KEY:'turnstile-test-site-xxxx',
 EMAIL_REGISTRATION_ENABLED:'yes',
 ADMIN_EMAIL_LINK_ENABLED:'no',
 PUBLIC_ORIGIN:BASE
};
const call=(env,path,init)=>emailAuthRoute(new Request(BASE+path,init),env);
const status=async env=>{
 const response=await call(env,'/v1/auth/email/status');
 assert.equal(response.status,200);
 return response.json();
};
const blocked={...features,ALLOW_NEW_ACCOUNTS:'no'};
const off=await status(blocked);
assert.equal(off.login,true,'Los socios existentes deben poder iniciar sesión');
assert.equal(off.registration,false,'El bloqueo global debe impedir las nuevas cuentas');
assert.equal(off.adminLink,false);
const write=await call({...blocked,DB:null},'/v1/auth/email/register',{
 method:'POST',headers:{Origin:BASE,'Content-Type':'application/json'},body:'{}'
});
assert.equal(write.status,503,'El bloqueo se ejecuta antes de consultar D1');
// La activación de nuevos socios requiere AMBOS flags y prerequisitos de email.
const on=await status({...features,ALLOW_NEW_ACCOUNTS:'yes'});
assert.equal(on.registration,true,'La doble autorización explícita permite el registro');
const stillBlocked=await status({...features,ALLOW_NEW_ACCOUNTS:'unset'});
assert.equal(stillBlocked.registration,false);
const extraBlocked=await status({...features,EMAIL_REGISTRATION_ENABLED:'no',ALLOW_NEW_ACCOUNTS:'yes'});
assert.equal(extraBlocked.registration,false);
console.log('OK: correo existente funciona, altas requieren ALLOW_NEW_ACCOUNTS=yes + EMAIL_REGISTRATION_ENABLED=yes; sin DB ni red.');
