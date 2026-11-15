#!/usr/bin/env node
/**
 * Bellaquitas Fest: upload directo de Worker STATIC-ASSETS QA.
 * Node 22, sin dependencias. Modo por defecto: dry-run sin conexiones/red.
 * Worker fijo "bellaquitas-media-qa": NO acepta otro worker, dominio ni D1.
 *
 * Dry-run: node cloudflare/deploy-media-qa.mjs
 * Publicar: CLOUDFLARE_ACCOUNT_ID=... CLOUDFLARE_API_TOKEN=... node cloudflare/deploy-media-qa.mjs --deploy
 *
 * Nota: sin los tres logos solo se publica un TEST DE VÍDEOS en workers.dev.
 * No hace migración definitiva ni utiliza secretos del backend.
 */
import assert from 'node:assert/strict';
import {readFileSync,existsSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join,basename} from 'node:path';
const WORKER='bellaquitas-media-qa',MAX=25*1024*1024;
const deploying=process.argv.includes('--deploy');
if(process.argv.some(x=>!['--deploy','--dry-run'].includes(x)))throw Error('Argumento no autorizado');
if(deploying&&process.argv.includes('--dry-run'))throw Error('Usa solo uno de --deploy o --dry-run');
const raw=readFileSync('cloudflare/site-media-manifest.js','utf8');
const m=raw.match(/export const SITE_MEDIA\s*=\s*(\[[\s\S]*?\]);/);
assert.ok(m,'Inventario de medios ausente');
const baseAssets=JSON.parse(m[1]);
assert.equal(baseAssets.length,17,'El inventario Git original cambió');
const older=JSON.parse(readFileSync('cloudflare/legacy-logos-manifest.json','utf8')).files;
assert.equal(older.length,3);
const assets=[],names=new Set();
for(const item of baseAssets){
 assert.equal(item.path,basename(item.path),'Ruta no permitida');
 const data=readFileSync(join('assets',item.path));
 assert.equal(data.length,item.bytes,'Tamaño alterado: '+item.path);
 assert.ok(data.length>0&&data.length<=MAX,'Límite gratuito superado: '+item.path);
 const gitSha=createHash('sha1').update('blob '+data.length+'\0').update(data).digest('hex');
 assert.equal(gitSha,item.gitSha1,'SHA Git diferente: '+item.path);
 assets.push({path:'/assets/'+item.path,data,mime:item.type});
 names.add(item.path);
}
let missingLogos=0;
const folder='assets/migrated-logos';
for(const item of older){
 assert.match(item.path,/^[0-9a-f-]{36}\.(png|jpg)$/);
 assert.ok(!names.has(item.path));names.add(item.path);
 const filename=join(folder,item.path);
 if(!existsSync(filename)){missingLogos++;continue;}
 assert.ok(statSync(filename).isFile(),'El logo no es un archivo regular');
 const data=readFileSync(filename);
 assert.equal(data.length,item.bytes,'Logo alterado: '+item.path);
 assert.equal(createHash('md5').update(data).digest('hex'),item.etagMd5,'Huella distinta: '+item.path);
 assert.ok(data.length>0&&data.length<=MAX);
 assets.push({path:'/assets/migrated-logos/'+item.path,data,mime:item.type});
}
if(missingLogos!==0&&missingLogos!==older.length)
 throw Error('Logos parcialmente recuperados: exige los 3 originales antes de continuar');
const manifest={},byHash=new Map();
let totalBytes=0;
for(const a of assets){
 const hash=createHash('sha256').update(a.data).digest('hex').slice(0,32);
 if(byHash.has(hash)){
  assert.ok(byHash.get(hash).data.equals(a.data),'Colisión de hash');
 }else byHash.set(hash,a);
 manifest[a.path]={hash,size:a.data.length};
 totalBytes+=a.data.length;
}
const preview={
 worker:WORKER,mode:deploying?'deploy':'dry-run',
 files:assets.length,videos:assets.filter(x=>x.mime==='video/mp4').length,
 missingLogos,allLogosVerified:missingLogos===0,totalBytes,shaHash:'sha256-first16bytes-hex',
 productionDomainChanged:false,hasDatabaseBinding:false
};
console.log(JSON.stringify(preview));
if(!deploying){
 console.log('DRY-RUN: nada se ha subido, no se necesita token ni hay costes añadidos.');
 process.exit(0);
}
const account=process.env.CLOUDFLARE_ACCOUNT_ID;
const apiToken=process.env.CLOUDFLARE_API_TOKEN;
if(!account||!/^[a-f0-9]{32}$/i.test(account))throw Error('Falta CLOUDFLARE_ACCOUNT_ID válido');
if(!apiToken)throw Error('Falta CLOUDFLARE_API_TOKEN; nunca guardarlo en Git ni imprimirlo');
const api='https://api.cloudflare.com/client/v4/accounts/'+account+'/workers';
async function call(path,method,body,bearer=apiToken,contentType){
 const head={Authorization:'Bearer '+bearer};
 if(contentType)head['Content-Type']=contentType;
 const response=await fetch(api+path,{method,headers:head,body,signal:AbortSignal.timeout(180000)});
 let json;
 try{json=await response.json();}catch{throw Error('Respuesta Cloudflare inválida; HTTP '+response.status);}
 if(!response.ok||json.success===false){
  const reason=(json.errors||[]).map(e=>String(e.message||'error').slice(0,100)).join('; ');
  throw Error('Cloudflare HTTP '+response.status+': '+reason);
 }
 return json.result||{};
}
const session=await call(
 '/scripts/'+WORKER+'/assets-upload-session','POST',JSON.stringify({manifest}),
 apiToken,'application/json');
assert.ok(typeof session.jwt==='string'&&session.jwt.length>32,'Sesión de upload inválida');
let completion=session.jwt,uploads=0;
const buckets=session.buckets||[];
for(const hashes of buckets){
 const data=new FormData();
 for(const hash of hashes){
  const a=byHash.get(hash);
  assert.ok(a,'Cloudflare solicita hash desconocido');
  data.append(hash,new Blob([a.data.toString('base64')],{type:a.mime}));
 }
 const result=await call('/assets/upload?base64=true','POST',data,session.jwt);
 if(result.jwt)completion=result.jwt;
 uploads++;
}
assert.ok(completion,'No existe token de finalización');
// Solo assets estáticos; sin secrets, Supabase, D1, R2, Google o email.
const metadata={
 main_module:'worker.js',compatibility_date:'2026-11-15',
 bindings:[{type:'assets',name:'ASSETS'}],
 assets:{jwt:completion,config:{run_worker_first:true}}
};
const multipart=new FormData();
multipart.append('metadata',new Blob([JSON.stringify(metadata)],{type:'application/json'}));
multipart.append('worker.js',new Blob([readFileSync('cloudflare/media-qa-worker.js','utf8')],{
 type:'application/javascript+module'}),'worker.js');
await call('/scripts/'+WORKER,'PUT',multipart);
console.log(JSON.stringify({deployed:true,worker:WORKER,assets:assets.length,
 uploads,migrationReady:false,reason:missingLogos?'Tres logos originales pendientes':'Aún faltan pruebas de cámara y cuentas'}));
