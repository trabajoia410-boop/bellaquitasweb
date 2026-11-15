#!/usr/bin/env node
/*
 * Bellaquitas Fest: copia EXTERNA cifrada de Cloudflare D1 staging.
 * Nunca sube datos ni claves a GitHub y NO utiliza Supabase, R2 ni Workers de producción.
 *
 * En un equipo de confianza, con Cloudflare API Token D1 READ guardado localmente:
 *   CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... \
 *     node cloudflare/offsite-d1-backup.mjs --export-staging /USB1/copia.json /USB2/clave.b64
 *   node cloudflare/offsite-d1-backup.mjs --verify /USB1/copia.json /USB2/clave.b64
 *   node cloudflare/offsite-d1-backup.mjs --restore /USB1/copia.json /USB2/clave.b64 /sitio/recuperada.sql
 *
 * Guardar la clave en ubicación distinta de la copia. No subir clave, JSON ni SQL
 * a repositorios, ni compartirlos por chat. La clave anterior no se reutiliza.
 */
import assert from 'node:assert/strict';
import {randomBytes,createCipheriv,createDecipheriv,createHash,timingSafeEqual} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {readFileSync,writeFileSync,realpathSync,existsSync,mkdtempSync,rmSync,statSync} from 'node:fs';
import {resolve,relative,dirname,basename,join,isAbsolute,sep} from 'node:path';
import {tmpdir} from 'node:os';

