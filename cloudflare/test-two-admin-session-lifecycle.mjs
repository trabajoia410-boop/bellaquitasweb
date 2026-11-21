#!/usr/bin/env node
/* Bellaquitas Fest: sesiones de DOS administradores ficticios.
 * SQLite en RAM, sin red, sin usuarios reales, sin acceso a D1 remota.
 */
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createVerifiedAdminSession,authenticatedAdminAccess,authRoute} from './auth-routes.js';

const ORIGIN='https://admin-qa.example.test';
const adminA='11111111-1111-4111-8111-111111111111';
const adminB='22222222-2222-4222-8222-222222222222';
const member='33333333-3333-4333-8333-333333333333';

const db=new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys=ON');
db.exec("CREATE TABLE profiles(id TEXT PRIMARY KEY,name TEXT,role TEXT,member_code TEXT,points INTEGER,lifetime_points INTEGER,visits INTEGER,created_at TEXT DEFAULT (datetime('now'))); CREATE TABLE auth_sessions(token_hash TEXT PRIMARY KEY,profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,expires_at INTEGER NOT NULL,created_at INTEGER NOT NULL DEFAULT (unixepoch()));");
db.exec(readFileSync('cloudflare/migrations/0007-admin-step-up.sql','utf8'));
db.prepare('INSERT INTO profiles(id,name,role,member_code,points,lifetime_points,visits) VALUES(?,?,?,?,?,?,?)')
  .run(adminA,'Admin ficticia A','admin','ADMIN-QA-A',25,31,3);
db.prepare('INSERT INTO profiles(id,name,role,member_code,points,lifetime_points,visits) VALUES(?,?,?,?,?,?,?)')
  .run(adminB,'Admin ficticia B','admin','ADMIN-QA-B',57,64,9);
db.prepare('INSERT INTO profiles(id,name,role,member_code,points,lifetime_points,visits) VALUES(?,?,?,?,?,?,?)')
  .run(member,'Socio ficticio','socio','SOCIO-QA',18,22,2);

const adapter={
 prepare(sql){return {bind(...values){return {
  async first(){return db.prepare(sql).get(...values)||null},
  async run(){return db.prepare(sql).run(...values)},
  async all(){return {results:db.prepare(sql).all(...values)}}
 }}}},
 async batch(stmts){
   db.exec('BEGIN');
   try{const r=[];for(const st of stmts)r.push(await st.run());db.exec('COMMIT');return r}
   catch(err){db.exec('ROLLBACK');throw err}
 }
};
const env={DB:adapter,PUBLIC_ORIGIN:ORIGIN};
const make=(cookies=[],url='/v1/admin/session',init={})=>
 new Request(ORIGIN+url,{...init,headers:{
  ...(init.headers||{}),
  Cookie:cookies.map(x=>x.split(';')[0]).join('; ')
 }});
const who=async cookies=>(await authenticatedAdminAccess(make(cookies),env))?.id||null;

try {
 const a=await createVerifiedAdminSession(adminA,env);
 const b=await createVerifiedAdminSession(adminB,env);
 assert.equal(a.length,2);assert.equal(b.length,2);
 for(const cookies of [a,b]){
  assert.match(cookies[0],/^__Host-bf_session=.{43}; Path=\/; Max-Age=43200; Secure; HttpOnly; SameSite=Lax/);
  assert.match(cookies[1],/^__Host-bf_admin=.{43}; Path=\/; Max-Age=7200; Secure; HttpOnly; SameSite=Lax/);
 }
 assert.equal(await who([]),null,'Sin sesión no hay admin');
 assert.equal(await who([a[0]]),null,'Una única cookie no sirve');
 assert.equal(await who([b[1]]),null,'Cookie admin sin principal no sirve');
 assert.equal(await who([a[0],b[1]]),null,'No cruzar cuentas');
 assert.equal(await who([b[0],a[1]]),null,'No cruzar cuentas (reverso)');
 assert.equal(await who(a),adminA);
 assert.equal(await who(b),adminB);
 await assert.rejects(()=>createVerifiedAdminSession(member,env),/forbidden/);
 assert.equal((await authRoute(make(a),env)).status,200);
 assert.equal((await authRoute(make(),env)).status,401);
 assert.equal((await authRoute(make(a,'/v1/auth/logout',{method:'GET'}),env)).status,405);

 // Bloquear logout CSRF desde otro origen antes de tocar la base.
 const malicious=make(a,'/v1/auth/logout',{
  method:'POST',headers:{Origin:'https://evil.example.test','Sec-Fetch-Site':'cross-site'}
 });
 assert.equal((await authRoute(malicious,env)).status,403);
 assert.equal(await who(a),adminA,'CSRF no revoca la sesión de otro usuario');

 // Caducidad de segunda cookie de A sin impactar B.
 db.prepare('UPDATE auth_admin_sessions SET expires_at=unixepoch()-1 WHERE profile_id=?').run(adminA);
 assert.equal(await who(a),null);
 assert.equal(await who(b),adminB);
 const refreshed=await createVerifiedAdminSession(adminA,env);
 assert.equal(await who(refreshed),adminA);

 // Cambio de rol inmediato bloquea acceso admin.
 db.prepare("UPDATE profiles SET role='socio' WHERE id=?").run(adminA);
 assert.equal(await who(refreshed),null,'El rol se consulta en cada petición');
 assert.equal(await who(b),adminB);
 db.prepare("UPDATE profiles SET role='admin' WHERE id=?").run(adminA);

 // Logout real revoca regular + step-up de A, deja B válida.
 const logout=await authRoute(make(refreshed,'/v1/auth/logout',{
  method:'POST',headers:{Origin:ORIGIN,'Sec-Fetch-Site':'same-origin'}
 }),env);
 assert.equal(logout.status,200);
 assert.ok((logout.headers.get('set-cookie')||'').includes('Max-Age=0'));
 assert.equal(await who(refreshed),null,'La sesión A se revocó');
 assert.equal(await who(b),adminB,'Logout A NO debe revocar B');
 assert.equal(db.prepare('SELECT count(*) AS c FROM auth_admin_sessions WHERE profile_id=?').get(adminA).c,1,
  'La sesión antigua caducada queda para purga posterior');
 assert.equal(db.prepare('SELECT count(*) AS c FROM auth_admin_sessions WHERE profile_id=?').get(adminB).c,1);
 assert.deepEqual({...db.prepare('SELECT name,role,points,lifetime_points,visits FROM profiles WHERE id=?').get(adminA)},
  {name:'Admin ficticia A',role:'admin',points:25,lifetime_points:31,visits:3});
 assert.deepEqual({...db.prepare('SELECT name,role,points,lifetime_points,visits FROM profiles WHERE id=?').get(adminB)},
  {name:'Admin ficticia B',role:'admin',points:57,lifetime_points:64,visits:9});
 assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
 console.log('OK: DOS admins ficticios, sesiones aisladas, no cruce cookies, caducidad, cambio de rol, CSRF, logout selectivo, puntos intactos.');
} finally {db.close()}
