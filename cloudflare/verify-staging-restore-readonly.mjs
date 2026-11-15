#!/usr/bin/env node
/* Bellaquitas Fest: verificación 100% solo lectura de D1 staging contra su
 * restauración aislada. No imprime filas, emails, IDs, hash ni contenido privado.
 * Token SOLO por variable de entorno. No necesita R2 ni acceso al dominio.
 *
 * Ejecución local:
 *   CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... \
 *     node cloudflare/verify-staging-restore-readonly.mjs
 */
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';

const SOURCE='c7ada9c9-d397-4e22-b5b8-3fbd8d13e550';
const RESTORE='c4356f11-0407-4c83-95cb-53d8056e0a28';
const OBJECTS="SELECT type,name,tbl_name,sql FROM sqlite_master WHERE type IN ('table','index','trigger','view') AND name NOT LIKE 'sqlite_%' AND name!='_cf_KV' ORDER BY type,name";
const IDENT=/^[a-z][a-z0-9_]*$/i;

function canonicalObject(row){
 const sorted=Object.keys(row).sort();
 return JSON.stringify(Object.fromEntries(sorted.map(key=>[key,row[key]])));
}
export function equalRows(a,b){
 return a.length===b.length&&
  JSON.stringify(a.map(canonicalObject).sort())===JSON.stringify(b.map(canonicalObject).sort());
}
export function compareSnapshots(a,b){
 const errors=[];
 if(a.objects.length!==b.objects.length)errors.push('Cantidad de objetos de esquema distinta');
 const left=a.objects.map(canonicalObject).sort(),right=b.objects.map(canonicalObject).sort();
 if(JSON.stringify(left)!==JSON.stringify(right))errors.push('Esquema diferente');
 const names=[...new Set([...Object.keys(a.rows),...Object.keys(b.rows)])].sort();
 for(const name of names){
  if(!Object.hasOwn(a.rows,name)||!Object.hasOwn(b.rows,name)){
   errors.push('Falta tabla '+name);continue;
  }
  if(!equalRows(a.rows[name],b.rows[name]))errors.push('Diferencias en tabla '+name);
 }
 const count=rows=>Object.values(rows).reduce((sum,r)=>sum+r.length,0);
 return {equal:errors.length===0,errors,tableCount:names.length,
  sourceRecords:count(a.rows),restoredRecords:count(b.rows),
  schemaObjects:a.objects.length};
}

function makeClient(token,accountId){
 assert.match(accountId,/^[0-9a-f]{32}$/i,'Cuenta Cloudflare inválida');
 assert.ok(typeof token==='string'&&token.length>20,'Falta token válido');
 return async function query(db,sql){
  const response=await fetch(
   'https://api.cloudflare.com/client/v4/accounts/'+accountId+'/d1/database/'+db+'/query',{
    method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:JSON.stringify({sql}),signal:AbortSignal.timeout(20000)
   });
  const payload=await response.json().catch(()=>null);
  if(!response.ok||payload?.success!==true||payload?.result?.[0]?.success===false){
   throw new Error('Consulta D1 rechazada: '+response.status+' (sin mostrar respuesta privada)');
  }
  const rows=payload?.result?.[0]?.results;
  if(!Array.isArray(rows))throw Error('Respuesta D1 sin filas');
  return rows;
 };
}
async function snapshot(db,query){
 const objects=await query(db,OBJECTS);
 const names=objects.filter(x=>x.type==='table').map(x=>x.name);
 if(names.some(x=>!IDENT.test(x)))throw Error('Tabla con identificador no autorizado');
 const rows={};
 for(const name of names)rows[name]=await query(db,'SELECT * FROM "'+name+'"');
 return {objects,rows};
}
export async function verifyStagingRestore(query){
 const [source,restored]=await Promise.all([
  snapshot(SOURCE,query),snapshot(RESTORE,query)
 ]);
 const result=compareSnapshots(source,restored);
 if(result.equal){
  const [a,b]=await Promise.all([
   query(SOURCE,'PRAGMA foreign_key_check'),
   query(RESTORE,'PRAGMA foreign_key_check')
  ]);
  if(a.length||b.length){
   result.equal=false;
   result.errors.push('Violaciones de integridad de claves foráneas');
  }
  // El usuario de correo exclusivo de staging debe mantenerse en AMBAS copias.
  const noGoogle="SELECT COUNT(*) AS n FROM profiles p WHERE NOT EXISTS (SELECT 1 FROM auth_identity_links l WHERE l.profile_id=p.id AND l.provider='google')";
  const [srcLocal,dstLocal]=await Promise.all([query(SOURCE,noGoogle),query(RESTORE,noGoogle)]);
  result.localEmailAccounts=srcLocal[0]?.n;
  if(srcLocal[0]?.n!==dstLocal[0]?.n||srcLocal[0]?.n!==1){
   result.equal=false;
   result.errors.push('Discrepancia de cuentas exclusivas de staging');
  }
 }
 return result;
}
async function main(){
 if(process.argv.length>2)throw Error('Esta comprobación no admite URLs ni IDs externos');
 const token=process.env.CLOUDFLARE_API_TOKEN;
 const accountId=process.env.CLOUDFLARE_ACCOUNT_ID;
 if(!token||!accountId)throw Error('Configura CLOUDFLARE_API_TOKEN y CLOUDFLARE_ACCOUNT_ID solo en tu equipo');
 const result=await verifyStagingRestore(makeClient(token,accountId));
 console.log(JSON.stringify(result,null,2));
 if(!result.equal)process.exitCode=1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 main().catch(e=>{console.error('Verificación fallida:',e.message);process.exitCode=1;});
}
