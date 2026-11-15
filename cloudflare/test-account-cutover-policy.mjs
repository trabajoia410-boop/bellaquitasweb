#!/usr/bin/env node
// Bellaquitas Fest — 100% sintético: prueba política que protege usuarios,
// vínculos Google, email verificado, puntos y visitas en el delta de migración.
import assert from 'node:assert/strict';
import {planAccountCutover} from './plan-account-cutover.mjs';
const profile=(id,role,points=0,visits=0)=>({
 id,name:'Usuario ficticio '+id,role,member_code:'COD-'+id,
 points,lifetime_points:points,visits,created_at:'2026-01-01'
});
const origin={
 profiles:[profile('ga','admin',999999),profile('gb','admin',999999),
  ...['gc','gd','ge','gf'].map(id=>profile(id,'socio'))],
 auth_identity_links:['ga','gb','gc','gd','ge','gf'].map(id=>({
  id:'link-'+id,provider:'google',provider_subject:'fake-google-'+id,profile_id:id
 })),
 auth_email_credentials:[]
};
const local=profile('local','socio');
const emailIdentity={
 id:'link-local',provider:'email',provider_subject:'local@example.invalid',profile_id:'local'
};
const emailCredential={
 email:'local@example.invalid',profile_id:'local',
 password_hash:'hash-ficticio',password_salt:'sal-ficticia',
 password_iterations:600000,verified_at:1,created_at:1,updated_at:1
};
const stage={
 profiles:[...origin.profiles.map(x=>({...x})),local],
 auth_identity_links:[...origin.auth_identity_links.map(x=>({...x})),emailIdentity],
 auth_email_credentials:[emailCredential]
};
const clone=x=>structuredClone(x);
const ok=planAccountCutover({origin,staging:stage});
assert.deepEqual([
 ok.sharedProfiles,ok.newOriginProfiles,ok.localProfilesRetained,
 ok.resultingProfiles,ok.resultingAdmins,ok.resultingPoints,ok.resultingVisits,
 ok.credentialProfiles,ok.identities
],[6,0,1,7,2,1999998,0,1,7]);
assert.equal(ok.dryRun,true);assert.equal(ok.readyForProduction,false);
assert.ok(!JSON.stringify(ok).includes('@'),'Nunca mostrar email');
assert.deepEqual(stage.auth_email_credentials,[emailCredential],'No mutar contraseña local');
assert.deepEqual(stage.profiles.at(-1),local,'No borrar socio de staging');
const newOrigin=clone(origin);
newOrigin.profiles.push(profile('nuevo','socio',14,1));
newOrigin.auth_identity_links.push({
 id:'link-nuevo',provider:'google',provider_subject:'google-nuevo',profile_id:'nuevo'
});
const delta=planAccountCutover({origin:newOrigin,staging:stage});
assert.equal(delta.resultingProfiles,8,'Preservar la alta del origen posterior a la importación');
assert.equal(delta.localProfilesRetained,1,'Preservar el socio de email exclusivo de staging');
assert.equal(delta.newOriginProfiles,1);
assert.equal(delta.resultingPoints,2000012);
assert.equal(delta.resultingVisits,1);
function blocks(mutate,pattern){
 const a=clone(origin),b=clone(stage);
 mutate(a,b);
 assert.throws(()=>planAccountCutover({origin:a,staging:b}),pattern);
}
blocks((a,b)=>{a.profiles[0].points+=1},/divergentes/);
blocks((a,b)=>{a.profiles[0].role='socio'},/divergentes/);
blocks((a,b)=>{a.profiles[1].visits+=1},/divergentes/);
blocks((a,b)=>{b.profiles[6].member_code=b.profiles[0].member_code},/duplicado/);
blocks((a,b)=>{a.profiles[0].member_code=b.profiles[6].member_code},/duplicado/);
blocks((a,b)=>{a.auth_identity_links[0].profile_id='gb'},/proveedor|identidad|duplicad/i);
blocks((a,b)=>{b.auth_email_credentials[0].profile_id='ga'},/credencial/i);
blocks((a,b)=>{b.auth_email_credentials[0].password_hash='otro-hash';
 a.auth_email_credentials.push({...b.auth_email_credentials[0]});
 a.auth_identity_links.push({...emailIdentity,profile_id:'ga'});},/identidad|credencial|proveedor/i);
blocks((a,b)=>{b.auth_email_credentials=[]},/credencial/);
blocks((a,b)=>{b.auth_email_credentials[0].verified_at=0},/verificar/);
blocks((a,b)=>{b.auth_identity_links.push({...emailIdentity,id:'duplicado'})},/duplicada/);
blocks((a,b)=>{b.profiles[6].points=-1},/válidos/);
console.log('OK: 12 ataques/colisiones ficticias bloqueadas; seis Google + un email local conservados; altas tardías y puntos preservados; no hay accesos ni escrituras.');
