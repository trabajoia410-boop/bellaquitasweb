#!/usr/bin/env node
/**
 * Bellaquitas Fest — política de fusión de cuentas en el cambio de origen.
 * Dry-run sobre DOS snapshots de un origen autorizado y D1 staging, siempre offline.
 * Conserva tanto las altas del origen como las locales a staging: no borra, ni
 * sobrescribe puntos, ni imprime emails, IDs, hashes o contraseñas.
 * La implementación real solo puede hacerse tras una nueva copia de producción.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

const REQUIRED=['profiles','auth_identity_links','auth_email_credentials'];
const PROFILE_FIELDS=['name','role','member_code','points','lifetime_points','visits'];
const CREDENTIAL_FIELDS=['password_hash','password_salt','password_iterations','verified_at'];
const id=x=>typeof x==='string'&&x.trim().length>0;
const email=x=>String(x||'').trim().toLowerCase();
function checkSnapshot(s,name){
 assert.ok(s&&typeof s==='object'&&!Array.isArray(s),'Snapshot inválido: '+name);
 for(const k of REQUIRED)assert.ok(Array.isArray(s[k]),'Falta array '+name+'.'+k);
 const profiles=new Map();
 const codes=new Map();
 for(const p of s.profiles){
  assert.ok(id(p.id)&&id(p.member_code)&&id(p.role),'Perfil incompleto');
  assert.ok(!profiles.has(p.id),'ID de perfil duplicado en '+name);
  assert.ok(!codes.has(p.member_code),'Código de socio duplicado en '+name);
  for(const k of ['points','lifetime_points','visits']){
   assert.ok(Number.isSafeInteger(p[k])&&p[k]>=0,'Saldo o visitas no válidos');
  }
  profiles.set(p.id,p); codes.set(p.member_code,p.id);
 }
 const bySubject=new Map(),byProfileProvider=new Map();
 for(const row of s.auth_identity_links){
  assert.ok(id(row.provider)&&id(row.provider_subject)&&id(row.profile_id),'Identidad incompleta');
  assert.ok(profiles.has(row.profile_id),'Identidad sin perfil');
  const key=row.provider+'\u0000'+row.provider_subject;
  const owner=row.provider+'\u0000'+row.profile_id;
  assert.ok(!bySubject.has(key),'Identidad duplicada en '+name);
  assert.ok(!byProfileProvider.has(owner),'Proveedor duplicado en un perfil');
  bySubject.set(key,row.profile_id);byProfileProvider.set(owner,row.provider_subject);
 }
 const credentials=new Map();
 for(const row of s.auth_email_credentials){
  const key=email(row.email);
  assert.ok(key.includes('@')&&id(row.profile_id)&&profiles.has(row.profile_id),'Credencial sin perfil');
  assert.ok(!credentials.has(key),'Correo duplicado en '+name);
  assert.ok(CREDENTIAL_FIELDS.every(k=>row[k]!==null&&row[k]!==undefined&&row[k]!==''),'Credencial incompleta');
  assert.ok(row.verified_at>0,'Correo sin verificar no se puede fusionar automáticamente');
  assert.equal(bySubject.get('email\u0000'+key),row.profile_id,
   'Credencial no vinculada a su identidad email');
  credentials.set(key,row);
 }
 return {profiles,codes,bySubject,byProfileProvider,credentials};
}

export function planAccountCutover({origin,staging}){
 const src=checkSnapshot(origin,'origen'),dst=checkSnapshot(staging,'staging');
 const conflict=(msg)=>{throw new Error('CORTE BLOQUEADO: '+msg+' (sin IDs, emails ni datos privados)');};
 const combined=new Map(dst.profiles);
 let shared=0,addOrigin=0,keepLocal=0;
 for(const [pid,p] of src.profiles){
  const prev=combined.get(pid);
  if(prev){
   shared++;
   if(PROFILE_FIELDS.some(k=>prev[k]!==p[k]))
    conflict('campos, puntos, rol o visitas divergentes; conciliación manual');
  }else{combined.set(pid,p);addOrigin++;}
 }
 for(const [pid] of dst.profiles)if(!src.profiles.has(pid))keepLocal++;
 // No permitir que dos cuentas compartan códigos de miembro.
 const codes=new Map();
 for(const p of combined.values()){
  if(codes.has(p.member_code)&&codes.get(p.member_code)!==p.id)conflict('código de socio duplicado');
  codes.set(p.member_code,p.id);
 }
 // Las identidades Google y email pertenecen a un único perfil, incluso
 // cuando su cuenta se creó después de la carga inicial.
 const subjects=new Map(),ownerProvider=new Map();
 for(const source of [origin,staging]){
  for(const x of source.auth_identity_links){
   const key=x.provider+'\u0000'+x.provider_subject;
   const owner=x.provider+'\u0000'+x.profile_id;
   if(subjects.has(key)&&subjects.get(key)!==x.profile_id)conflict('misma identidad en dos perfiles');
   if(ownerProvider.has(owner)&&ownerProvider.get(owner)!==x.provider_subject)
    conflict('dos identidades distintas del mismo proveedor para un perfil');
   subjects.set(key,x.profile_id);ownerProvider.set(owner,x.provider_subject);
  }
 }
 const mergedCredentials=new Map();
 for(const source of [origin,staging]){
  for(const c of source.auth_email_credentials){
   const key=email(c.email),prev=mergedCredentials.get(key);
   if(prev){
    if(prev.profile_id!==c.profile_id)conflict('mismo correo atribuido a dos perfiles');
    if(CREDENTIAL_FIELDS.some(k=>prev[k]!==c[k]))conflict('contraseña/correo modificado desde la foto inicial');
   }else mergedCredentials.set(key,c);
  }
 }
 for(const [emailKey,c] of mergedCredentials){
  if(subjects.get('email\u0000'+emailKey)!==c.profile_id)conflict('credenciales e identidad no coinciden');
 }
 const extraProfiles=[...dst.profiles.values()].filter(p=>!src.profiles.has(p.id));
 for(const p of extraProfiles){
  const providerKeys=[...dst.byProfileProvider.keys()].filter(k=>k.endsWith('\u0000'+p.id));
  if(providerKeys.length===0)conflict('perfil local sin identidad verificable');
  if(providerKeys.some(k=>k.startsWith('email\u0000'))&&
     ![...dst.credentials.values()].some(c=>c.profile_id===p.id))
   conflict('perfil extra de email perdería su credencial');
 }
 const merged=[...combined.values()];
 const points=merged.reduce((n,p)=>n+p.points,0);
 const visits=merged.reduce((n,p)=>n+p.visits,0);
 assert.ok(Number.isSafeInteger(points)&&Number.isSafeInteger(visits),'Sumas fuera de rango');
 return Object.freeze({
  policy:'preservar-origen-y-staging-sin-sobrescribir',
  dryRun:true,approvedPolicyOnly:true,readyForProduction:false,
  originProfiles:src.profiles.size,stagingProfiles:dst.profiles.size,
  sharedProfiles:shared,newOriginProfiles:addOrigin,localProfilesRetained:keepLocal,
  resultingProfiles:merged.length,resultingPoints:points,resultingVisits:visits,
  resultingAdmins:merged.filter(p=>p.role==='admin').length,
  credentialProfiles:mergedCredentials.size,identities:subjects.size,
  audit:'sin mutaciones; se requiere exportación final del origen y reconciliación nueva'
 });
}
function main(){
 assert.equal(process.argv.length,4,'Uso: node cloudflare/plan-account-cutover.mjs origen-privado.json staging-privado.json');
 const origin=JSON.parse(readFileSync(process.argv[2],'utf8'));
 const staging=JSON.parse(readFileSync(process.argv[3],'utf8'));
 console.log(JSON.stringify(planAccountCutover({origin,staging}),null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{main();}catch(error){console.error(String(error.message).replace(/([a-z0-9._%+-]+)@([a-z0-9.-]+)/gi,'[correo oculto]'));process.exitCode=1;}
}
