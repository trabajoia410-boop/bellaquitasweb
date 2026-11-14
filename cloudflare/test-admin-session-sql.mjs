#!/usr/bin/env node
/* Prueba del SQL de sesión sobre SQLite en memoria.
 * No necesita red, D1, perfiles reales ni credenciales.
 */
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {authenticatedProfile} from './auth-routes.js';
const src=readFileSync('cloudflare/auth-routes.js','utf8');
assert.ok(src.includes("s.created_at>=unixepoch()-?"),'Usar timestamps numéricos');
assert.ok(!src.includes("s.created_at>=datetime("),'La comparación de texto bloqueaba administradores');
const db=new DatabaseSync(':memory:');
db.exec('CREATE TABLE profiles(id TEXT PRIMARY KEY,name TEXT NOT NULL,role TEXT NOT NULL,member_code TEXT,points INTEGER NOT NULL DEFAULT 0,lifetime_points INTEGER NOT NULL DEFAULT 0,visits INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL DEFAULT (unixepoch())); CREATE TABLE auth_sessions(token_hash TEXT PRIMARY KEY,profile_id TEXT NOT NULL,expires_at INTEGER NOT NULL,created_at INTEGER NOT NULL DEFAULT(unixepoch()));');
const toBase64url=x=>Buffer.from(x).toString('base64url');
const env={DB:{prepare(sql){return {bind(...params){return {async first(){return db.prepare(sql).get(...params)||null;}}}}}}};
const input=[
 {id:'11111111-1111-4111-8111-111111111111',name:'Admin reciente',role:'admin',issuedAgo:60,expected:true},
 {id:'22222222-2222-4222-8222-222222222222',name:'Admin antiguo',role:'admin',issuedAgo:13*3600,expected:false},
 {id:'33333333-3333-4333-8333-333333333333',name:'Socio normal',role:'socio',issuedAgo:13*3600,expected:true}
];
for(const [i,p] of input.entries()){
 const raw=toBase64url(Buffer.alloc(32,i+1));
 const hash=toBase64url(createHash('sha256').update(raw).digest());
 db.prepare('INSERT INTO profiles(id,name,role,member_code) VALUES(?,?,?,?)').run(p.id,p.name,p.role,'MBR-FAKE'+i);
 db.prepare('INSERT INTO auth_sessions(token_hash,profile_id,expires_at,created_at) VALUES(?,?,unixepoch()+7200,unixepoch()-?)').run(hash,p.id,p.issuedAgo);
 const actual=await authenticatedProfile(new Request('https://example.test/v1/auth/me',{headers:{Cookie:'__Host-bf_session='+raw}}),env);
 assert.equal(!!actual,p.expected,p.name);
 if(p.expected)assert.equal(actual.id,p.id);
}
assert.equal(db.prepare('SELECT count(*) AS c FROM profiles').get().c,3);
db.close();
console.log('OK: admin reciente válido; admin antiguo caducado; socio normal válido. Datos ficticios SQLite :memory:.');
