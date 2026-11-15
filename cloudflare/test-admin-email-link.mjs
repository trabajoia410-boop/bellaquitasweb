#!/usr/bin/env node
/* Integración end-to-end SIN RED y SIN PERSONAS: administrador Google -> verificar email
 * -> conservar perfil/rol/puntos -> acceder con contraseña. Todas las tablas SQLite :memory:.
 */
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createVerifiedAdminSession} from './auth-routes.js';
import {emailAuthRoute} from './email-auth-routes.js';
const db=new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys=ON;');
db.exec('CREATE TABLE profiles(id TEXT PRIMARY KEY,name TEXT,role TEXT,member_code TEXT,points INTEGER DEFAULT 0,lifetime_points INTEGER DEFAULT 0,visits INTEGER DEFAULT 0,created_at INTEGER DEFAULT(unixepoch()));');
db.exec('CREATE TABLE auth_sessions(token_hash TEXT PRIMARY KEY,profile_id TEXT REFERENCES profiles(id),expires_at INTEGER,created_at INTEGER DEFAULT(unixepoch()));');
db.exec('CREATE TABLE auth_admin_sessions(token_hash TEXT PRIMARY KEY,profile_id TEXT REFERENCES profiles(id),regular_session_hash TEXT REFERENCES auth_sessions(token_hash) ON DELETE CASCADE,expires_at INTEGER,created_at INTEGER DEFAULT(unixepoch()));');
db.exec("CREATE TABLE auth_identity_links(id TEXT,provider TEXT,provider_subject TEXT,profile_id TEXT REFERENCES profiles(id),PRIMARY KEY(provider,provider_subject),UNIQUE(provider,profile_id));");
db.exec("CREATE TABLE auth_email_credentials(email TEXT PRIMARY KEY COLLATE NOCASE,profile_id TEXT UNIQUE REFERENCES profiles(id),password_hash TEXT,password_salt TEXT,password_iterations INTEGER,verified_at INTEGER,created_at INTEGER DEFAULT(unixepoch()),updated_at INTEGER DEFAULT(unixepoch()));");
db.exec("CREATE TABLE auth_admin_email_links(token_hash TEXT PRIMARY KEY,profile_id TEXT UNIQUE REFERENCES profiles(id),email TEXT,password_hash TEXT,password_salt TEXT,password_iterations INTEGER,expires_at INTEGER,created_at INTEGER DEFAULT(unixepoch()));");
db.exec("CREATE TABLE auth_email_rate_limits(key_hash TEXT PRIMARY KEY,attempts INTEGER,expires_at INTEGER);");
const adminId='11111111-1111-4111-8111-111111111111';
const adminId2='33333333-3333-4333-8333-333333333333';
const socioId='22222222-2222-4222-8222-222222222222';
db.prepare("INSERT INTO profiles(id,name,role,member_code,points,lifetime_points,visits) VALUES(?,'Admin ficticio','admin','MBR-FAKE',11,12,2)").run(adminId);
db.prepare("INSERT INTO profiles(id,name,role,member_code,points,lifetime_points,visits) VALUES(?,'Socio ficticio','socio','MBR-FAKE2',7,8,1)").run(socioId);
db.prepare("INSERT INTO auth_identity_links(id,provider,provider_subject,profile_id) VALUES (?,'google','1234567890',?)").run('google-identity',adminId);
db.prepare("INSERT INTO profiles(id,name,role,member_code,points,lifetime_points,visits) VALUES(?,'Admin ficticio B','admin','MBR-FAKE3',29,35,4)").run(adminId2);
db.prepare("INSERT INTO auth_identity_links(id,provider,provider_subject,profile_id) VALUES (?,'google','0987654321',?)").run('google-identity-2',adminId2);
const d1={prepare(sql){return {bind(...values){return {
 async first(){return db.prepare(sql).get(...values)||null;},
 async run(){return db.prepare(sql).run(...values);},
 async all(){return {results:db.prepare(sql).all(...values)}}
};}}},async batch(queries){
 db.exec('BEGIN');
 try{const result=[];for(const q of queries)result.push(await q.run());db.exec('COMMIT');return result;}
 catch(e){db.exec('ROLLBACK');throw e;}
}};
const env={DB:d1,EMAIL_AUTH_ENABLED:'yes',EMAIL_RATE_KEY:'x'.repeat(48),
 RESEND_API_KEY:'test-only-key-not-real',RESEND_FROM:'dummy@example.test',
 TURNSTILE_SECRET:'turnstile-test-secret',TURNSTILE_SITE_KEY:'turnstile-test-site',
 ADMIN_EMAIL_LINK_ENABLED:'yes',PUBLIC_ORIGIN:'https://qa.example.test'};
