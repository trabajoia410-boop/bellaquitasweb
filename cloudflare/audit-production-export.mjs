#!/usr/bin/env node
/**
 * Preflight de un SQL entregado por un administrador: SIN red, sin Supabase,
 * sin consultar Cloudflare ni guardar datos. No importa ni imprime registros.
 * No confunde una exportación antigua/parcial con un backup actual de producción.
 *
 * node cloudflare/audit-production-export.mjs --inspect /fuera/del/repo/export.sql
 */
import assert from 'node:assert/strict';
import {readFileSync,realpathSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,dirname,relative,isAbsolute,sep} from 'node:path';
import {pathToFileURL} from 'node:url';

const LIMIT=64*1024*1024;
const repoRoot=realpathSync(process.cwd());
const clean=x=>String(x||'').replace(/["`]/g,'').toLowerCase();
const basenameOf=x=>clean(x).split('.').at(-1);
const tableRE=/\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?((?:"?[a-z_][\w]*"?\s*\.\s*)?"?[a-z_][\w]*"?)/ig;
const dataRE=/\b(INSERT\s+INTO|COPY)\s+((?:"?[a-z_][\w]*"?\s*\.\s*)?"?[a-z_][\w]*"?)/ig;
export function inspectSql(text){
 assert.ok(typeof text==='string'&&text.length>20,'SQL vacío');
 const sql=text.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*--[^\n]*(?:\n|$)/gm,'\n');
 const created=[...sql.matchAll(tableRE)].map(m=>clean(m[1]).replace(/\s+/g,''));
 const written=[...sql.matchAll(dataRE)].map(m=>({kind:m[1].toUpperCase().startsWith('COPY')?'COPY':'INSERT',table:clean(m[2]).replace(/\s+/g,'')}));
 const byBase=(set,name)=>set.some(v=>basenameOf(v)===name);
 const dataOf=name=>written.some(v=>basenameOf(v.table)===name);
 const hasProfiles=byBase(created,'profiles');
 const hasProfileData=dataOf('profiles');
 const hasPoints=/\bpoints\b/i.test(sql),hasVisits=/\bvisits\b/i.test(sql);
 const identityTables=['auth_identity_links','identities','users'].filter(x=>byBase(created,x));
 const dataIdentityTables=identityTables.filter(dataOf);
 const failures=[];
 if(!hasProfiles)failures.push('falta estructura de perfiles');
 if(!hasProfileData)failures.push('no hay ninguna instrucción de exportación de filas de perfiles');
 if(!hasPoints||!hasVisits)failures.push('no se identifican campos de puntos y visitas');
 if(!identityTables.length||!dataIdentityTables.length)
  failures.push('no consta exportación de identidades de acceso o cuentas');
 if(created.length<2)failures.push('el archivo parece solo un fragmento de esquema');
 return {
  format:'SQL-text',createdTables:created.length,dataStatements:written.length,
  containsProfilesStructure:hasProfiles,containsProfilesDataStatement:hasProfileData,
  containsPointsAndVisitsFields:hasPoints&&hasVisits,
  containsIdentityStructure:identityTables.length>0,containsIdentityDataStatement:dataIdentityTables.length>0,
  structureReadyForHumanReview:failures.length===0,
  blockingReasons:failures,
  sourceProvenanceCertified:false,
  originalProductionBackupCertified:false,
  note:'Sin conexión al origen no puede comprobarse fecha, exhaustividad ni validez de las sesiones.'
 };
}
function privatePath(file){
 const absolute=realpathSync(file);
 const rel=relative(repoRoot,absolute);
 if(rel===''||(!rel.startsWith('..'+sep)&&rel!=='..'&&!isAbsolute(rel)))
  throw Error('El backup original debe permanecer FUERA del repositorio');
 if(!statSync(absolute).isFile())throw Error('Se requiere un archivo SQL');
 return absolute;
}
export function inspectLocalFile(file){
 const source=privatePath(file),stats=statSync(source);
 if(stats.size<20||stats.size>LIMIT)throw Error('SQL vacío o de más de 64 MiB');
 if(!/\.sql$/i.test(source))throw Error('Solo exportación SQL de texto .sql');
 const bytes=readFileSync(source);
 if(bytes.includes(0))throw Error('Dump binario: usar herramienta oficial del origen, no este validador');
 const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
 const findings=inspectSql(text);
 return {inputBytes:stats.size,sha256:createHash('sha256').update(bytes).digest('hex'),
  ...findings,noRecordsPrinted:true,offlineOnly:true};
}
function main(){
 const [mode,file]=process.argv.slice(2);
 if(mode!=='--inspect'||!file||process.argv.length!==4)
  throw Error('Uso: node cloudflare/audit-production-export.mjs --inspect /ubicacion-privada/export.sql');
 const result=inspectLocalFile(file);
 console.log(JSON.stringify(result,null,2));
 if(!result.structureReadyForHumanReview)process.exitCode=2;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{main()}catch(e){console.error('AUDITORÍA BLOQUEADA:',e.message);process.exitCode=1;}
}
