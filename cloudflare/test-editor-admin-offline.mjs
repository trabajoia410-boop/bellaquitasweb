#!/usr/bin/env node
/**
 * QA INTEGRACIÓN: editor de eventos, recompensas, promociones y textos ES/FR.
 * 100% SQLite temporal en RAM, con dos admins ficticios y un socio ficticio.
 * Nunca utiliza D1 remota, Google, correo, R2 ni datos del usuario.
 */
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createVerifiedAdminSession,createAuthSession} from './auth-routes.js';
import {mirrorWriteRoute} from './mirror-write-routes.js';

const db=new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys=ON;');
db.exec("CREATE TABLE profiles(id TEXT PRIMARY KEY,name TEXT,role TEXT,member_code TEXT,points INTEGER,lifetime_points INTEGER,visits INTEGER,created_at TEXT DEFAULT(datetime('now')))");
db.exec('CREATE TABLE auth_sessions(token_hash TEXT PRIMARY KEY,profile_id TEXT REFERENCES profiles(id),expires_at INTEGER,created_at INTEGER DEFAULT(unixepoch()))');
db.exec('CREATE TABLE auth_admin_sessions(token_hash TEXT PRIMARY KEY,profile_id TEXT REFERENCES profiles(id),regular_session_hash TEXT REFERENCES auth_sessions(token_hash) ON DELETE CASCADE,expires_at INTEGER,created_at INTEGER DEFAULT(unixepoch()))');
db.exec("CREATE TABLE events(id TEXT PRIMARY KEY,name TEXT NOT NULL,date_label TEXT NOT NULL,location TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),created_at TEXT NOT NULL DEFAULT(datetime('now')),start_time TEXT,image_url TEXT NOT NULL DEFAULT '',localized_content TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(localized_content)))");
db.exec("CREATE TABLE rewards(id TEXT PRIMARY KEY,name TEXT NOT NULL,category TEXT NOT NULL DEFAULT 'Premios',cost INTEGER NOT NULL CHECK(cost>0),symbol TEXT NOT NULL DEFAULT '✦',description TEXT NOT NULL DEFAULT '',active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),created_at TEXT NOT NULL DEFAULT(datetime('now')),image_url TEXT NOT NULL DEFAULT '',localized_content TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(localized_content)))");
db.exec("CREATE TABLE promos(id TEXT PRIMARY KEY,name TEXT NOT NULL,bonus INTEGER NOT NULL CHECK(bonus>0),description TEXT NOT NULL DEFAULT '',active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),created_at TEXT NOT NULL DEFAULT(datetime('now')),localized_content TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(localized_content)))");
db.exec("CREATE TABLE site_content(key TEXT PRIMARY KEY CHECK(key='homepage'),hero_text TEXT NOT NULL,announcement TEXT NOT NULL,updated_at TEXT NOT NULL DEFAULT(datetime('now')),page_settings TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(page_settings)))");
db.exec("CREATE TABLE site_drafts(key TEXT PRIMARY KEY CHECK(key='homepage'),settings TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(settings)),updated_at TEXT NOT NULL DEFAULT(datetime('now'))");
db.exec("CREATE TABLE community_suggestions(id TEXT PRIMARY KEY,name TEXT DEFAULT '',message TEXT NOT NULL,created_at TEXT DEFAULT(datetime('now')),status TEXT NOT NULL DEFAULT 'nuevo' CHECK(status IN ('nuevo','revisado','archivado')))");
const a='11111111-1111-4111-8111-111111111111';
const b='22222222-2222-4222-8222-222222222222';
const m='33333333-3333-4333-8333-333333333333';
for(const [id,name,role,points,historic,visits] of [
 [a,'Admin A ficticio','admin',400,520,3],
 [b,'Admin B ficticio','admin',700,800,5],
 [m,'Socio ficticio','socio',16,18,1]
])db.prepare("INSERT INTO profiles(id,name,role,member_code,points,lifetime_points,visits) VALUES (?,?,?,?,?,?,?)").run(id,name,role,'QA-'+id.slice(0,8),points,historic,visits);