const sent=[];
const priorFetch=globalThis.fetch;
globalThis.fetch=async (url,options)=>{
 assert.equal(url,'https://api.resend.com/emails','No network except intercepted email');
 const email=JSON.parse(options.body);
 sent.push(email);
 return new Response(JSON.stringify({id:'fake-mail'}),{status:200,headers:{'Content-Type':'application/json'}});
};
const password='Seguro-1234567890-FAKE';
const source=async(path,data,cookies=[],extraEnv=env)=>{
 const headers={'Content-Type':'application/json','Origin':env.PUBLIC_ORIGIN,'CF-Connecting-IP':'192.0.2.44'};
 if(cookies.length)headers.Cookie=cookies.map(c=>c.split(';')[0]).join('; ');
 return emailAuthRoute(new Request(env.PUBLIC_ORIGIN+path,{method:'POST',headers,body:JSON.stringify(data)}),extraEnv);
};
try{
 const full=await createVerifiedAdminSession(adminId,env);
 const full2=await createVerifiedAdminSession(adminId2,env);
 const startPath='/v1/auth/admin/email/link/start';
 const confirmPath='/v1/auth/admin/email/link/confirm';
 const input={email:'admin-qa@example.test',password};
 assert.equal((await source(startPath,input,[])).status,401,'Sin autenticación no enviar correo');
 assert.equal((await source(startPath,input,[full[0]])).status,401,'Sesión general sin reautenticación no sirve');
 assert.equal((await source(startPath,input,full,{...env,ADMIN_EMAIL_LINK_ENABLED:'no'})).status,503,'Función desactivada de fábrica');
 assert.equal(db.prepare('SELECT count(*) AS c FROM auth_email_credentials').get().c,0);
 const sentResp=await source(startPath,input,full);
 assert.equal(sentResp.status,200,await sentResp.text().catch(()=>''),'Solicitud autorizada');
 assert.equal(sent.length,1);
 assert.equal(db.prepare('SELECT count(*) AS c FROM auth_admin_email_links').get().c,1);
 const pending=db.prepare('SELECT password_hash FROM auth_admin_email_links').get();
 assert.ok(pending.password_hash.startsWith('pbkdf2-chain6-sha256-v1$'),'Solo se guarda hash de clave');
 const url=sent[0].text.match(/https:\/\/qa\.example\.test\/administracion\/#vincular=[A-Za-z0-9_-]{43}/)?.[0];
 assert.ok(url,'El enlace termina en fragmento que no llega al servidor');
 const token=new URL(url).hash.replace('#vincular=','');
 assert.equal((await source(confirmPath,{token:token.slice(1)},full)).status,400,'Token incorrecto se rechaza');
 assert.equal((await source(confirmPath,{token},full2)).status,400,'Segundo admin no puede reclamar enlace del primero');
 assert.equal(db.prepare('SELECT count(*) AS c FROM auth_email_credentials').get().c,0);
 const confirm=await source(confirmPath,{token},full);
 assert.equal(confirm.status,200,'Confirmación de un solo uso');
 assert.equal((await confirm.json()).reauthenticate,true,'Debe renovar las sesiones');
 assert.ok(confirm.headers.get('set-cookie')?.includes('Max-Age=0'),'Cookies revocadas');
 const a=db.prepare('SELECT id,role,points,lifetime_points,visits FROM profiles WHERE id=?').get(adminId);
 assert.equal(a.role,'admin');assert.equal(a.points,11);assert.equal(a.lifetime_points,12);assert.equal(a.visits,2);
 assert.equal(db.prepare('SELECT count(*) AS c FROM profiles').get().c,3,'No se crean perfiles duplicados');
 assert.equal(db.prepare("SELECT profile_id FROM auth_identity_links WHERE provider='google'").get().profile_id,adminId);
 assert.equal(db.prepare("SELECT profile_id FROM auth_identity_links WHERE provider='email'").get().profile_id,adminId);
 assert.equal(db.prepare('SELECT count(*) AS c FROM auth_admin_email_links').get().c,0);
 assert.equal(db.prepare('SELECT count(*) AS c FROM auth_sessions WHERE profile_id=?').get(adminId).c,0,'Se revocan sesiones del primer admin');
 assert.equal(db.prepare('SELECT count(*) AS c FROM auth_sessions WHERE profile_id=?').get(adminId2).c,1,'Conservar sesión del segundo admin');
 assert.equal((await source(confirmPath,{token},full)).status,401,'Enlace no reutilizable tras revocación');
 const login=await source('/v1/auth/email/login',{email:'admin-qa@example.test',password,admin_access:true});
 assert.equal(login.status,200,'Acceso de administrador con nueva contraseña');
 assert.ok(login.headers.get('set-cookie')?.includes('__Host-bf_session='));
 assert.equal(db.prepare('SELECT count(*) AS c FROM profiles').get().c,3);
 // Segunda cuenta distinta: correo, token y credenciales independientes.
 const password2='Seguro-9876543210-FAKE-B';
 const secondStart=await source(startPath,{email:'admin-b-qa@example.test',password:password2},full2);
 assert.equal(secondStart.status,200,'Segunda administradora conserva su acceso Google y puede vincular correo');
 assert.equal(sent.length,2,'Dos confirmaciones de correo distintas');
 const secondUrl=sent[1].text.match(/https:\/\/qa\.example\.test\/administracion\/#vincular=[A-Za-z0-9_-]{43}/)?.[0];
 assert.ok(secondUrl);
 const token2=new URL(secondUrl).hash.replace('#vincular=','');
 assert.notEqual(token2,token,'No reutilizar token entre administradores');
 assert.equal((await source(confirmPath,{token:token2.slice(1)},full2)).status,400);
 const secondConfirm=await source(confirmPath,{token:token2},full2);
 assert.equal(secondConfirm.status,200,'Segunda admin debe verificar su propio correo');
 assert.equal(db.prepare('SELECT count(*) AS c FROM auth_email_credentials').get().c,2,'Cada admin tiene credenciales propias');
 assert.equal(db.prepare("SELECT count(*) AS c FROM auth_identity_links WHERE provider='google'").get().c,2,'Ambas identidades Google sobreviven');
 assert.equal(db.prepare("SELECT count(*) AS c FROM auth_identity_links WHERE provider='email'").get().c,2,'Las dos contraseñas están vinculadas a los mismos perfiles');
 assert.equal(db.prepare("SELECT profile_id FROM auth_email_credentials WHERE email='admin-qa@example.test'").get().profile_id,adminId);
 assert.equal(db.prepare("SELECT profile_id FROM auth_email_credentials WHERE email='admin-b-qa@example.test'").get().profile_id,adminId2);
 assert.equal(db.prepare('SELECT count(*) AS c FROM profiles').get().c,3,'No crear usuarios extras al vincular credenciales');
 assert.deepEqual({...db.prepare('SELECT role,points,lifetime_points,visits FROM profiles WHERE id=?').get(adminId2)},{role:'admin',points:29,lifetime_points:35,visits:4});
 assert.equal(db.prepare('SELECT count(*) AS c FROM auth_sessions WHERE profile_id=?').get(adminId2).c,0,'Revocar solo sesiones del segundo admin');
 assert.equal((await source(confirmPath,{token:token2},full2)).status,401,'Token de segunda admin no reutilizable');
 assert.equal((await source('/v1/auth/email/login',{email:'admin-b-qa@example.test',password:password2,admin_access:true})).status,200);
 assert.equal((await source('/v1/auth/email/login',{email:'admin-b-qa@example.test',password,admin_access:true})).status,401,'La contraseña de admin A no abre cuenta B');
 assert.equal((await source('/v1/auth/email/login',{email:'admin-qa@example.test',password,admin_access:true})).status,200,'Primera cuenta sigue accediendo');
 console.log('OK: 2 admins ficticios Google -> 2 correos verificados, credenciales aisladas, tokens no intercambiables, sin duplicados, roles y puntos intactos. Sin red ni datos reales.');
}finally{globalThis.fetch=priorFetch;db.close();}
