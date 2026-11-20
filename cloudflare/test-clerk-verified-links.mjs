#!/usr/bin/env node
import assert from "node:assert/strict";
import {planClerkVerifiedLinks} from "./plan-clerk-verified-links.mjs";
const uuid=x=>"00000000-0000-4000-8000-"+String(x).padStart(12,"0");
const original=Array.from({length:6},(_,i)=>({
 provider:"google",provider_subject:String(1000000000000+i),profile_id:uuid(i+1)
}));
const users=original.map((x,i)=>({
 id:"user_"+String(i+1).repeat(20),
 emailAddresses:[{emailAddress:"possible-duplicate@example.test"}],
 externalAccounts:[{provider:"google",providerUserId:x.provider_subject,verification:{status:"verified"}}]
}));
const actual=planClerkVerifiedLinks({originalGoogleLinks:original,clerkUsers:users});
assert.equal(actual.complete,true);
assert.equal(actual.verifiedGoogleMatches,6);
assert.equal(actual.pendingOriginal,0);
assert.equal(actual.dryRun,true);
assert.equal(actual.productionWriteAuthorized,false);
assert.equal(actual.adminApproved,false);
assert.equal(actual.links.length,6);
assert.deepEqual(actual.links.map(x=>x.profileId),original.map(x=>x.profile_id));
const noUsers=planClerkVerifiedLinks({originalGoogleLinks:original,clerkUsers:[]});
assert.equal(noUsers.pendingOriginal,6);
assert.equal(noUsers.complete,false);
const emailOnly=users.map(x=>({id:x.id,emailAddresses:x.emailAddresses,externalAccounts:[]}));
assert.equal(planClerkVerifiedLinks({originalGoogleLinks:original,clerkUsers:emailOnly}).verifiedGoogleMatches,0,
 "Coincidencia de email no puede dar puntos de perfiles antiguos");
assert.equal(planClerkVerifiedLinks({originalGoogleLinks:original,clerkUsers:[{
 id:users[0].id,externalAccounts:[{provider:"google",providerUserId:original[0].provider_subject,verification:{status:"unverified"}}]
}]}).verifiedGoogleMatches,0,"Un enlace no verificado nunca autoriza perfil");
assert.throws(()=>planClerkVerifiedLinks({originalGoogleLinks:original,
 clerkUsers:[users[0],{...users[0],id:"user_otherclerkid12345"}]}),/Dos usuarios Clerk/);
assert.throws(()=>planClerkVerifiedLinks({originalGoogleLinks:original,
 clerkUsers:[users[0],users[0]]}),/duplicado/);
assert.throws(()=>planClerkVerifiedLinks({originalGoogleLinks:[...original,original[0]],
 clerkUsers:users}),/repetido/);
assert.throws(()=>planClerkVerifiedLinks({originalGoogleLinks:original,
 clerkUsers:[{id:"user_malformed4567890",externalAccounts:[
 {provider:"google",providerUserId:original[0].provider_subject,verification:{status:"verified"}},
 {provider:"google",providerUserId:original[1].provider_subject,verification:{status:"verified"}}
 ]}]}),/varias identidades/);
console.log("PASS: 6 Google original->Clerk por providerUserId exacto, 0 enlaces por email; rechaza suplantación y duplicados sin escritura.");
