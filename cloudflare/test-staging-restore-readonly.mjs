#!/usr/bin/env node
// Sólo datos ficticios SQLite-like. No token Cloudflare, no personas, no red.
import assert from 'node:assert/strict';
import {equalRows,compareSnapshots,verifyStagingRestore} from './verify-staging-restore-readonly.mjs';

const fixtures=()=>({
 objects:[
  {type:'table',name:'profiles',tbl_name:'profiles',sql:'CREATE TABLE profiles(id TEXT PRIMARY KEY,points INTEGER)'},
  {type:'table',name:'auth_identity_links',tbl_name:'auth_identity_links',sql:'CREATE TABLE auth_identity_links(profile_id TEXT,provider TEXT)'},
  {type:'table',name:'auth_email_credentials',tbl_name:'auth_email_credentials',sql:'CREATE TABLE auth_email_credentials(profile_id TEXT,email TEXT)'},
  {type:'index',name:'idx_profiles',tbl_name:'profiles',sql:'CREATE INDEX idx_profiles ON profiles(points)'},
  {type:'trigger',name:'trg_profiles',tbl_name:'profiles',sql:"CREATE TRIGGER trg_profiles AFTER UPDATE ON profiles BEGIN SELECT 1; END"}
 ],
 rows:{
  profiles:[
   {id:'fake-google-admin-A',points:21},
   {id:'fake-google-admin-B',points:32},
   {id:'fake-stage-member-email',points:0}
  ],
  auth_identity_links:[
   {profile_id:'fake-google-admin-A',provider:'google'},
   {profile_id:'fake-google-admin-B',provider:'google'},
   {profile_id:'fake-stage-member-email',provider:'email'}
  ],
  auth_email_credentials:[{profile_id:'fake-stage-member-email',email:'fake@example.test'}]
 }
});
const clone=x=>JSON.parse(JSON.stringify(x));
const baseline=fixtures(),identical=clone(baseline);
identical.rows.profiles.reverse();
identical.rows.auth_identity_links.reverse();
identical.objects.reverse();
assert.ok(equalRows(baseline.rows.profiles,identical.rows.profiles));
assert.equal(compareSnapshots(baseline,identical).equal,true);

const loss=clone(baseline);
loss.rows.profiles=loss.rows.profiles.filter(x=>x.id!=='fake-stage-member-email');
assert.equal(compareSnapshots(baseline,loss).equal,false,'Debe detectar eliminación del socio');
const credentialsLost=clone(baseline);
credentialsLost.rows.auth_email_credentials=[];
assert.equal(compareSnapshots(baseline,credentialsLost).equal,false,'Debe detectar pérdida del email verificado');
const pointsChanged=clone(baseline);
pointsChanged.rows.profiles[0].points=999999;
assert.equal(compareSnapshots(baseline,pointsChanged).equal,false,'Debe detectar modificación de puntos');
const triggerMissing=clone(baseline);
triggerMissing.objects=triggerMissing.objects.filter(x=>x.type!=='trigger');
assert.equal(compareSnapshots(baseline,triggerMissing).equal,false,'Debe detectar trigger ausente');

const stageId='c7ada9c9-d397-4e22-b5b8-3fbd8d13e550';
const restoredId='c4356f11-0407-4c83-95cb-53d8056e0a28';
const mock=(source,target)=>async(db,sql)=>{
 const snap=db===stageId?source:db===restoredId?target:null;
 assert.ok(snap,'No consultar otros entornos');
 if(sql.includes('sqlite_master'))return clone(snap.objects);
 if(sql==='PRAGMA foreign_key_check')return [];
 if(sql.includes('COUNT(*) AS n FROM profiles p')){
  const google=new Set(snap.rows.auth_identity_links.filter(x=>x.provider==='google').map(x=>x.profile_id));
  return [{n:snap.rows.profiles.filter(x=>!google.has(x.id)).length}];
 }
 const table=sql.match(/^SELECT \* FROM "([a-z_]+)"$/)?.[1];
 assert.ok(table&&Object.hasOwn(snap.rows,table),'La auditoría solo puede consultar datos');
 return clone(snap.rows[table]);
};
let r=await verifyStagingRestore(mock(baseline,identical));
assert.equal(r.equal,true);
assert.equal(r.localEmailAccounts,1);
assert.equal(r.tableCount,3);
assert.equal(r.sourceRecords,7);
r=await verifyStagingRestore(mock(baseline,loss));
assert.equal(r.equal,false);
r=await verifyStagingRestore(mock(baseline,credentialsLost));
assert.equal(r.equal,false);
const noMember=clone(baseline);
noMember.rows.profiles=noMember.rows.profiles.filter(x=>x.id!=='fake-stage-member-email');
noMember.rows.auth_identity_links=noMember.rows.auth_identity_links.filter(x=>x.profile_id!=='fake-stage-member-email');
noMember.rows.auth_email_credentials=[];
r=await verifyStagingRestore(mock(noMember,clone(noMember)));
assert.equal(r.equal,false,'Incluso copias iguales no son seguras si desaparece el socio local');
assert.ok(r.errors.some(x=>x.includes('cuentas exclusivas')));
console.log('OK: verificación solo lectura detecta pérdida de socio email, hash de identidad, puntos, trigger y discrepancias; sin datos reales ni token.');