const SOURCE_DB='c7ada9c9-d397-4e22-b5b8-3fbd8d13e550';
const LIMIT=64*1024*1024;
const PREFIX=Buffer.from('-- Bellaquitas Fest D1 SQL backup\n-- Exportación de preparación, NO es Supabase producción\n','utf8');
const LOCAL_PREFIX=Buffer.from('-- Bellaquitas Fest SQL backup local\n-- Archivo proporcionado por el usuario: origen NO verificado\n','utf8');
const repoRoot=realpathSync(process.cwd());
const digest=b=>createHash('sha256').update(b).digest('hex');
const args=process.argv.slice(2);
function outsideRepo(filename){
 const target=resolve(filename);
 const parent=realpathSync(dirname(target));
 const canonical=resolve(parent,basename(target));
 const rel=relative(repoRoot,canonical);
 if(rel===''||(!rel.startsWith('..'+sep)&&rel!=='..'&&!isAbsolute(rel)))
  throw Error('No guardar claves ni respaldos dentro del repositorio');
 return canonical;
}
function noOverwrite(file){
 if(existsSync(file))throw Error('El archivo de salida ya existe; no se permite sobrescribirlo');
}
function doEncrypt(plaintext,key,source='cloudflare-d1-staging'){
 assert.equal(key.length,32);
 const prefix=source==='cloudflare-d1-staging'?PREFIX:source==='local-sql-unverified'?LOCAL_PREFIX:null;
 assert.ok(prefix,'Fuente de copia no autorizada');
 assert.ok(plaintext.length>prefix.length&&plaintext.length<LIMIT,'Exportación vacía o demasiado grande');
 assert.ok(plaintext.subarray(0,prefix.length).equals(prefix),'Cabecera de respaldo no válida');
 const iv=randomBytes(12);
 const cipher=createCipheriv('aes-256-gcm',key,iv);
 const compressed=gzipSync(plaintext);
 const encrypted=Buffer.concat([cipher.update(compressed),cipher.final(),cipher.getAuthTag()]);
 return {
  version:1,source,compression:'gzip',
  algorithm:'AES-256-GCM',created_at:new Date().toISOString(),
  plaintext_bytes:plaintext.length,plaintext_sha256:digest(plaintext),
  iv_base64:iv.toString('base64'),ciphertext_base64:encrypted.toString('base64')
 };
}
function doDecrypt(archive,key){
 assert.equal(key.length,32,'Clave AES-256 incorrecta');
 const prefix=archive?.source==='cloudflare-d1-staging'?PREFIX:
   archive?.source==='local-sql-unverified'?LOCAL_PREFIX:null;
 if(archive?.version!==1||!prefix||archive?.compression!=='gzip'||
    archive?.algorithm!=='AES-256-GCM')
  throw Error('Formato de copia desconocido');
 const iv=Buffer.from(archive.iv_base64||'','base64');
 const bytes=Buffer.from(archive.ciphertext_base64||'','base64');
 assert.equal(iv.length,12,'Nonce AES-GCM inválido');
 assert.ok(bytes.length>16&&bytes.length<LIMIT,'Copia vacía o demasiado grande');
 const decipher=createDecipheriv('aes-256-gcm',key,iv);
 decipher.setAuthTag(bytes.subarray(bytes.length-16));
 const compressed=Buffer.concat([decipher.update(bytes.subarray(0,-16)),decipher.final()]);
 const plain=gunzipSync(compressed,{maxOutputLength:LIMIT});
 const hash=Buffer.from(archive.plaintext_sha256||'','hex');
 const actual=Buffer.from(digest(plain),'hex');
 assert.equal(hash.length,32,'SHA-256 ausente');
 assert.ok(timingSafeEqual(hash,actual),'Integridad de SQL incorrecta');
 assert.equal(archive.plaintext_bytes,plain.length,'Tamaño descifrado no coincide');
 assert.ok(plain.subarray(0,prefix.length).equals(prefix),'La copia SQL no corresponde al origen declarado');
 return plain;
}
function loadKey(file){
 const key=Buffer.from(readFileSync(file,'utf8').trim(),'base64');
 assert.equal(key.length,32,'Clave cifrada inválida: 32 bytes necesarios');
 return key;
}
function loadArchive(file){
 const data=readFileSync(file);
 assert.ok(data.length<LIMIT*2,'Archivo cifrado demasiado grande');
 return JSON.parse(data.toString('utf8'));
}
function store(archive,key,archivePath,keyPath){
 const a=outsideRepo(archivePath),k=outsideRepo(keyPath);
 if(a===k||dirname(a)===dirname(k))throw Error('La clave y el archivo cifrado deben guardarse en carpetas distintas');
 noOverwrite(a);noOverwrite(k);
 // Primero la clave local: si fallase su escritura, nunca se emite copia inútil.
 writeFileSync(k,key.toString('base64')+'\n',{flag:'wx',mode:0o600});
 try{
  writeFileSync(a,JSON.stringify(archive)+'\n',{flag:'wx',mode:0o600});
  assert.ok(doDecrypt(loadArchive(a),loadKey(k)).length===archive.plaintext_bytes);
 }catch(e){
  // La clave ya existe y debe permanecer con el usuario para la recuperación.
  throw e;
 }
 return {archive:a,key:k};
}
async function getD1Export(accountId,token){
 assert.match(accountId||'',/^[0-9a-f]{32}$/i,'ID de cuenta inválido');
 assert.ok(typeof token==='string'&&token.length>=20,'Falta Cloudflare API Token local de lectura D1');
 const url='https://api.cloudflare.com/client/v4/accounts/'+accountId+'/d1/database/'+SOURCE_DB+'/export';
 const headers={'Authorization':'Bearer '+token,'Content-Type':'application/json'};
 let bookmark;
 for(let iteration=0;iteration<40;iteration++){
  const payload={output_format:'polling',dump_options:{compatibility:'d1'}};
  if(bookmark)payload.current_bookmark=bookmark;
  const result=await fetch(url,{method:'POST',headers,body:JSON.stringify(payload),signal:AbortSignal.timeout(30000)});
  const body=await result.json().catch(()=>null);
  if(!result.ok||body?.success!==true)throw Error('Cloudflare export rechazado: HTTP '+result.status);
  const state=body.result||{};
  if(state.status==='error')throw Error('Cloudflare no ha podido generar la exportación');
  if(state.status==='complete'){
   const link=new URL(state.result?.signed_url||'');
   if(link.protocol!=='https:'||link.username||link.password)throw Error('URL firmada de exportación no válida');
   const file=await fetch(link,{redirect:'error',signal:AbortSignal.timeout(60000)});
   if(!file.ok)throw Error('Error recuperando exportación SQL temporal');
   if(Number(file.headers.get('content-length')||0)>LIMIT-PREFIX.length)
    throw Error('El respaldo supera el límite seguro de esta herramienta');
   const chunks=[];let bytes=0;
   if(!file.body)throw Error('Respuesta de exportación vacía');
   for await(const chunk of file.body){
    bytes+=chunk.length;
    if(bytes>LIMIT-PREFIX.length)throw Error('Exportación excede 64 MiB; no se ha guardado nada');
    chunks.push(Buffer.from(chunk));
   }
   const sql=Buffer.concat(chunks);
   assert.ok(sql.length>10,'La exportación no contiene datos');
   new TextDecoder('utf-8',{fatal:true}).decode(sql);
   assert.ok(!sql.includes(0),'No se admite contenido SQL binario');
   return Buffer.concat([PREFIX,sql]);
  }
  const next=state.at_bookmark||bookmark;
  if(!next)throw Error('Cloudflare no proporcionó bookmark para consulta posterior');
  bookmark=next;
  await new Promise(r=>setTimeout(r,1500));
 }
 throw Error('Exportación D1 no finalizada; no se ha guardado copia parcial');
}
async function selfTest(){
 const dir=mkdtempSync(join(tmpdir(),'bf-offsite-'));
 try{
  const folderA=join(dir,'archivo'),folderB=join(dir,'llave');
  const {mkdirSync}=await import('node:fs');
  mkdirSync(folderA,{mode:0o700});mkdirSync(folderB,{mode:0o700});
  const fake=Buffer.concat([PREFIX,Buffer.from("CREATE TABLE profiles(id TEXT,points INTEGER);\nINSERT INTO profiles VALUES('persona-ficticia',0);\n")]);
  const archivePath=join(folderA,'qa.enc.json'),keyPath=join(folderB,'qa.key');
  const key=randomBytes(32),blob=doEncrypt(fake,key);
  store(blob,key,archivePath,keyPath);
  assert.ok(doDecrypt(loadArchive(archivePath),loadKey(keyPath)).equals(fake));
  const fakeLocal=Buffer.concat([LOCAL_PREFIX,Buffer.from("CREATE TABLE qa_local(id TEXT);\nINSERT INTO qa_local VALUES ('ficticio');\n")]);
  const localKey=randomBytes(32);
  const localArchive=doEncrypt(fakeLocal,localKey,'local-sql-unverified');
  assert.ok(doDecrypt(localArchive,localKey).equals(fakeLocal));
  assert.throws(()=>doDecrypt(localArchive,randomBytes(32)),'Copia local: clave falsa debe fallar');
  assert.throws(()=>doDecrypt(blob,randomBytes(32)),'Clave falsa debe fallar');
  const tampered=structuredClone(blob);
  const raw=Buffer.from(tampered.ciphertext_base64,'base64');raw[0]^=1;
  tampered.ciphertext_base64=raw.toString('base64');
  assert.throws(()=>doDecrypt(tampered,key),'Modificación del archivo debe fallar');
  assert.throws(()=>store(blob,key,archivePath,keyPath),'No sobrescribir copia');
  assert.throws(()=>outsideRepo(join(repoRoot,'PRIVADO.sql')),'No almacenar en Git');
  if(process.platform!=='win32'){
   assert.equal(statSync(archivePath).mode&0o077,0,'Copia no debe ser pública');
   assert.equal(statSync(keyPath).mode&0o077,0,'Clave no debe ser pública');
  }
  console.log('OK: copia D1 ficticia AES-256-GCM, clave aleatoria fuera del repo, verificación, detección de alteración y sobrescrituras. Sin red.');
 }finally{rmSync(dir,{recursive:true,force:true})}
}
async function main(){
 if(args[0]==='--self-test'&&args.length===1)return selfTest();
 if(args[0]==='--export-staging'&&args.length===3){
  const [archive,keypath]=args.slice(1);
  outsideRepo(archive);outsideRepo(keypath);noOverwrite(archive);noOverwrite(keypath);
  const sql=await getD1Export(process.env.CLOUDFLARE_ACCOUNT_ID,process.env.CLOUDFLARE_API_TOKEN);
  const key=randomBytes(32);
  const payload=doEncrypt(sql,key);
  store(payload,key,archive,keypath);
  console.log('OK: copia D1 STAGING cifrada y verificada. Clave y archivo en ubicaciones separadas. Nunca pegues la clave aquí.');
  console.log('AVISO: NO es una copia de Supabase producción ni autoriza la migración final.');
  return;
 }
 if(args[0]==='--encrypt-local-sql'&&args.length===4){
  const [filePath,archivePath,keyPath]=args.slice(1);
  const source=outsideRepo(filePath);
  assert.ok(/\.sql$/i.test(source),'Se necesita un archivo .sql exportado localmente');
  assert.ok(statSync(source).isFile(),'La exportación SQL debe ser archivo regular');
  const archive=outsideRepo(archivePath),key=outsideRepo(keyPath);
  noOverwrite(archive);noOverwrite(key);
  const bytes=readFileSync(source);
  assert.ok(bytes.length>15&&bytes.length<LIMIT-LOCAL_PREFIX.length,'Exportación vacía o excesiva');
  new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  assert.ok(!bytes.includes(0),'Solo se admite SQL texto, nunca dumps binarios');
  assert.ok(/(?:CREATE TABLE|INSERT INTO|COPY |SET |BEGIN|CREATE SCHEMA|-- PostgreSQL database dump)/i.test(bytes.toString('utf8',0,4000)),
    'El archivo no parece ser una exportación SQL');
  const plaintext=Buffer.concat([LOCAL_PREFIX,bytes]);
  const secret=randomBytes(32),blob=doEncrypt(plaintext,secret,'local-sql-unverified');
  store(blob,secret,archive,key);
  console.log('OK: SQL local cifrado y verificado en dos ubicaciones separadas; fuente NO certificada.');
  console.log('NOTA: conserva el SQL original protegido o elimínalo de forma segura según tu procedimiento.');
  return;
 }
 if(args[0]==='--verify'&&args.length===3){
  const sql=doDecrypt(loadArchive(args[1]),loadKey(args[2]));
  console.log('OK: copia D1 cifrada verificada; bytes SQL:',sql.length);
  return;
 }
 if(args[0]==='--restore'&&args.length===4){
  const destination=outsideRepo(args[3]);noOverwrite(destination);
  const sql=doDecrypt(loadArchive(args[1]),loadKey(args[2]));
  writeFileSync(destination,sql,{flag:'wx',mode:0o600});
  console.log('OK: SQL recuperado en un archivo NUEVO protegido. Bórralo después de restaurar la base aislada.');
  return;
 }
 throw Error('Uso: --self-test | --export-staging ARCHIVO_CIFRADO.json CLAVE_NUEVA.b64 | --encrypt-local-sql ORIGEN.sql ARCHIVO_CIFRADO.json CLAVE_NUEVA.b64 | --verify ARCHIVO_CIFRADO.json CLAVE_NUEVA.b64 | --restore ARCHIVO_CIFRADO.json CLAVE_NUEVA.b64 SALIDA.sql');
}
main().catch(e=>{console.error('Copia de seguridad no completada:',e.message);process.exitCode=1});