const env={DB:{
 prepare(sql){return{bind(...values){return{
   async first(){return db.prepare(sql).get(...values)||null;},
   async run(){return db.prepare(sql).run(...values);},
   async all(){return {results:db.prepare(sql).all(...values)}}
 }};}},
 async batch(stmts){db.exec('BEGIN');try{const result=[];for(const q of stmts)result.push(await q.run());db.exec('COMMIT');return result}catch(e){db.exec('ROLLBACK');throw e}}
},PUBLIC_ORIGIN:'https://staging-qa.example.test',STAGING_MUTATIONS:'disabled'};
const [sa,sb]=await Promise.all([createVerifiedAdminSession(a,env),createVerifiedAdminSession(b,env)]);
const memberCookie=await createAuthSession(m,env);
const cookies=x=>(Array.isArray(x)?x:[x]).map(y=>y.split(';')[0]).join('; ');
const call=async (body,c=sa,options={})=>{
 const url=env.PUBLIC_ORIGIN+(options.upload?'/v1/mirror/admin/media/upload':'/v1/mirror/admin/write');
 const request=new Request(url,{method:options.upload?'PUT':'POST',headers:{
  Origin:options.origin||env.PUBLIC_ORIGIN,
  'Sec-Fetch-Site':options.site||'same-origin',
  'Content-Type':'application/json',Cookie:cookies(c)
 },body:JSON.stringify(body)});
 const r=await mirrorWriteRoute(request,{...env,STAGING_MUTATIONS:options.enable===false?'disabled':options.enable===true?'enabled':env.STAGING_MUTATIONS});
 return {status:r.status,body:await r.json()};
};
const original=db.prepare("SELECT id,role,points,lifetime_points,visits FROM profiles ORDER BY id").all();
const event={name:'Evento simulado',date_label:'2027-01-30',location:'Sala de prueba',description:'Descripción ficticia',active:true,start_time:'22:30',localized_content:{fr:{name:'Événement simulé'}}};
assert.equal((await call({kind:'catalog',table:'events',action:'insert',item:event})).status,423,'El staging cerrado no escribe');
assert.equal(db.prepare('SELECT COUNT(*) n FROM events').get().n,0,'Staging bloquea INSERT');
assert.equal((await call({kind:'catalog',table:'events',action:'insert',item:event},[],{enable:true})).status,401,'Sin cookie no escribe');
assert.equal((await call({kind:'catalog',table:'events',action:'insert',item:event},memberCookie,{enable:true})).status,403,'Socio no administra');
assert.equal((await call({kind:'catalog',table:'events',action:'insert',item:event},[sa[0],sb[1]],{enable:true})).status,403,'No mezclar cookies de dos administradores');
assert.equal((await call({kind:'catalog',table:'events',action:'insert',item:event},sa,{enable:true,origin:'https://evil.example.test',site:'cross-site'})).status,403,'Origen externo no escribe');

const created=await call({kind:'catalog',table:'events',action:'insert',item:event},sa,{enable:true});
assert.equal(created.status,200,'Insert evento admin autorizado');
assert.equal(db.prepare('SELECT name FROM events WHERE id=?').get(created.body.id)?.name,event.name);
const update=await call({kind:'catalog',table:'events',action:'update',id:created.body.id,item:{...event,name:'Evento corregido'}},sb,{enable:true});
assert.equal(update.status,200,'Segundo administrador puede editar evento');
assert.equal(db.prepare('SELECT name FROM events WHERE id=?').get(created.body.id)?.name,'Evento corregido');
assert.equal((await call({kind:'catalog',table:'events',action:'toggle',id:created.body.id,active:false},sa,{enable:true})).status,200);
assert.equal(db.prepare('SELECT active FROM events WHERE id=?').get(created.body.id).active,0);
const reward=await call({kind:'catalog',table:'rewards',action:'insert',item:{
 name:'Recompensa simulada',category:'Pruebas',cost:12,symbol:'✦',description:'Solo ensayo',active:true,localized_content:{fr:{name:'Récompense simulée'}}
}},sb,{enable:true});
assert.equal(reward.status,200,'Segundo administrador puede crear recompensa');
assert.equal(db.prepare('SELECT cost FROM rewards WHERE id=?').get(reward.body.id).cost,12);
const promo=await call({kind:'catalog',table:'promos',action:'insert',item:{
 name:'Promoción ficticia',bonus:5,description:'Solo QA',active:true
}},sa,{enable:true});
assert.equal(promo.status,200,'Admin puede crear promoción');
const settings={hero_text:'Portada de ensayo Bellaquitas',announcement:'Aviso de ensayo',translations:{fr:{hero_text:'Accueil de test'}},ui_copy:{fr:{Inicio:'Accueil'}}};
assert.equal((await call({kind:'site_drafts',action:'save',settings},sa,{enable:true})).status,200);
assert.equal(JSON.parse(db.prepare("SELECT settings FROM site_drafts WHERE key='homepage'").get().settings).translations.fr.hero_text,'Accueil de test');
assert.equal((await call({kind:'site_content',action:'publish',settings},sb,{enable:true})).status,200);
assert.equal(db.prepare("SELECT hero_text FROM site_content WHERE key='homepage'").get().hero_text,settings.hero_text);
assert.equal((await call({kind:'media',action:'remove'},sa,{enable:true})).status,409,'Borrado multimedia bloqueado');
assert.equal((await call({},sa,{upload:true,enable:true})).status,423,'Subida directa sin R2 bloqueada');
assert.equal((await call({kind:'catalog',table:'rewards',action:'insert',item:{
 name:'Inválida',cost:-100,active:true
}},sa,{enable:true})).status,409,'No aceptar costes negativos');
assert.equal((await call({kind:'catalog',table:'events',action:'delete',id:created.body.id},sa,{enable:true})).status,200);
assert.equal(db.prepare('SELECT COUNT(*) n FROM events').get().n,0);
assert.deepEqual(db.prepare("SELECT id,role,points,lifetime_points,visits FROM profiles ORDER BY id").all(),original,
 'Ninguna prueba del editor puede cambiar puntos, roles, visitas o perfiles');
console.log('OK: editor sintético 2 admins, eventos crear/editar/desactivar/borrar, premios, promos, borradores y ES/FR; 0 puntos/visitas/roles alterados.');
