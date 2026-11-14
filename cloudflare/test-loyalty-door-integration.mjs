#!/usr/bin/env node
/* Bellaquitas Fest: test integrado, SQLite RAM, IDs y tarjetas ficticias.
   Esquema y triggers extraídos de D1 staging SOLO como DDL (sin registros). */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {createAuthSession,createVerifiedAdminSession} from './auth-routes.js';
import {protectedRoute} from './protected-routes.js';

const db=new DatabaseSync(':memory:');
db.exec(readFileSync('cloudflare/fixtures/loyalty-d1-schema.sql','utf8'));
db.exec('CREATE TABLE auth_sessions (token_hash TEXT PRIMARY KEY,profile_id TEXT REFERENCES profiles(id),expires_at INTEGER NOT NULL,created_at INTEGER NOT NULL DEFAULT(unixepoch())); CREATE TABLE auth_admin_sessions (token_hash TEXT PRIMARY KEY,profile_id TEXT REFERENCES profiles(id),regular_session_hash TEXT REFERENCES auth_sessions(token_hash),expires_at INTEGER NOT NULL,created_at INTEGER NOT NULL DEFAULT(unixepoch()));');
const DB={
 prepare(sql){return {
  params:[],
  bind(...params){this.params=params;return this;},
  async first(){return db.prepare(sql).get(...this.params)||null;},
  async run(){return db.prepare(sql).run(...this.params);},
  async all(){return {results:db.prepare(sql).all(...this.params)};}
 };},
 async batch(q){
  db.exec('BEGIN');
  try{const result=[];for(const x of q)result.push(await x.run());db.exec('COMMIT');return result;}
  catch(e){db.exec('ROLLBACK');throw e;}
 }
};
const env={DB,STAGING_MUTATIONS:'enabled',PUBLIC_ORIGIN:'https://loyalty-qa.example.test'};
const userId='11111111-1111-4111-8111-111111111111';
const staffId='22222222-2222-4222-8222-222222222222';
const adminId='33333333-3333-4333-8333-333333333333';
const rewardId='44444444-4444-4444-8444-444444444444';
for(const [id,name,role,code,points] of [
 [userId,'Socio ficticio','socio','MBR-QAUSER001',10],
 [staffId,'Puerta ficticia','puerta','MBR-QADOOR001',0],
 [adminId,'Admin ficticio','admin','MBR-QAADMIN001',0]
]){
 db.prepare('INSERT INTO profiles(id,name,role,member_code,points,lifetime_points,visits) VALUES(?,?,?,?,?,?,0)')
   .run(id,name,role,code,points,points);
}
db.prepare("INSERT INTO rewards(id,name,category,cost,symbol,description,active) VALUES(?,'Refresco QA','QA',15,'*','Solo prueba',1)").run(rewardId);
const cookies={
 user:[await createAuthSession(userId,env)],
 staff:[await createAuthSession(staffId,env)],
 admin:[await createAuthSession(adminId,env)],
 adminVerified:await createVerifiedAdminSession(adminId,env)
};
const session=name=>cookies[name].map(c=>c.split(';')[0]).join('; ');
async function api(path,body,who='user',options={}){
 const headers={Cookie:session(who),Origin:options.origin??env.PUBLIC_ORIGIN};
 if(body!==undefined)headers['Content-Type']='application/json';
 const req=new Request(env.PUBLIC_ORIGIN+path,{
  method:body===undefined?'GET':'POST',headers,
  ...(body!==undefined?{body:JSON.stringify(body)}:{})
 });
 const r=await protectedRoute(req,{...env,STAGING_MUTATIONS:options.mutations??env.STAGING_MUTATIONS});
 assert.ok(r,'Ruta debe existir: '+path);
 return {status:r.status,body:await r.json()};
}
const points=()=>db.prepare('SELECT points,lifetime_points,visits FROM profiles WHERE id=?').get(userId);
const count=table=>db.prepare('SELECT count(*) AS n FROM '+table).get().n;
const before=points();
assert.equal((await api('/v1/admin/members',undefined,'admin')).status,403);
assert.equal((await api('/v1/admin/members',undefined,'adminVerified')).status,200);
assert.equal((await api('/v1/door/members',undefined,'user')).status,403);
assert.equal((await api('/v1/door/members',undefined,'staff')).status,200);
assert.equal((await api('/v1/door/checkin',{code:'MBR-QAUSER001'},'user')).status,403);
assert.equal((await api('/v1/door/checkin',{code:'MBR-QADOOR001'},'staff')).status,403);
assert.equal((await api('/v1/door/checkin',{code:'MBR-INVENTADO000'},'staff')).status,404);
assert.deepEqual(points(),before,'Todos los accesos rechazados dejan puntos intactos');
let result=await api('/v1/door/checkin',{code:'mbr-qauser001'},'staff');
assert.equal(result.status,200,'Acepta QR del socio con mayúsculas/minúsculas');
assert.equal(result.body.points_awarded,10);
assert.deepEqual(points(),{points:20,lifetime_points:20,visits:1});
assert.equal(count('activity'),1);
result=await api('/v1/door/checkin',{code:'MBR-QAUSER001'},'staff');
assert.equal(result.status,409,'Índice único evita segunda visita en el día');
assert.match(result.body.error,/visita.*hoy/i);
assert.deepEqual(points(),{points:20,lifetime_points:20,visits:1},'D1 batch revierte la operación duplicada');
assert.equal(count('activity'),1);
result=await api('/v1/rewards/request',{reward_id:rewardId},'user');
assert.equal(result.status,200);
assert.match(result.body.code,/^CNJ-[A-F0-9]{10}$/);
const redemptionCode=result.body.code;
assert.deepEqual(points(),{points:5,lifetime_points:20,visits:1});
assert.equal(count('redemptions'),1);
assert.equal(count('activity'),2);
result=await api('/v1/rewards/request',{reward_id:rewardId},'user');
assert.equal(result.status,409,'Rechaza recompensas con saldo insuficiente');
assert.match(result.body.error,/Puntos insuficientes/);
assert.deepEqual(points(),{points:5,lifetime_points:20,visits:1});
assert.equal(count('redemptions'),1);
assert.equal((await api('/v1/door/redemptions/validate',{code:redemptionCode},'user')).status,403);
assert.equal((await api('/v1/door/redemptions/validate',{code:redemptionCode},'staff')).status,200);
assert.equal(db.prepare('SELECT status FROM redemptions').get().status,'validado');
assert.equal(count('activity'),3);
assert.equal((await api('/v1/door/redemptions/validate',{code:redemptionCode},'staff')).status,404);
assert.equal(count('activity'),3);
const change={member_id:userId,name:'Socio ficticio',role:'socio',points:9,lifetime_points:24,visits:1,reason:'Corrección auditada de prueba'};
assert.equal((await api('/v1/admin/member',change,'admin')).status,403,'Admin necesita sesión reforzada');
assert.equal((await api('/v1/admin/member',change,'adminVerified',{origin:'https://intruso.example.test'})).status,403);
assert.equal((await api('/v1/admin/member',change,'adminVerified',{mutations:'disabled'})).status,423);
assert.equal(points().points,5);
assert.equal((await api('/v1/admin/member',change,'adminVerified')).status,200);
assert.deepEqual(points(),{points:9,lifetime_points:24,visits:1});
assert.equal(count('admin_member_changes'),1);
assert.equal(count('activity'),4);
const self={member_id:adminId,name:'Admin ficticio',role:'socio',points:0,lifetime_points:0,visits:0,reason:'Prueba de revocación de su propio rol'};
assert.equal((await api('/v1/admin/member',self,'adminVerified')).status,409);
assert.equal(db.prepare('SELECT role FROM profiles WHERE id=?').get(adminId).role,'admin');
assert.equal(count('profiles'),3);
assert.equal(count('admin_member_changes'),1);
db.close();
console.log('OK: QR, visita única, puntos, descuentos, canjes, personal, origen, reautenticación y auditoría. Todos los datos en SQLite RAM.');
