#!/usr/bin/env node
/**
 * Planificador PURO/offline de vinculación Google antigua -> Clerk.
 * Acepta datos ya verificados de D1 (auth_identity_links) y registros Clerk
 * consultados por Backend API desde una fuente autorizada.
 * Nunca enlazar por email, nombre, role, points, ni solo por external_id.
 * No escribe en D1/Clerk y no imprime identidades reales.
 */
import assert from "node:assert/strict";
export function planClerkVerifiedLinks({originalGoogleLinks,clerkUsers}){
 assert.ok(Array.isArray(originalGoogleLinks)&&Array.isArray(clerkUsers));
 const source=new Map();
 const originalProfileIds=new Set();
 for(const row of originalGoogleLinks){
  assert.equal(row.provider,"google");
  assert.match(row.provider_subject||"",/^[0-9]{1,64}$/);
  assert.match(row.profile_id||"",/^[0-9a-f-]{36}$/i);
  assert.ok(!source.has(row.provider_subject),"Google subject repetido en origen");
  assert.ok(!originalProfileIds.has(row.profile_id),"Perfil original con dos Google");
  source.set(row.provider_subject,row.profile_id);
  originalProfileIds.add(row.profile_id);
 }
 const matched=[],clerkSeen=new Set(),profileSeen=new Set(),unknown=[];
 for(const person of clerkUsers){
  assert.match(person.id||"",/^user_[A-Za-z0-9]{10,128}$/);
  assert.ok(!clerkSeen.has(person.id),"Clerk user duplicado");
  clerkSeen.add(person.id);
  const providers=(person.externalAccounts??person.external_accounts??[]);
  assert.ok(Array.isArray(providers));
  const google=providers.filter(x=>(x.provider==="google"||x.provider==="oauth_google")&&
    x.verification?.status==="verified"&&
    typeof x.providerUserId==="string");
  if(google.length>1)throw Error("Cuenta Clerk con varias identidades Google verificadas");
  if(google.length===0){unknown.push("sin-google-verificado");continue;}
  const subject=google[0].providerUserId;
  if(!/^[0-9]{1,64}$/.test(subject))throw Error("Google subject Clerk inválido");
  const profileId=source.get(subject);
  if(!profileId){unknown.push("nuevo-usuario");continue;}
  if(profileSeen.has(profileId))throw Error("Dos usuarios Clerk para un perfil antiguo");
  profileSeen.add(profileId);
  matched.push(Object.freeze({
   clerkUserId:person.id,profileId,method:"migration_confirmed",
   evidenceProvider:"google",evidenceSubject:subject,
   verifiedAtRequiredAtInsertion:true
  }));
 }
 const pending=originalGoogleLinks.length-matched.length;
 assert.ok(pending>=0);
 return Object.freeze({complete:pending===0&&unknown.length===0,
  dryRun:true,links:matched,originalGoogleAccounts:originalGoogleLinks.length,
  clerkUsers:clerkUsers.length,verifiedGoogleMatches:matched.length,
  pendingOriginal:pending,unlinkedClerkUsers:unknown.length,
  adminApproved:false,productionWriteAuthorized:false,
  note:"Solo emparejamiento de subject OAuth Google verificado; no corresponde por email ni transfiere sesiones/puntos."});
}
