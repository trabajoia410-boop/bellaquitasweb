#!/usr/bin/env node
/** Synthetic-only tests: no user identity, API secret, database or deployment. */
import assert from "node:assert/strict";
import {
  auditBlocks23,REQUIRED_TABLES,REQUIRED_TRIGGERS
} from "./phase6-blocks23-preflight.mjs";
const baseline={
  profiles:7, admins:2, points:1999998,lifetimePoints:1999998,visits:0,
  identityGoogle:6,identityEmail:1,identityDistinctProfiles:7
};
const qa={
  profiles:0,clerkLinks:0, walletTables:[...REQUIRED_TABLES],
  walletTriggers:[...REQUIRED_TRIGGERS],walletCustomers:0,walletStamps:0
};
const target={
  ...baseline, walletTables:[...REQUIRED_TABLES],
  walletTriggers:[...REQUIRED_TRIGGERS],walletCustomers:0,walletStamps:0,
  clerkLinks:7,clerkConfirmedLinks:7,clerkConfirmedAdmins:2,
  clerkVerifiedGoogle:6,clerkVerifiedEmail:1
};
const clerk={productionUsers:7,domainComplete:true,googleOauthConfigured:true};
const evidence={
  baselineBackupRestored:true,
  targetPostMigrationBackupRestored:true,
  backupKeyCustodyConfirmed:true,
  clerkIndependentSubjectProofVerified:true,
  adminStepupRealQaPassed:true,
  externalSourceDeltaReconciled:true
};
const valid={baseline,qa,target,clerk,evidence};
assert.equal(auditBlocks23(valid).readyForPublication,true,
 "Only a wholly VERIFIED synthetic gate can pass");
const current={
 ...valid,
 target:{...baseline,walletTables:[],walletTriggers:[],
  clerkLinks:0,clerkConfirmedLinks:0,clerkConfirmedAdmins:0,
  clerkVerifiedGoogle:0,clerkVerifiedEmail:0},
 clerk:{...clerk,productionUsers:0},
 evidence:{...evidence,targetPostMigrationBackupRestored:false,
  clerkIndependentSubjectProofVerified:false,adminStepupRealQaPassed:false,
  externalSourceDeltaReconciled:false}
};
const now=auditBlocks23(current);
assert.equal(now.qaReady,true,"The real QA schema is isolated and complete");
assert.equal(now.readyForPublication,false,"QA does NOT equal production");
assert.equal(now.walletReady,false);
assert.equal(now.clerkReady,false);
assert.equal(now.backupReady,false);
assert.equal(now.originReady,false);
assert.ok(now.pending.includes("prepared-d1-wallet-schema"));
assert.ok(now.pending.includes("seven-verified-clerk-identities-two-admins"));
for (const [part,key,val] of [
  ["baseline","profiles",6],["baseline","admins",1],
  ["baseline","identityGoogle",7],["baseline","identityEmail",0],
  ["baseline","identityDistinctProfiles",6],
  ["target","profiles",8],["target","admins",1],
  ["target","points",1999997],["target","lifetimePoints",1999997],
  ["target","visits",1],["target","identityGoogle",5],
  ["target","clerkLinks",6],["target","clerkConfirmedLinks",6],
  ["target","clerkConfirmedAdmins",1],
  ["target","clerkVerifiedGoogle",5],["target","clerkVerifiedEmail",0],
  ["clerk","productionUsers",0],["clerk","domainComplete",false],
  ["clerk","googleOauthConfigured",false],
  ["evidence","baselineBackupRestored",false],
  ["evidence","targetPostMigrationBackupRestored",false],
  ["evidence","backupKeyCustodyConfirmed",false],
  ["evidence","clerkIndependentSubjectProofVerified",false],
  ["evidence","adminStepupRealQaPassed",false],
  ["evidence","externalSourceDeltaReconciled",false]
]){
 const copy=structuredClone(valid);copy[part][key]=val;
 assert.equal(auditBlocks23(copy).readyForPublication,false,
  "Release MUST fail for "+part+"."+key);
}
for(const [part,key,change] of [
  ["qa","walletTables",x=>x.slice(1)],
  ["qa","walletTriggers",x=>x.slice(1)],
  ["target","walletTables",x=>[...x.slice(0,-1),x[0]]],
  ["target","walletTriggers",x=>[...x,"wallet_fake"]],
  ["target","walletCustomers",()=>-1],
  ["qa","profiles",()=>1]
]){
 const copy=structuredClone(valid);copy[part][key]=change(copy[part][key]);
 assert.equal(auditBlocks23(copy).readyForPublication,false,
  "Schema fail-closed for "+part+"."+key);
}
for(const missing of ["qa","baseline","target","clerk","evidence"]){
 const copy={...valid,[missing]:undefined};
 assert.equal(auditBlocks23(copy).readyForPublication,false,
  "Missing "+missing+" can never publish");
}
assert.equal(auditBlocks23(undefined).readyForPublication,false);
assert.equal(auditBlocks23(valid).pending.length,0);
console.log("PASS: 13 Wallet tables, 4 triggers, 7 originals, 2 admins, Clerk subject proof, backup and origin delta; 35+ fail-closed cases.");
