#!/usr/bin/env node
/** Ficheros ficticios 100% offline; nunca recuperar datos de usuarios reales. */
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {inspectSql,inspectLocalFile} from './audit-production-export.mjs';
const synthetic=`
CREATE TABLE public.profiles (id text, points integer, visits integer, role text);
CREATE TABLE auth.users (id text, provider_subject text);
INSERT INTO public.profiles VALUES ('SIMULADO', 0, 0, 'admin');
COPY auth.users (id, provider_subject) FROM stdin;
IDENTIDAD_FALSA  PROVEEDOR_FALSO
\\.
`;
const ok=inspectSql(synthetic);
assert.equal(ok.structureReadyForHumanReview,true);
assert.equal(ok.sourceProvenanceCertified,false);
assert.equal(ok.originalProductionBackupCertified,false);
assert.equal(ok.createdTables,2);
assert.equal(ok.dataStatements,2);
const missingAuth=inspectSql(`
CREATE TABLE public.profiles (id text, points int, visits int);
CREATE TABLE public.events (id text);
INSERT INTO public.profiles VALUES ('SIMULADO',1,0);
INSERT INTO public.events VALUES ('DEMO');
`);
assert.equal(missingAuth.structureReadyForHumanReview,false,'Sin identidades no se preservan accesos');
assert.ok(missingAuth.blockingReasons.some(x=>x.includes('identidades')));
const schemaOnly=inspectSql(`
CREATE TABLE public.profiles (id text, points int, visits int);
CREATE TABLE auth.users (id text);
`);
assert.equal(schemaOnly.structureReadyForHumanReview,false,'No confundir schema-only con backup');
const noVisits=inspectSql(`
CREATE TABLE public.profiles (id text, points int);
CREATE TABLE auth.users (id text);
INSERT INTO public.profiles VALUES ('FAKE',1);
INSERT INTO auth.users VALUES ('FAKE');
`);
assert.equal(noVisits.structureReadyForHumanReview,false);
const commented=inspectSql(`
-- CREATE TABLE auth.users (id text);
-- INSERT INTO auth.users VALUES ('SINTETICO');
CREATE TABLE public.profiles(id text,points int,visits int);
CREATE TABLE public.events (id text);
INSERT INTO public.profiles VALUES ('FAKE', 1, 2);
`);
assert.equal(commented.containsIdentityStructure,false,'Ignorar el SQL comentado');
const tmp=mkdtempSync(join(tmpdir(),'bf-offline-original-'));
try{
 const file=join(tmp,'ficticio.sql');
 writeFileSync(file,synthetic,{mode:0o600});
 const result=inspectLocalFile(file);
 assert.equal(result.structureReadyForHumanReview,true);
 assert.equal(result.offlineOnly,true);
 assert.equal(result.noRecordsPrinted,true);
 assert.match(result.sha256,/^[0-9a-f]{64}$/);
 const corrupt=join(tmp,'invalid.sql');
 writeFileSync(corrupt,Buffer.from([0,1,2,3,0]));
 assert.throws(()=>inspectLocalFile(corrupt),'Rechazar binario');
 assert.throws(()=>inspectLocalFile('cloudflare/test-audit-production-export.mjs'),
  'Rechazar ruta dentro del repositorio');
}finally{rmSync(tmp,{recursive:true,force:true});}
console.log('OK: SQL original incompleto bloqueado si faltan perfiles, visitas, puntos o identidades; acepta solo revisión estructural, jamás certifica origen/prod; sin red ni usuarios.');
