#!/usr/bin/env node
// Prueba enteramente en memoria de autorización (sin cuentas reales ni peticiones HTTP).
import assert from 'node:assert/strict';
import {createVerifiedAdminSession,authenticatedAdminAccess} from './auth-routes.js';
const id1='11111111-1111-4111-8111-111111111111';
const id2='22222222-2222-4222-8222-222222222222';
const member='33333333-3333-4333-8333-333333333333';
class MockD1 {
 constructor(){this.profiles=new Map([[id1,{id:id1,name:'Admin test A',role:'admin'}],[id2,{id:id2,name:'Admin test B',role:'admin'}],[member,{id:member,name:'Socio test',role:'socio'}]]);this.sessions=new Map();this.adminSessions=new Map();}
 prepare(sql){
  const db=this;
  return {bind(...args){return {
   async first(){
    if(sql.startsWith('SELECT role FROM profiles'))return db.profiles.get(args[0])||null;
    if(sql.includes('FROM auth_sessions s JOIN profiles p')) {
     const s=db.sessions.get(args[0]);return s&&s.expires_at>Date.now()/1000?db.profiles.get(s.profile_id)||null:null;
    }
    if(sql.includes('FROM auth_admin_sessions WHERE token_hash=')){
     const row=db.adminSessions.get(args[0]);
     return row&&row.profile_id===args[1]&&row.regular_session_hash===args[2]&&row.expires_at>Date.now()/1000?{ok:1}:null;
    }
    throw Error('Unexpected first: '+sql);
   },
   async run(){
    if(sql.startsWith('INSERT INTO auth_sessions')){
     db.sessions.set(args[0],{profile_id:args[1],expires_at:Date.now()/1000+args[2]});return {success:true};
    }
    if(sql.startsWith('INSERT INTO auth_admin_sessions')){
     db.adminSessions.set(args[0],{profile_id:args[1],regular_session_hash:args[2],expires_at:Date.now()/1000+args[3]});return {success:true};
    }
    throw Error('Unexpected run: '+sql);
   }
  }}};
 }
 async batch(queries){return Promise.all(queries.map(x=>x.run()));}
}
const env={DB:new MockD1()};
function makeRequest(cookies){
 const value=cookies.map(c=>c.split(';')[0]).join('; ');
 return new Request('https://bellaquitas.test/v1/admin/session',{headers:{Cookie:value}});
}
const issued=await createVerifiedAdminSession(id1,env);
assert.equal(issued.length,2);
assert.match(issued[0],/__Host-bf_session=.*Secure; HttpOnly; SameSite=Lax/);
assert.match(issued[1],/__Host-bf_admin=.*Secure; HttpOnly; SameSite=Lax/);
assert.equal(await authenticatedAdminAccess(makeRequest([]),env),null,'No auth must fail');
assert.equal(await authenticatedAdminAccess(makeRequest([issued[0]]),env),null,'Ordinary session must fail');
assert.equal((await authenticatedAdminAccess(makeRequest(issued),env))?.id,id1,'Fresh step-up must work');
const other=await createVerifiedAdminSession(id2,env);
assert.equal(await authenticatedAdminAccess(makeRequest([issued[0],other[1]]),env),null,'Mixed cookies must fail');
await assert.rejects(()=>createVerifiedAdminSession(member,env),/forbidden/,'Normal member must not get admin');
for(const x of env.DB.adminSessions.values())x.expires_at=0;
assert.equal(await authenticatedAdminAccess(makeRequest(issued),env),null,'Expired step-up must fail');
console.log('OK: acceso admin requiere sesión + reautenticación; cookies mezcladas, usuarios normales y expiración bloqueados.');
